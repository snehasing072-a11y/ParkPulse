import { useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Bike,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  Footprints,
  LocateFixed,
  MapPin,
  Search,
} from 'lucide-react';
import { ApiValidationError, submitSearch } from '../api/client';
import type { PreferenceType, SearchRecord, VehicleType } from '../types/parking';
import type { UserCoordinates } from './ParkingMap';

interface SearchFormProps {
  onSearchSaved: (record: SearchRecord) => void;
  onCoordinatesDetected?: (coords: UserCoordinates) => void;
  recentSearches: SearchRecord[];
}

interface FormErrors {
  destination?: string;
  arrival_date?: string;
  arrival_time?: string;
  duration_minutes?: string;
  max_walking_distance_m?: string;
  general?: string;
}

const PRESET_DESTINATIONS = [
  'Pari Chowk, Greater Noida',
  'The Grand Venice Mall, Site IV',
  'Alpha 1 Commercial Belt',
  'Knowledge Park II Metro',
];

const PREFERENCE_OPTIONS: { value: PreferenceType; label: string }[] = [
  { value: 'best_match', label: 'Best Match' },
  { value: 'cheapest', label: 'Cheapest' },
  { value: 'nearest', label: 'Nearest' },
  { value: 'best_availability', label: 'Best Availability' },
];

function getDefaultArrivalValues() {
  const future = new Date(Date.now() + 30 * 60 * 1000);
  const year = future.getFullYear();
  const month = String(future.getMonth() + 1).padStart(2, '0');
  const day = String(future.getDate()).padStart(2, '0');
  const hours = String(future.getHours()).padStart(2, '0');
  const minutes = String(future.getMinutes()).padStart(2, '0');
  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
  };
}

