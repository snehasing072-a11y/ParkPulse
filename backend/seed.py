from datetime import datetime, timedelta, timezone
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from backend.models import HistoricalOccupancy, OccupancyRecord, ParkingLot
from backend.pipeline import run_data_pipeline

GREATER_NOIDA_LOTS = [
    {
        "name": "Pari Chowk Metro Transit Plaza",
        "address": "Pari Chowk Roundabout, Sector Omega II, Greater Noida",
        "area": "Pari Chowk",
        "lot_type": "transit",
        "latitude": 28.4671,
        "longitude": 77.5138,
        "capacity": 240,
        "price_per_hour": 30.0,
        "supported_vehicles": "both",
        "opening_time": "05:00",
        "closing_time": "23:30",
        "is_24_hours": False,
    },
    {
        "name": "The Grand Venice Mall Basement",
        "address": "Plot SH-3, Site IV, Near Pari Chowk, Greater Noida",
        "area": "Site IV",
        "lot_type": "mall",
        "latitude": 28.4583,
        "longitude": 77.5276,
        "capacity": 300,
        "price_per_hour": 50.0,
        "supported_vehicles": "both",
        "opening_time": "10:00",
        "closing_time": "23:00",
        "is_24_hours": False,
    },
    {
        "name": "Alpha 1 Commercial Belt Lot",
        "address": "Alpha 1 Commercial Market, Block C, Greater Noida",
        "area": "Alpha 1",
        "lot_type": "market",
        "latitude": 28.4744,
        "longitude": 77.5039,
        "capacity": 120,
        "price_per_hour": 20.0,
        "supported_vehicles": "both",
        "opening_time": "07:00",
        "closing_time": "22:30",
        "is_24_hours": False,
    },
    {
        "name": "Alpha 1 Metro Station Two-Wheeler Bay",
        "address": "Alpha 1 Metro Gate 2, Greater Noida",
        "area": "Alpha 1",
        "lot_type": "transit",
        "latitude": 28.4768,
        "longitude": 77.5064,
        "capacity": 95,
        "price_per_hour": 10.0,
        "supported_vehicles": "bike",
        "opening_time": "05:30",
        "closing_time": "23:00",
        "is_24_hours": False,
    },
    {
        "name": "Omaxe Connaught Place Parking",
        "address": "Beta 2, H Block, Omaxe CP, Greater Noida",
        "area": "Beta 2",
        "lot_type": "mall",
        "latitude": 28.4819,
        "longitude": 77.5158,
        "capacity": 260,
        "price_per_hour": 40.0,
        "supported_vehicles": "both",
        "opening_time": "09:30",
        "closing_time": "23:00",
        "is_24_hours": False,
    },
    {
        "name": "Jagat Farm Market Surface Lot",
        "address": "Jagat Farm Main Market, Gamma 1, Greater Noida",
        "area": "Gamma 1",
        "lot_type": "market",
        "latitude": 28.4832,
        "longitude": 77.5015,
        "capacity": 85,
        "price_per_hour": 20.0,
        "supported_vehicles": "both",
        "opening_time": "08:00",
        "closing_time": "22:00",
        "is_24_hours": False,
    },
    {
        "name": "India Expo Centre & Mart Gate 1",
        "address": "Plot 25-29, Knowledge Park II, Greater Noida",
        "area": "Knowledge Park II",
        "lot_type": "office",
        "latitude": 28.4622,
        "longitude": 77.4956,
        "capacity": 280,
        "price_per_hour": 60.0,
        "supported_vehicles": "car",
        "opening_time": "00:00",
        "closing_time": "24:00",
        "is_24_hours": True,
    },
    {
        "name": "Knowledge Park II Metro Commuter Lot",
        "address": "Knowledge Park II Metro Station, Greater Noida",
        "area": "Knowledge Park II",
        "lot_type": "transit",
        "latitude": 28.4601,
        "longitude": 77.4999,
        "capacity": 150,
        "price_per_hour": 20.0,
        "supported_vehicles": "both",
        "opening_time": "00:00",
        "closing_time": "24:00",
        "is_24_hours": True,
    },
    {
        "name": "Stellar IT Park Multi-Level Car Deck",
        "address": "Plot 12, Knowledge Park III, Greater Noida",
        "area": "Knowledge Park III",
        "lot_type": "office",
        "latitude": 28.4721,
        "longitude": 77.4841,
        "capacity": 210,
        "price_per_hour": 45.0,
        "supported_vehicles": "car",
        "opening_time": "06:30",
        "closing_time": "22:00",
        "is_24_hours": False,
    },
    {
        "name": "Sharda Campus Academic Gate Bay",
        "address": "Plot 32-34, Knowledge Park III, Greater Noida",
        "area": "Knowledge Park III",
        "lot_type": "campus",
        "latitude": 28.4737,
        "longitude": 77.4822,
        "capacity": 140,
        "price_per_hour": 15.0,
        "supported_vehicles": "both",
        "opening_time": "07:00",
        "closing_time": "20:30",
        "is_24_hours": False,
    },
    {
        "name": "Ansal Plaza Mall Forecourt",
        "address": "Site IV, Pari Chowk Extension, Greater Noida",
        "area": "Pari Chowk",
        "lot_type": "mall",
        "latitude": 28.4639,
        "longitude": 77.5194,
        "capacity": 190,
        "price_per_hour": 35.0,
        "supported_vehicles": "both",
        "opening_time": "10:00",
        "closing_time": "22:30",
        "is_24_hours": False,
    },
    {
        "name": "Beta 1 Sector Shopping Square",
        "address": "Beta 1 Main Market Road, Greater Noida",
        "area": "Beta 1",
        "lot_type": "market",
        "latitude": 28.4779,
        "longitude": 77.5117,
        "capacity": 65,
        "price_per_hour": 15.0,
        "supported_vehicles": "both",
        "opening_time": "08:00",
        "closing_time": "22:00",
        "is_24_hours": False,
    },
    {
        "name": "Alpha 2 Commercial Hub Lot",
        "address": "Alpha 2 Sector Market, Near Gol Chakkar, Greater Noida",
        "area": "Alpha 2",
        "lot_type": "market",
        "latitude": 28.4728,
        "longitude": 77.5162,
        "capacity": 90,
        "price_per_hour": 25.0,
        "supported_vehicles": "both",
        "opening_time": "07:30",
        "closing_time": "22:00",
        "is_24_hours": False,
    },
    {
        "name": "Delta 1 Metro Park & Ride",
        "address": "Delta 1 Metro Station, Surajpur-Kasna Road, Greater Noida",
        "area": "Delta 1",
        "lot_type": "transit",
        "latitude": 28.4867,
        "longitude": 77.5236,
        "capacity": 160,
        "price_per_hour": 20.0,
        "supported_vehicles": "both",
        "opening_time": "00:00",
        "closing_time": "24:00",
        "is_24_hours": True,
    },
    {
        "name": "Surajpur District Complex Visitor Lot",
        "address": "Collectorate Road, Surajpur, Greater Noida",
        "area": "Surajpur",
        "lot_type": "office",
        "latitude": 28.5082,
        "longitude": 77.4889,
        "capacity": 130,
        "price_per_hour": 20.0,
        "supported_vehicles": "both",
        "opening_time": "08:00",
        "closing_time": "19:30",
        "is_24_hours": False,
    },
    {
        "name": "Galgotias Innovation Hub Bike Stand",
        "address": "Knowledge Park II North Wing, Greater Noida",
        "area": "Knowledge Park II",
        "lot_type": "campus",
        "latitude": 28.4659,
        "longitude": 77.4927,
        "capacity": 70,
        "price_per_hour": 10.0,
        "supported_vehicles": "bike",
        "opening_time": "07:30",
        "closing_time": "20:00",
        "is_24_hours": False,
    },
    {
        "name": "MSX Mall Commercial Plaza",
        "address": "Swarn Nagari, Sector Alpha II Road, Greater Noida",
        "area": "Swarn Nagari",
        "lot_type": "mall",
        "latitude": 28.4685,
        "longitude": 77.5284,
        "capacity": 175,
        "price_per_hour": 40.0,
        "supported_vehicles": "car",
        "opening_time": "09:30",
        "closing_time": "23:00",
        "is_24_hours": False,
    },
    {
        "name": "Jaypee Greens Sector Pi Plaza",
        "address": "Sector Pi-1, Near Eldeco Green Meadows, Greater Noida",
        "area": "Sector Pi",
        "lot_type": "market",
        "latitude": 28.4596,
        "longitude": 77.5372,
        "capacity": 45,
        "price_per_hour": 30.0,
        "supported_vehicles": "both",
        "opening_time": "00:00",
        "closing_time": "24:00",
        "is_24_hours": True,
    },
]


