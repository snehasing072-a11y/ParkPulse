from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import desc, func, inspect
from sqlalchemy.exc import DatabaseError
from sqlalchemy.orm import Session

from backend.database import DATA_DIR, DB_ENGINE_NAME, SessionLocal, engine, get_db, Base
from backend.models import HistoricalOccupancy, OccupancyRecord, ParkingLot, Search
from backend.pipeline import run_data_pipeline
from backend.schemas import (
    ParkingLotResponse,
    PipelineRunResponse,
    PipelineStatusResponse,
    SearchCreate,
    SearchResponse,
)
from backend.seed import seed_greater_noida_data


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        try:
            seed_greater_noida_data(db, force=False)
        finally:
            db.close()
    except DatabaseError:
        if DB_ENGINE_NAME == "sqlite":
            engine.dispose()
            for p in DATA_DIR.glob("parkpulse.db*"):
                p.unlink(missing_ok=True)
            Base.metadata.create_all(bind=engine)
            db = SessionLocal()
            try:
                seed_greater_noida_data(db, force=True)
            finally:
                db.close()
        else:
            raise
    yield


app = FastAPI(
    title="ParkPulse API",
    description="AI-powered parking availability prediction and recommendation backend",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        loc = [str(part) for part in err.get("loc", []) if part != "body"]
        field_name = ".".join(loc) if loc else "request"
        errors.append({"field": field_name, "message": err.get("msg", "Invalid input")})
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Please fix the highlighted search inputs.",
            "errors": errors,
        },
    )


@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    lots_count = db.query(func.count(ParkingLot.id)).scalar() or 0
    hist_count = db.query(func.count(HistoricalOccupancy.id)).scalar() or 0
    inspector = inspect(engine)
    return {
        "status": "ok",
        "database_engine": DB_ENGINE_NAME,
        "tables": sorted(inspector.get_table_names()),
        "parking_lots_count": int(lots_count),
        "historical_occupancy_count": int(hist_count),
    }


