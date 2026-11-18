export type VehicleType = 'car' | 'bike';
export type PreferenceType = 'best_match' | 'cheapest' | 'nearest' | 'best_availability';

export interface SearchPayload {
  destination: string;
  destination_lat: number | null;
  destination_lng: number | null;
  arrival_date: string;
  arrival_time: string;
  vehicle_type: VehicleType;
  duration_minutes: number;
  max_walking_distance_m: number;
  preference: PreferenceType;
}

export interface SearchRecord {
  id: number;
  destination: string;
  destination_lat: number | null;
  destination_lng: number | null;
  arrival_time: string;
  vehicle_type: VehicleType;
  duration_minutes: number;
  max_walking_distance_m: number;
  preference: PreferenceType;
  created_at: string;
}

export interface ValidationFieldError {
  field: string;
  message: string;
}

export interface ParkingLot {
  id: number;
  name: string;
  address: string;
  area: string;
  lot_type: string;
  latitude: number;
  longitude: number;
  capacity: number;
  price_per_hour: number;
  supported_vehicles: 'car' | 'bike' | 'both';
  opening_time: string;
  closing_time: string;
  is_24_hours: boolean;
  latest_occupied_slots: number | null;
  latest_free_slots: number | null;
  latest_occupancy_rate: number | null;
  availability_source: 'Live' | 'Predicted' | 'Baseline' | 'Unknown';
  data_label: string;
  latest_timestamp: string | null;
}

export interface LotOccupancyPoint {
  timestamp: string;
  occupied_slots: number;
  free_slots: number;
  occupancy_rate: number;
  source_type: string;
}

export interface LotDetailResponse {
  lot: Omit<
    ParkingLot,
    | 'latest_occupied_slots'
    | 'latest_free_slots'
    | 'latest_occupancy_rate'
    | 'availability_source'
    | 'data_label'
    | 'latest_timestamp'
  >;
  availability_source: 'Live' | 'Predicted' | 'Baseline' | 'Unknown';
  data_label: string;
  recent_24h: LotOccupancyPoint[];
}

export interface PipelineStatus {
  database_engine: string;
  total_lots: number;
  total_raw_occupancy_records: number;
  unprocessed_occupancy_records: number;
  total_historical_records: number;
  simulated_records: number;
  live_records: number;
  earliest_timestamp: string | null;
  latest_timestamp: string | null;
  tables: string[];
}

export interface PipelineRunResult {
  status: string;
  raw_records_read: number;
  invalid_dropped: number;
  duplicates_removed: number;
  missing_imputed: number;
  records_normalised_stored: number;
  total_historical_rows: number;
  source_types: string[];
  executed_at: string;
}