def _gaussian_bump(hours: np.ndarray, center: float, width: float, amplitude: float) -> np.ndarray:
    return amplitude * np.exp(-0.5 * ((hours - center) / width) ** 2)


def _generate_lot_occupancy_curve(
    lot_type: str,
    capacity: int,
    timestamps: pd.DatetimeIndex,
    rng: np.random.Generator,
    opening_time: str,
    closing_time: str,
    is_24_hours: bool,
) -> np.ndarray:
    hours = timestamps.hour + timestamps.minute / 60.0
    dow = timestamps.dayofweek
    is_weekend = (dow >= 5).astype(float)
    is_weekday = 1.0 - is_weekend

    base = np.full(len(timestamps), 0.14)

    if lot_type == "office":
        weekday_curve = (
            _gaussian_bump(hours, 11.2, 2.2, 0.56)
            + _gaussian_bump(hours, 15.5, 2.5, 0.52)
        )
        weekend_curve = _gaussian_bump(hours, 14.0, 3.0, 0.14)
        rate = base + is_weekday * weekday_curve + is_weekend * weekend_curve
    elif lot_type == "mall":
        weekday_curve = (
            _gaussian_bump(hours, 14.0, 2.2, 0.30)
            + _gaussian_bump(hours, 19.5, 2.0, 0.52)
        )
        weekend_curve = (
            _gaussian_bump(hours, 14.5, 2.5, 0.52)
            + _gaussian_bump(hours, 19.8, 2.2, 0.68)
        )
        rate = base + is_weekday * weekday_curve + is_weekend * weekend_curve
    elif lot_type == "market":
        weekday_curve = (
            _gaussian_bump(hours, 11.5, 1.8, 0.42)
            + _gaussian_bump(hours, 18.8, 1.9, 0.60)
        )
        weekend_curve = (
            _gaussian_bump(hours, 12.0, 2.0, 0.54)
            + _gaussian_bump(hours, 19.0, 2.0, 0.66)
        )
        rate = base + is_weekday * weekday_curve + is_weekend * weekend_curve
    elif lot_type == "transit":
        weekday_curve = (
            _gaussian_bump(hours, 9.2, 1.6, 0.65)
            + _gaussian_bump(hours, 14.0, 3.0, 0.50)
            + _gaussian_bump(hours, 18.5, 1.7, 0.58)
        )
        weekend_curve = _gaussian_bump(hours, 13.5, 3.5, 0.35)
        rate = 0.16 + is_weekday * weekday_curve + is_weekend * weekend_curve
    else:  # campus
        weekday_curve = (
            _gaussian_bump(hours, 10.5, 2.1, 0.62)
            + _gaussian_bump(hours, 14.5, 2.0, 0.48)
        )
        is_saturday = (dow == 5).astype(float)
        sat_curve = _gaussian_bump(hours, 11.5, 2.5, 0.30)
        rate = 0.08 + is_weekday * weekday_curve + is_saturday * sat_curve

    # Smooth day-to-day variation + short-horizon autocorrelated noise
    noise = rng.normal(0.0, 0.045, size=len(timestamps))
    rate = np.clip(rate + noise, 0.03, 0.98)

    # Reduce occupancy sharply outside opening hours for non-24h lots
    if not is_24_hours:
        open_h = int(opening_time.split(":")[0]) + int(opening_time.split(":")[1]) / 60.0
        close_h = int(closing_time.split(":")[0]) + int(closing_time.split(":")[1]) / 60.0
        closed_mask = (hours < open_h) | (hours > close_h)
        rate = np.where(closed_mask, np.clip(rng.normal(0.03, 0.015, size=len(timestamps)), 0.0, 0.08), rate)

    return np.round(rate * capacity).astype(int)


