from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from backend.database import Base


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(32), default="user", nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    searches = relationship("Search", back_populates="user")
    activities = relationship("ParkingActivity", back_populates="user")
    checkins = relationship("Checkin", back_populates="user")


class ParkingLot(Base):
    __tablename__ = "parking_lots"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(160), nullable=False, unique=True)
    address = Column(String(255), nullable=False)
    area = Column(String(100), nullable=False)
    lot_type = Column(String(40), nullable=False)  # market, office, mall, transit, campus
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    capacity = Column(Integer, nullable=False)
    price_per_hour = Column(Float, nullable=False)
    supported_vehicles = Column(String(20), nullable=False)  # car, bike, both
    opening_time = Column(String(10), nullable=False)  # HH:MM
    closing_time = Column(String(10), nullable=False)  # HH:MM or 24:00
    is_24_hours = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    occupancy_records = relationship("OccupancyRecord", back_populates="lot", cascade="all, delete-orphan")
    historical_occupancy = relationship("HistoricalOccupancy", back_populates="lot", cascade="all, delete-orphan")
    predictions = relationship("Prediction", back_populates="lot", cascade="all, delete-orphan")


class OccupancyRecord(Base):
    __tablename__ = "occupancy_records"

    id = Column(Integer, primary_key=True, index=True)
    lot_id = Column(Integer, ForeignKey("parking_lots.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    occupied_slots = Column(Integer, nullable=True)
    capacity_snapshot = Column(Integer, nullable=False)
    occupancy_rate = Column(Float, nullable=True)
    source_type = Column(String(32), nullable=False, index=True)  # simulated, live, feedback, historical
    is_processed = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    lot = relationship("ParkingLot", back_populates="occupancy_records")

    __table_args__ = (
        Index("ix_occ_lot_ts_src", "lot_id", "timestamp", "source_type"),
    )


class HistoricalOccupancy(Base):
    __tablename__ = "historical_occupancy"

    id = Column(Integer, primary_key=True, index=True)
    lot_id = Column(Integer, ForeignKey("parking_lots.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    occupied_slots = Column(Integer, nullable=False)
    capacity = Column(Integer, nullable=False)
    occupancy_rate = Column(Float, nullable=False)
    hour = Column(Integer, nullable=False)
    minute_bin = Column(Integer, nullable=False)
    day_of_week = Column(Integer, nullable=False)
    is_weekend = Column(Boolean, nullable=False)
    source_type = Column(String(32), nullable=False)  # simulated, live, historical
    created_at = Column(DateTime, default=utc_now, nullable=False)

    lot = relationship("ParkingLot", back_populates="historical_occupancy")

    __table_args__ = (
        UniqueConstraint("lot_id", "timestamp", "source_type", name="uq_hist_lot_ts_src"),
        Index("ix_hist_lot_dow_hour", "lot_id", "day_of_week", "hour", "minute_bin"),
    )


class Search(Base):
    __tablename__ = "searches"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    destination = Column(String(255), nullable=False)
    destination_lat = Column(Float, nullable=True)
    destination_lng = Column(Float, nullable=True)
    arrival_time = Column(DateTime, nullable=False)
    vehicle_type = Column(String(20), nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    max_walking_distance_m = Column(Integer, nullable=False)
    preference = Column(String(32), nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    user = relationship("User", back_populates="searches")


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    lot_id = Column(Integer, ForeignKey("parking_lots.id", ondelete="CASCADE"), nullable=False, index=True)
    target_timestamp = Column(DateTime, nullable=False, index=True)
    predicted_occupied_slots = Column(Integer, nullable=False)
    predicted_free_slots = Column(Integer, nullable=False)
    lower_bound_slots = Column(Integer, nullable=True)
    upper_bound_slots = Column(Integer, nullable=True)
    confidence = Column(Float, nullable=True)
    source_type = Column(String(32), nullable=False)  # Predicted, Baseline, Live, Unknown
    model_version = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    lot = relationship("ParkingLot", back_populates="predictions")


class ParkingActivity(Base):
    __tablename__ = "parking_activities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    lot_id = Column(Integer, ForeignKey("parking_lots.id", ondelete="CASCADE"), nullable=False)
    search_id = Column(Integer, ForeignKey("searches.id", ondelete="SET NULL"), nullable=True)
    action_type = Column(String(32), nullable=False)
    vehicle_type = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    user = relationship("User", back_populates="activities")


class Checkin(Base):
    __tablename__ = "checkins"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    lot_id = Column(Integer, ForeignKey("parking_lots.id", ondelete="CASCADE"), nullable=False)
    vehicle_type = Column(String(20), nullable=False)
    checkin_time = Column(DateTime, nullable=False)
    checkout_time = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    verification_status = Column(String(32), default="unverified", nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    user = relationship("User", back_populates="checkins")


class ModelMetric(Base):
    __tablename__ = "model_metrics"

    id = Column(Integer, primary_key=True, index=True)
    model_name = Column(String(64), nullable=False)
    mae = Column(Float, nullable=False)
    rmse = Column(Float, nullable=False)
    baseline_mae = Column(Float, nullable=True)
    baseline_rmse = Column(Float, nullable=True)
    dataset_source = Column(String(32), default="simulated", nullable=False)
    sample_count = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=False, nullable=False)
    trained_at = Column(DateTime, default=utc_now, nullable=False)
