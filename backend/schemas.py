from datetime import datetime, timedelta
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator


VehicleType = Literal["car", "bike"]
PreferenceType = Literal["best_match", "cheapest", "nearest", "best_availability"]


class SearchCreate(BaseModel):
    destination: str = Field(..., min_length=2, max_length=200)
    destination_lat: Optional[float] = Field(None, ge=-90.0, le=90.0)
    destination_lng: Optional[float] = Field(None, ge=-180.0, le=180.0)
    arrival_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    arrival_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    vehicle_type: VehicleType
    duration_minutes: int = Field(..., ge=15, le=1440)
    max_walking_distance_m: int = Field(..., ge=100, le=5000)
    preference: PreferenceType

    @field_validator("destination")
    @classmethod
    def validate_destination(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 3:
            raise ValueError("Destination must be at least 3 characters long.")
        if cleaned.isdigit():
            raise ValueError("Please enter a valid street, sector, or landmark in Greater Noida.")
        return cleaned

    @field_validator("arrival_time")
    @classmethod
    def validate_time_format(cls, value: str) -> str:
        parts = value.split(":")
        hh, mm = int(parts[0]), int(parts[1])
        if not (0 <= hh <= 23 and 0 <= mm <= 59):
            raise ValueError("Arrival time must be a valid 24-hour time (HH:MM).")
        return value

    def parsed_arrival_datetime(self) -> datetime:
        try:
            dt = datetime.strptime(f"{self.arrival_date} {self.arrival_time}", "%Y-%m-%d %H:%M")
        except ValueError as exc:
            raise ValueError("Invalid arrival date or time.") from exc
        if dt < datetime.now() - timedelta(minutes=15):
            raise ValueError("Arrival date and time cannot be in the past.")
        if dt > datetime.now() + timedelta(days=30):
            raise ValueError("Arrival date cannot be more than 30 days ahead.")
        return dt


class SearchResponse(BaseModel):
    id: int
    destination: str
    destination_lat: Optional[float]
    destination_lng: Optional[float]
    arrival_time: datetime
    vehicle_type: str
    duration_minutes: int
    max_walking_distance_m: int
    preference: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ParkingLotResponse(BaseModel):
    id: int
    name: str
    address: str
    area: str
    lot_type: str
    latitude: float
    longitude: float
    capacity: int
    price_per_hour: float
    supported_vehicles: str
    opening_time: str
    closing_time: str
    is_24_hours: bool
    latest_occupied_slots: Optional[int] = None
    latest_free_slots: Optional[int] = None
    latest_occupancy_rate: Optional[float] = None
    availability_source: str = "Unknown"
    data_label: str = "Simulated data"
    latest_timestamp: Optional[datetime] = None

    model_config = {"from_attributes": True}


class PipelineRunResponse(BaseModel):
    status: str
    raw_records_read: int
    invalid_dropped: int
    duplicates_removed: int
    missing_imputed: int
    records_normalised_stored: int
    total_historical_rows: int
    source_types: list[str]
    executed_at: datetime


class PipelineStatusResponse(BaseModel):
    database_engine: str
    total_lots: int
    total_raw_occupancy_records: int
    unprocessed_occupancy_records: int
    total_historical_records: int
    simulated_records: int
    live_records: int
    earliest_timestamp: Optional[datetime]
    latest_timestamp: Optional[datetime]
    tables: list[str]