def seed_greater_noida_data(db: Session, force: bool = False) -> dict:
    existing_count = db.query(ParkingLot).count()
    if existing_count > 0 and not force:
        hist_count = db.query(HistoricalOccupancy).count()
        if hist_count > 0:
            return {
                "seeded": False,
                "message": "Database already seeded with Greater Noida parking lots.",
                "lots_count": existing_count,
                "historical_count": hist_count,
            }
        raw_count = db.query(OccupancyRecord).count()
        if raw_count > 0:
            pipeline_result = run_data_pipeline(db, reprocess_all=True)
            return {
                "seeded": False,
                "recovered_pipeline": True,
                "lots_count": existing_count,
                "pipeline_result": pipeline_result,
            }
        force = True

    if force:
        db.query(HistoricalOccupancy).delete()
        db.query(OccupancyRecord).delete()
        db.query(ParkingLot).delete()
        db.commit()

    lots = []
    for lot_data in GREATER_NOIDA_LOTS:
        lot = ParkingLot(**lot_data)
        db.add(lot)
        lots.append(lot)
    db.commit()
    for lot in lots:
        db.refresh(lot)

    # Generate 6 weeks (42 days) at 15-minute intervals ending at current 15-min mark
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    end_ts = pd.Timestamp(now).floor("15min")
    start_ts = end_ts - pd.Timedelta(days=42) + pd.Timedelta(minutes=15)
    timestamps = pd.date_range(start=start_ts, end=end_ts, freq="15min")

    rng = np.random.default_rng(42)
    raw_mappings = []

    for lot in lots:
        occupied_arr = _generate_lot_occupancy_curve(
            lot_type=lot.lot_type,
            capacity=lot.capacity,
            timestamps=timestamps,
            rng=rng,
            opening_time=lot.opening_time,
            closing_time=lot.closing_time,
            is_24_hours=lot.is_24_hours,
        )
        ts_py = [t.to_pydatetime() for t in timestamps]
        for idx, (ts_val, occ_val) in enumerate(zip(ts_py, occupied_arr)):
            # Introduce a small deterministic set of missing values (0.2%) so the pipeline demonstrates real imputation
            is_missing = (idx % 503 == 0) and (lot.id % 3 == 0)
            raw_mappings.append(
                {
                    "lot_id": lot.id,
                    "timestamp": ts_val,
                    "occupied_slots": None if is_missing else int(occ_val),
                    "capacity_snapshot": lot.capacity,
                    "occupancy_rate": None if is_missing else round(float(occ_val) / lot.capacity, 4),
                    "source_type": "simulated",
                    "is_processed": False,
                    "created_at": now,
                }
            )

    # Bulk insert in chunks
    chunk_size = 5000
    for start in range(0, len(raw_mappings), chunk_size):
        db.bulk_insert_mappings(OccupancyRecord, raw_mappings[start : start + chunk_size])
    db.commit()

    pipeline_result = run_data_pipeline(db, reprocess_all=False)

    return {
        "seeded": True,
        "lots_count": len(lots),
        "raw_simulated_records_created": len(raw_mappings),
        "pipeline_result": pipeline_result,
    }