@app.get("/api/lots", response_model=list[ParkingLotResponse])
def list_parking_lots(
    area: Optional[str] = Query(None),
    vehicle_type: Optional[str] = Query(None),
    lot_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(ParkingLot)
    if area:
        query = query.filter(ParkingLot.area.ilike(f"%{area.strip()}%"))
    if lot_type:
        query = query.filter(ParkingLot.lot_type == lot_type.strip().lower())
    if vehicle_type and vehicle_type.lower() in {"car", "bike"}:
        vt = vehicle_type.lower()
        query = query.filter(ParkingLot.supported_vehicles.in_([vt, "both"]))

    lots = query.order_by(ParkingLot.id.asc()).all()

    # Fetch latest historical simulated reading per lot cleanly
    subq = (
        db.query(
            HistoricalOccupancy.lot_id,
            func.max(HistoricalOccupancy.timestamp).label("max_ts"),
        )
        .group_by(HistoricalOccupancy.lot_id)
        .subquery()
    )
    latest_rows = (
        db.query(HistoricalOccupancy)
        .join(
            subq,
            (HistoricalOccupancy.lot_id == subq.c.lot_id)
            & (HistoricalOccupancy.timestamp == subq.c.max_ts),
        )
        .all()
    )
    latest_by_lot = {row.lot_id: row for row in latest_rows}

    result = []
    for lot in lots:
        latest = latest_by_lot.get(lot.id)
        if latest:
            free_slots = max(0, lot.capacity - latest.occupied_slots)
            source_label = "Baseline"
            data_label = "Simulated data" if latest.source_type == "simulated" else latest.source_type.title()
            occ_slots = latest.occupied_slots
            occ_rate = latest.occupancy_rate
            latest_ts = latest.timestamp
        else:
            free_slots = None
            source_label = "Unknown"
            data_label = "No occupancy data"
            occ_slots = None
            occ_rate = None
            latest_ts = None

        result.append(
            ParkingLotResponse(
                id=lot.id,
                name=lot.name,
                address=lot.address,
                area=lot.area,
                lot_type=lot.lot_type,
                latitude=lot.latitude,
                longitude=lot.longitude,
                capacity=lot.capacity,
                price_per_hour=lot.price_per_hour,
                supported_vehicles=lot.supported_vehicles,
                opening_time=lot.opening_time,
                closing_time=lot.closing_time,
                is_24_hours=lot.is_24_hours,
                latest_occupied_slots=occ_slots,
                latest_free_slots=free_slots,
                latest_occupancy_rate=occ_rate,
                availability_source=source_label,
                data_label=data_label,
                latest_timestamp=latest_ts,
            )
        )
    return result


@app.get("/api/lots/{lot_id}")
def get_parking_lot(lot_id: int, db: Session = Depends(get_db)):
    lot = db.query(ParkingLot).filter(ParkingLot.id == lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Parking lot not found.")

    recent_history = (
        db.query(HistoricalOccupancy)
        .filter(HistoricalOccupancy.lot_id == lot_id)
        .order_by(desc(HistoricalOccupancy.timestamp))
        .limit(96)  # last 24 hours at 15-min intervals
        .all()
    )
    recent_history = list(reversed(recent_history))

    return {
        "lot": {
            "id": lot.id,
            "name": lot.name,
            "address": lot.address,
            "area": lot.area,
            "lot_type": lot.lot_type,
            "latitude": lot.latitude,
            "longitude": lot.longitude,
            "capacity": lot.capacity,
            "price_per_hour": lot.price_per_hour,
            "supported_vehicles": lot.supported_vehicles,
            "opening_time": lot.opening_time,
            "closing_time": lot.closing_time,
            "is_24_hours": lot.is_24_hours,
        },
        "availability_source": "Baseline" if recent_history else "Unknown",
        "data_label": "Simulated data",
        "recent_24h": [
            {
                "timestamp": h.timestamp.isoformat(),
                "occupied_slots": h.occupied_slots,
                "free_slots": max(0, lot.capacity - h.occupied_slots),
                "occupancy_rate": h.occupancy_rate,
                "source_type": h.source_type,
            }
            for h in recent_history
        ],
    }


@app.post("/api/searches", response_model=SearchResponse, status_code=201)
def create_search(payload: SearchCreate, db: Session = Depends(get_db)):
    try:
        arrival_dt = payload.parsed_arrival_datetime()
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    search_row = Search(
        user_id=None,
        destination=payload.destination,
        destination_lat=payload.destination_lat,
        destination_lng=payload.destination_lng,
        arrival_time=arrival_dt,
        vehicle_type=payload.vehicle_type,
        duration_minutes=payload.duration_minutes,
        max_walking_distance_m=payload.max_walking_distance_m,
        preference=payload.preference,
    )
    db.add(search_row)
    db.commit()
    db.refresh(search_row)
    return search_row


@app.get("/api/searches", response_model=list[SearchResponse])
def list_recent_searches(limit: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)):
    return db.query(Search).order_by(desc(Search.created_at)).limit(limit).all()


@app.post("/api/pipeline/run", response_model=PipelineRunResponse)
def trigger_data_pipeline(
    reprocess_all: bool = Query(False),
    db: Session = Depends(get_db),
):
    result = run_data_pipeline(db, reprocess_all=reprocess_all)
    return PipelineRunResponse(**result)


@app.get("/api/pipeline/status", response_model=PipelineStatusResponse)
def get_pipeline_status(db: Session = Depends(get_db)):
    inspector = inspect(engine)
    total_lots = db.query(func.count(ParkingLot.id)).scalar() or 0
    total_raw = db.query(func.count(OccupancyRecord.id)).scalar() or 0
    unprocessed = (
        db.query(func.count(OccupancyRecord.id))
        .filter(OccupancyRecord.is_processed.is_(False))
        .scalar()
        or 0
    )
    total_hist = db.query(func.count(HistoricalOccupancy.id)).scalar() or 0
    sim_count = (
        db.query(func.count(HistoricalOccupancy.id))
        .filter(HistoricalOccupancy.source_type == "simulated")
        .scalar()
        or 0
    )
    live_count = (
        db.query(func.count(HistoricalOccupancy.id))
        .filter(HistoricalOccupancy.source_type == "live")
        .scalar()
        or 0
    )
    min_ts, max_ts = db.query(
        func.min(HistoricalOccupancy.timestamp),
        func.max(HistoricalOccupancy.timestamp),
    ).first()

    return PipelineStatusResponse(
        database_engine=DB_ENGINE_NAME,
        total_lots=int(total_lots),
        total_raw_occupancy_records=int(total_raw),
        unprocessed_occupancy_records=int(unprocessed),
        total_historical_records=int(total_hist),
        simulated_records=int(sim_count),
        live_records=int(live_count),
        earliest_timestamp=min_ts,
        latest_timestamp=max_ts,
        tables=sorted(inspector.get_table_names()),
    )


@app.post("/api/seed")
def seed_endpoint(force: bool = Query(False), db: Session = Depends(get_db)):
    return seed_greater_noida_data(db, force=force)


# Serve built Vite SPA in production when dist/ exists
DIST_DIR = Path(__file__).resolve().parent.parent / "dist"
if DIST_DIR.exists():
    assets_dir = DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API route not found")
        target = DIST_DIR / full_path
        if full_path and target.is_file():
            return FileResponse(str(target))
        return FileResponse(str(DIST_DIR / "index.html"))