export function SearchForm({ onSearchSaved, onCoordinatesDetected, recentSearches }: SearchFormProps) {
  const defaults = getDefaultArrivalValues();

  const [destination, setDestination] = useState('');
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({
    lat: null,
    lng: null,
  });
  const [geoNotice, setGeoNotice] = useState<string | null>(null);
  const [arrivalDate, setArrivalDate] = useState(defaults.date);
  const [arrivalTime, setArrivalTime] = useState(defaults.time);
  const [vehicleType, setVehicleType] = useState<VehicleType>('car');
  const [durationMinutes, setDurationMinutes] = useState<string>('120');
  const [maxWalkingMeters, setMaxWalkingMeters] = useState<string>('800');
  const [preference, setPreference] = useState<PreferenceType>('best_match');

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedSearch, setSavedSearch] = useState<SearchRecord | null>(null);

  function validateLocally(): FormErrors {
    const nextErrors: FormErrors = {};
    const trimmedDest = destination.trim();

    if (!trimmedDest) {
      nextErrors.destination = 'Enter a destination in Greater Noida (e.g., Pari Chowk or Alpha 1).';
    } else if (trimmedDest.length < 3) {
      nextErrors.destination = 'Destination must be at least 3 characters long.';
    } else if (/^\d+$/.test(trimmedDest)) {
      nextErrors.destination = 'Destination cannot be numbers only. Enter a sector, street, or landmark.';
    }

    if (!arrivalDate) {
      nextErrors.arrival_date = 'Select an arrival date.';
    }
    if (!arrivalTime) {
      nextErrors.arrival_time = 'Select an arrival time.';
    }
    if (arrivalDate && arrivalTime) {
      const chosen = new Date(`${arrivalDate}T${arrivalTime}`);
      if (Number.isNaN(chosen.getTime())) {
        nextErrors.arrival_date = 'Enter a valid arrival date and time.';
      } else {
        const minAllowed = new Date(Date.now() - 15 * 60 * 1000);
        const maxAllowed = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        if (chosen < minAllowed) {
          nextErrors.arrival_time = 'Arrival time cannot be in the past.';
        } else if (chosen > maxAllowed) {
          nextErrors.arrival_date = 'Arrival date cannot be more than 30 days ahead.';
        }
      }
    }

    const durNum = Number(durationMinutes);
    if (!Number.isFinite(durNum) || durNum < 15 || durNum > 1440) {
      nextErrors.duration_minutes = 'Duration must be between 15 and 1,440 minutes (24 hours).';
    }

    const walkNum = Number(maxWalkingMeters);
    if (!Number.isFinite(walkNum) || walkNum < 100 || walkNum > 5000) {
      nextErrors.max_walking_distance_m = 'Walking distance must be between 100 m and 5,000 m.';
    }

    return nextErrors;
  }

  function handleUseCurrentLocation() {
    setGeoNotice(null);
    if (!navigator.geolocation) {
      setGeoNotice('Geolocation is unavailable in this browser. Enter your Greater Noida destination manually.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));
        setCoords({ lat, lng });
        setDestination(`Current Location (${lat}, ${lng})`);
        onCoordinatesDetected?.({
          lat,
          lng,
          accuracyMeters: Math.round(pos.coords.accuracy),
          label: 'Your Live GPS Location',
          isLiveGps: true,
        });
        setGeoNotice('Coordinates captured and synced with the live map. You can refine the destination name manually if needed.');
        setErrors((prev) => ({ ...prev, destination: undefined }));
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoNotice('Location permission was denied. Please enter your Greater Noida destination manually.');
        } else {
          setGeoNotice('Could not detect your location. Please enter your destination manually.');
        }
      },
      { timeout: 6000 },
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSavedSearch(null);

    const localErrors = validateLocally();
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const record = await submitSearch({
        destination: destination.trim(),
        destination_lat: coords.lat,
        destination_lng: coords.lng,
        arrival_date: arrivalDate,
        arrival_time: arrivalTime,
        vehicle_type: vehicleType,
        duration_minutes: Number(durationMinutes),
        max_walking_distance_m: Number(maxWalkingMeters),
        preference,
      });
      setSavedSearch(record);
      onSearchSaved(record);
    } catch (err) {
      if (err instanceof ApiValidationError) {
        const mapped: FormErrors = { general: err.message };
        for (const item of err.errors) {
          if (item.field === 'destination') mapped.destination = item.message;
          else if (item.field === 'arrival_date') mapped.arrival_date = item.message;
          else if (item.field === 'arrival_time') mapped.arrival_time = item.message;
          else if (item.field === 'duration_minutes') mapped.duration_minutes = item.message;
          else if (item.field === 'max_walking_distance_m') mapped.max_walking_distance_m = item.message;
          else mapped.general = item.message;
        }
        setErrors(mapped);
      } else {
        setErrors({
          general: err instanceof Error ? err.message : 'Unable to reach the FastAPI search service.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      id="search-form-card"
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#101828]">Plan Your Arrival</h2>
          <p className="text-sm text-slate-500">
            Search validated against Greater Noida parking lots and saved in PostgreSQL.
          </p>
        </div>
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-[#F5F7FA] px-3 py-1.5 text-xs font-medium text-[#101828] transition-colors hover:border-[#00D4E5] hover:bg-white"
        >
          <LocateFixed className="h-3.5 w-3.5 text-[#00B8C8]" />
          Use My Location
        </button>
      </div>

      {geoNotice && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#F59E0B]" />
          <span>{geoNotice}</span>
        </div>
      )}

      {errors.general && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#EF4444]" />
          <span>{errors.general}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="destination" className="mb-1.5 block text-xs font-semibold text-slate-700">
            Destination in Greater Noida
          </label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="destination"
              type="text"
              value={destination}
              onChange={(e) => {
                setDestination(e.target.value);
                setCoords({ lat: null, lng: null });
                if (errors.destination) setErrors((prev) => ({ ...prev, destination: undefined }));
              }}
              placeholder="e.g. Pari Chowk, Alpha 1 Market, Knowledge Park II"
              className={`w-full rounded-lg border bg-white py-2.5 pl-9 pr-3 text-sm text-[#101828] placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                errors.destination
                  ? 'border-[#EF4444] focus:ring-[#EF4444]/20'
                  : 'border-slate-300 focus:border-[#00B8C8] focus:ring-[#00D4E5]/20'
              }`}
            />
          </div>
          {errors.destination && (
            <p className="mt-1 text-xs font-medium text-[#EF4444]">{errors.destination}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESET_DESTINATIONS.map((place) => (
              <button
                key={place}
                type="button"
                onClick={() => {
                  setDestination(place);
                  setCoords({ lat: null, lng: null });
                  setErrors((prev) => ({ ...prev, destination: undefined }));
                }}
                className="rounded-md bg-[#F5F7FA] px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-[#101828]"
              >
                {place}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="arrival-date" className="mb-1.5 block text-xs font-semibold text-slate-700">
              Arrival Date
            </label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="arrival-date"
                type="date"
                value={arrivalDate}
                onChange={(e) => {
                  setArrivalDate(e.target.value);
                  if (errors.arrival_date) setErrors((prev) => ({ ...prev, arrival_date: undefined }));
                }}
                className={`w-full rounded-lg border bg-white py-2.5 pl-9 pr-3 text-sm tabular-nums text-[#101828] focus:outline-none focus:ring-2 ${
                  errors.arrival_date
                    ? 'border-[#EF4444] focus:ring-[#EF4444]/20'
                    : 'border-slate-300 focus:border-[#00B8C8] focus:ring-[#00D4E5]/20'
                }`}
              />
            </div>
            {errors.arrival_date && (
              <p className="mt-1 text-xs font-medium text-[#EF4444]">{errors.arrival_date}</p>
            )}
          </div>

          <div>
            <label htmlFor="arrival-time" className="mb-1.5 block text-xs font-semibold text-slate-700">
              Arrival Time
            </label>
            <div className="relative">
              <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="arrival-time"
                type="time"
                value={arrivalTime}
                onChange={(e) => {
                  setArrivalTime(e.target.value);
                  if (errors.arrival_time) setErrors((prev) => ({ ...prev, arrival_time: undefined }));
                }}
                className={`w-full rounded-lg border bg-white py-2.5 pl-9 pr-3 text-sm tabular-nums text-[#101828] focus:outline-none focus:ring-2 ${
                  errors.arrival_time
                    ? 'border-[#EF4444] focus:ring-[#EF4444]/20'
                    : 'border-slate-300 focus:border-[#00B8C8] focus:ring-[#00D4E5]/20'
                }`}
              />
            </div>
            {errors.arrival_time && (
              <p className="mt-1 text-xs font-medium text-[#EF4444]">{errors.arrival_time}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">Vehicle Type</span>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#F5F7FA] p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setVehicleType('car')}
                className={`inline-flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-semibold transition-colors ${
                  vehicleType === 'car'
                    ? 'bg-white text-[#101828] shadow-sm'
                    : 'text-slate-600 hover:text-[#101828]'
                }`}
              >
                <Car className="h-3.5 w-3.5" />
                Car
              </button>
              <button
                type="button"
                onClick={() => setVehicleType('bike')}
                className={`inline-flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-semibold transition-colors ${
                  vehicleType === 'bike'
                    ? 'bg-white text-[#101828] shadow-sm'
                    : 'text-slate-600 hover:text-[#101828]'
                }`}
              >
                <Bike className="h-3.5 w-3.5" />
                Bike
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="duration-minutes" className="mb-1.5 block text-xs font-semibold text-slate-700">
              Expected Duration (min)
            </label>
            <input
              id="duration-minutes"
              type="number"
              min={15}
              max={1440}
              step={15}
              value={durationMinutes}
              onChange={(e) => {
                setDurationMinutes(e.target.value);
                if (errors.duration_minutes) setErrors((prev) => ({ ...prev, duration_minutes: undefined }));
              }}
              className={`w-full rounded-lg border bg-white px-3 py-2 text-sm tabular-nums text-[#101828] focus:outline-none focus:ring-2 ${
                errors.duration_minutes
                  ? 'border-[#EF4444] focus:ring-[#EF4444]/20'
                  : 'border-slate-300 focus:border-[#00B8C8] focus:ring-[#00D4E5]/20'
              }`}
            />
            {errors.duration_minutes && (
              <p className="mt-1 text-xs font-medium text-[#EF4444]">{errors.duration_minutes}</p>
            )}
          </div>

          <div>
            <label htmlFor="max-walk" className="mb-1.5 block text-xs font-semibold text-slate-700">
              Max Walking Distance (m)
            </label>
            <div className="relative">
              <Footprints className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="max-walk"
                type="number"
                min={100}
                max={5000}
                step={100}
                value={maxWalkingMeters}
                onChange={(e) => {
                  setMaxWalkingMeters(e.target.value);
                  if (errors.max_walking_distance_m) {
                    setErrors((prev) => ({ ...prev, max_walking_distance_m: undefined }));
                  }
                }}
                className={`w-full rounded-lg border bg-white py-2 pl-9 pr-3 text-sm tabular-nums text-[#101828] focus:outline-none focus:ring-2 ${
                  errors.max_walking_distance_m
                    ? 'border-[#EF4444] focus:ring-[#EF4444]/20'
                    : 'border-slate-300 focus:border-[#00B8C8] focus:ring-[#00D4E5]/20'
                }`}
              />
            </div>
            {errors.max_walking_distance_m && (
              <p className="mt-1 text-xs font-medium text-[#EF4444]">{errors.max_walking_distance_m}</p>
            )}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">Priority Preference</span>
          <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-slate-200 bg-[#F5F7FA] p-1 sm:grid-cols-4">
            {PREFERENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPreference(opt.value)}
                className={`whitespace-nowrap rounded-md px-2.5 py-2 text-xs font-semibold transition-colors ${
                  preference === opt.value
                    ? 'bg-white text-[#101828] shadow-sm'
                    : 'text-slate-600 hover:text-[#101828]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#00D4E5] px-5 py-3 text-sm font-bold text-[#101828] transition-colors hover:bg-[#00BFD0] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#101828]"
        >
          <Search className="h-4 w-4" />
          {isSubmitting ? 'Validating & Saving Search...' : 'Search Parking'}
        </button>
      </form>

      {savedSearch && (
        <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-[#101828]">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#22C55E]" />
            <div className="space-y-1">
              <p className="font-semibold">
                Search #{savedSearch.id} validated and stored in database
              </p>
              <p className="text-xs text-slate-700 tabular-nums">
                {savedSearch.destination} · {new Date(savedSearch.arrival_time).toLocaleString()} ·{' '}
                {savedSearch.vehicle_type.toUpperCase()} · {savedSearch.duration_minutes} min · Max{' '}
                {savedSearch.max_walking_distance_m} m · Preference:{' '}
                {savedSearch.preference.replace('_', ' ')}
              </p>
              <p className="text-xs text-slate-600">
                Browse the 18 seeded Greater Noida parking lots and simulated occupancy baseline below.
              </p>
            </div>
          </div>
        </div>
      )}

      {recentSearches.length > 0 && (
        <div className="mt-5 border-t border-slate-200 pt-4">
          <p className="mb-2 text-xs font-semibold text-slate-500">Recent Validated Searches</p>
          <div className="space-y-1.5">
            {recentSearches.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600"
              >
                <span className="font-medium text-[#101828] truncate max-w-[260px]">
                  {item.destination}
                </span>
                <span className="font-mono tabular-nums text-slate-500">
                  {item.vehicle_type.toUpperCase()} · {item.duration_minutes}m · {item.max_walking_distance_m}m walk
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
