from datetime import datetime, timezone
import numpy as np
import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from backend.database import DB_ENGINE_NAME
from backend.models import HistoricalOccupancy, OccupancyRecord, ParkingLot

VALID_SOURCE_TYPES = {"simulated", "live", "feedback", "historical"}


def run_data_pipeline(db: Session, reprocess_all: bool = False) -> dict:
    """
    Validate raw occupancy_records, remove duplicates, handle missing values,
    normalise occupancy rates, and upsert into historical_occupancy.
    """
    lots = db.execute(select(ParkingLot.id, ParkingLot.capacity)).all()
    lot_capacity_map = {lot.id: lot.capacity for lot in lots}

    stmt_raw = select(
        OccupancyRecord.id,
        OccupancyRecord.lot_id,
        OccupancyRecord.timestamp,
        OccupancyRecord.occupied_slots,
        OccupancyRecord.capacity_snapshot,
        OccupancyRecord.source_type,
    )
    if not reprocess_all:
        stmt_raw = stmt_raw.where(OccupancyRecord.is_processed.is_(False))

    records_list = [dict(r) for r in db.execute(stmt_raw).mappings().all()]
    raw_count = len(records_list)

    if raw_count == 0:
        total_hist = db.query(func.count(HistoricalOccupancy.id)).scalar() or 0
        src_rows = db.query(HistoricalOccupancy.source_type).distinct().all()
        return {
            "status": "no_new_records",
            "raw_records_read": 0,
            "invalid_dropped": 0,
            "duplicates_removed": 0,
            "missing_imputed": 0,
            "records_normalised_stored": 0,
            "total_historical_rows": int(total_hist),
            "source_types": sorted([r[0] for r in src_rows]),
            "executed_at": datetime.now(timezone.utc).replace(tzinfo=None),
        }

    df = pd.DataFrame(records_list)

    # 1. Validate records: lot exists, valid timestamp, valid source_type, positive capacity
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df["capacity"] = df["lot_id"].map(lot_capacity_map).fillna(df["capacity_snapshot"])

    valid_mask = (
        df["lot_id"].isin(lot_capacity_map.keys())
        & df["timestamp"].notna()
        & df["source_type"].isin(VALID_SOURCE_TYPES)
        & (df["capacity"] > 0)
    )
    # Reject explicitly corrupted negative slot counts
    neg_mask = df["occupied_slots"].notna() & (df["occupied_slots"] < 0)
    valid_mask = valid_mask & (~neg_mask)

    invalid_dropped = int((~valid_mask).sum())
    df_valid = df.loc[valid_mask].copy()

    if df_valid.empty:
        # Mark raw rows processed so invalid records don't stall future runs
        raw_ids = [r["id"] for r in records_list]
        _mark_processed(db, raw_ids)
        db.commit()
        total_hist = db.query(func.count(HistoricalOccupancy.id)).scalar() or 0
        return {
            "status": "completed_with_only_invalid",
            "raw_records_read": raw_count,
            "invalid_dropped": invalid_dropped,
            "duplicates_removed": 0,
            "missing_imputed": 0,
            "records_normalised_stored": 0,
            "total_historical_rows": int(total_hist),
            "source_types": [],
            "executed_at": datetime.now(timezone.utc).replace(tzinfo=None),
        }

    # Floor timestamp to 15-minute interval for consistent binning
    df_valid["timestamp"] = df_valid["timestamp"].dt.floor("15min")

    # 2. Remove duplicates on (lot_id, timestamp, source_type), keeping latest id
    df_valid = df_valid.sort_values(["lot_id", "timestamp", "id"])
    before_dedup = len(df_valid)
    df_valid = df_valid.drop_duplicates(subset=["lot_id", "timestamp", "source_type"], keep="last").copy()
    duplicates_removed = int(before_dedup - len(df_valid))

    # 3. Handle missing values via per-lot time interpolation, then lot median fallback
    missing_before = int(df_valid["occupied_slots"].isna().sum())
    if missing_before > 0:
        df_valid["occupied_slots"] = (
            df_valid.groupby("lot_id")["occupied_slots"]
            .transform(lambda s: s.interpolate(method="linear", limit_direction="both"))
        )
        # Fallback if an entire lot had missing values
        df_valid["occupied_slots"] = df_valid["occupied_slots"].fillna(df_valid["capacity"] * 0.5)

    # 4. Normalise values & derive calendar features
    df_valid["occupied_slots"] = np.clip(
        np.round(df_valid["occupied_slots"].astype(float)),
        0,
        df_valid["capacity"].astype(float),
    ).astype(int)
    df_valid["capacity"] = df_valid["capacity"].astype(int)
    df_valid["occupancy_rate"] = np.round(
        np.clip(df_valid["occupied_slots"] / df_valid["capacity"], 0.0, 1.0),
        4,
    )
    df_valid["hour"] = df_valid["timestamp"].dt.hour.astype(int)
    df_valid["minute_bin"] = ((df_valid["timestamp"].dt.minute // 15) * 15).astype(int)
    df_valid["day_of_week"] = df_valid["timestamp"].dt.dayofweek.astype(int)
    df_valid["is_weekend"] = df_valid["day_of_week"].isin([5, 6])

    # Convert timestamps back to naive Python datetimes for SQLAlchemy
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    rows_to_upsert = [
        {
            "lot_id": int(row.lot_id),
            "timestamp": row.timestamp.to_pydatetime(),
            "occupied_slots": int(row.occupied_slots),
            "capacity": int(row.capacity),
            "occupancy_rate": float(row.occupancy_rate),
            "hour": int(row.hour),
            "minute_bin": int(row.minute_bin),
            "day_of_week": int(row.day_of_week),
            "is_weekend": bool(row.is_weekend),
            "source_type": str(row.source_type),
            "created_at": now_utc,
        }
        for row in df_valid.itertuples(index=False)
    ]

    # 5. Store in historical_occupancy using compiled executemany upsert
    insert_fn = pg_insert if DB_ENGINE_NAME == "postgresql" else sqlite_insert
    stmt = insert_fn(HistoricalOccupancy)
    stmt = stmt.on_conflict_do_update(
        index_elements=["lot_id", "timestamp", "source_type"],
        set_={
            "occupied_slots": stmt.excluded.occupied_slots,
            "capacity": stmt.excluded.capacity,
            "occupancy_rate": stmt.excluded.occupancy_rate,
            "hour": stmt.excluded.hour,
            "minute_bin": stmt.excluded.minute_bin,
            "day_of_week": stmt.excluded.day_of_week,
            "is_weekend": stmt.excluded.is_weekend,
        },
    )
    chunk_size = 5000
    for start in range(0, len(rows_to_upsert), chunk_size):
        db.execute(stmt, rows_to_upsert[start : start + chunk_size])

    raw_ids = [r["id"] for r in records_list]
    _mark_processed(db, raw_ids)
    db.commit()

    total_hist = db.query(func.count(HistoricalOccupancy.id)).scalar() or 0
    src_rows = db.query(HistoricalOccupancy.source_type).distinct().all()

    return {
        "status": "completed",
        "raw_records_read": raw_count,
        "invalid_dropped": invalid_dropped,
        "duplicates_removed": duplicates_removed,
        "missing_imputed": missing_before,
        "records_normalised_stored": len(rows_to_upsert),
        "total_historical_rows": int(total_hist),
        "source_types": sorted([r[0] for r in src_rows]),
        "executed_at": now_utc,
    }


def _mark_processed(db: Session, raw_ids: list[int]) -> None:
    chunk_size = 5000
    for start in range(0, len(raw_ids), chunk_size):
        batch = raw_ids[start : start + chunk_size]
        db.query(OccupancyRecord).filter(OccupancyRecord.id.in_(batch)).update(
            {OccupancyRecord.is_processed: True},
            synchronize_session=False,
        )
