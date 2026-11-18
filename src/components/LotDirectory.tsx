import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Database,
  LocateFixed,
  MapPin,
  Play,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  fetchLotDetail,
  fetchLots,
  fetchPipelineStatus,
  runDataPipeline,
} from '../api/client';
import type {
  LotDetailResponse,
  ParkingLot,
  PipelineRunResult,
  PipelineStatus,
} from '../types/parking';
import {
  ParkingMap,
  formatDistanceLabel,
  haversineMeters,
  type UserCoordinates,
} from './ParkingMap';

interface LotDirectoryProps {
  userCoords: UserCoordinates | null;
  onUserCoordsChange: (coords: UserCoordinates | null) => void;
}

const REFERENCE_ANCHORS: { label: string; lat: number; lng: number }[] = [
  { label: 'Pari Chowk', lat: 28.4671, lng: 77.5138 },
  { label: 'Alpha 1 Market', lat: 28.4744, lng: 77.5039 },
  { label: 'Knowledge Park II', lat: 28.4622, lng: 77.4956 },
];

export function LotDirectory({ userCoords, onUserCoordsChange }: LotDirectoryProps) {
  const [lots, setLots] = useState<ParkingLot[]>([]);
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [lotTypeFilter, setLotTypeFilter] = useState<string>('all');
  const [sortByNearest, setSortByNearest] = useState<boolean>(true);
  const [loadingLots, setLoadingLots] = useState(true);
  const [lotsError, setLotsError] = useState<string | null>(null);

  const [geoStatus, setGeoStatus] = useState<string | null>(null);
  const [watchingGps, setWatchingGps] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const mapSectionRef = useRef<HTMLDivElement | null>(null);
  const [focusedLotId, setFocusedLotId] = useState<number | null>(null);

  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const [pipelineResult, setPipelineResult] = useState<PipelineRunResult | null>(null);
  const [runningPipeline, setRunningPipeline] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  const [selectedLotDetail, setSelectedLotDetail] = useState<LotDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  async function loadLots(vt = vehicleFilter, lt = lotTypeFilter) {
    setLoadingLots(true);
    setLotsError(null);
    try {
      const data = await fetchLots({ vehicle_type: vt, lot_type: lt });
      setLots(data);
    } catch (err) {
      setLotsError(err instanceof Error ? err.message : 'Failed to load seeded lots.');
    } finally {
      setLoadingLots(false);
    }
  }

  async function loadPipelineStatus() {
    try {
      const status = await fetchPipelineStatus();
      setPipelineStatus(status);
    } catch (err) {
      setPipelineError(err instanceof Error ? err.message : 'Failed to load pipeline status.');
    }
  }

  useEffect(() => {
    loadLots('all', 'all');
    loadPipelineStatus();

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  function stopLiveGps() {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setWatchingGps(false);
  }

  function startLiveGps() {
    setGeoStatus(null);
    if (!navigator.geolocation) {
      setGeoStatus('Browser geolocation is unavailable. Pick a Greater Noida reference hub below.');
      return;
    }

    if (watchingGps) {
      stopLiveGps();
      setGeoStatus('Live GPS tracking paused.');
      return;
    }

    setWatchingGps(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        onUserCoordsChange({
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5)),
          accuracyMeters: Math.round(pos.coords.accuracy),
          label: 'Your Live GPS Location',
          isLiveGps: true,
        });
        setGeoStatus(null);
      },
      (err) => {
        stopLiveGps();
        if (err.code === err.PERMISSION_DENIED) {
          setGeoStatus('Location permission denied. Select a Greater Noida area hub to preview distances on the map.');
        } else {
          setGeoStatus('Could not acquire GPS signal. Select a Greater Noida area hub below.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 8000 },
    );
  }

  function handleVehicleFilterChange(next: string) {
    setVehicleFilter(next);
    loadLots(next, lotTypeFilter);
  }

  function handleLotTypeFilterChange(next: string) {
    setLotTypeFilter(next);
    loadLots(vehicleFilter, next);
  }

  async function handleRunPipeline() {
    setRunningPipeline(true);
    setPipelineError(null);
    try {
      const res = await runDataPipeline(true);
      setPipelineResult(res);
      await Promise.all([loadPipelineStatus(), loadLots(vehicleFilter, lotTypeFilter)]);
    } catch (err) {
      setPipelineError(err instanceof Error ? err.message : 'Pipeline execution failed.');
    } finally {
      setRunningPipeline(false);
    }
  }

  async function handleInspectLot(lotId: number) {
    setLoadingDetail(true);
    try {
      const detail = await fetchLotDetail(lotId);
      setSelectedLotDetail(detail);
    } catch (err) {
      setLotsError(err instanceof Error ? err.message : 'Failed to load lot occupancy history.');
    } finally {
      setLoadingDetail(false);
    }
  }

  function getAvailabilityStatus(rate: number | null) {
    if (rate === null) {
      return {
        label: 'Unknown availability',
        shortLabel: 'Unknown',
        dotClass: 'bg-slate-400',
        textClass: 'text-slate-500',
      };
    }
    if (rate < 0.6) {
      return {
        label: 'High availability',
        shortLabel: 'High',
        dotClass: 'bg-[#22C55E]',
        textClass: 'text-[#16A34A]',
      };
    }
    if (rate < 0.85) {
      return {
        label: 'Moderate availability',
        shortLabel: 'Moderate',
        dotClass: 'bg-[#F59E0B]',
        textClass: 'text-[#D97706]',
      };
    }
    return {
      label: 'Low availability',
      shortLabel: 'Low',
      dotClass: 'bg-[#EF4444]',
      textClass: 'text-[#DC2626]',
    };
  }

  const displayedLots = useMemo(() => {
    const enriched = lots.map((lot) => ({
      lot,
      distanceMeters: userCoords
        ? haversineMeters(userCoords.lat, userCoords.lng, lot.latitude, lot.longitude)
        : null,
    }));

    if (userCoords && sortByNearest) {
      enriched.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
    }
    return enriched;
  }, [lots, userCoords, sortByNearest]);

  return (
    <>
      <section id="lot-directory" className="border-t border-slate-200 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-[#101828] sm:text-3xl">
                Greater Noida Seeded Lots & Live Map
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Loaded directly from FastAPI and the relational database. All baseline occupancy counts are marked as{' '}
                <strong className="font-semibold text-[#101828]">Simulated data</strong>.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#22C55E]" aria-hidden="true" />
                  High availability (&gt;40% free)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" aria-hidden="true" />
                  Moderate (15–40% free)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#EF4444]" aria-hidden="true" />
                  Low (&lt;15% free)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-400" aria-hidden="true" />
                  Unknown
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-[#F5F7FA] p-1">
                {[
                  { value: 'all', label: 'All Vehicles' },
                  { value: 'car', label: 'Car' },
                  { value: 'bike', label: 'Bike' },
                ].map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => handleVehicleFilterChange(tab.value)}
                    className={`whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      vehicleFilter === tab.value
                        ? 'bg-white text-[#101828] shadow-sm'
                        : 'text-slate-600 hover:text-[#101828]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <select
                aria-label="Filter by lot type"
                value={lotTypeFilter}
                onChange={(e) => handleLotTypeFilterChange(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-[#101828] focus:border-[#00B8C8] focus:outline-none"
              >
                <option value="all">All Lot Types</option>
                <option value="market">Market</option>
                <option value="office">Office</option>
                <option value="mall">Mall</option>
                <option value="transit">Transit</option>
                <option value="campus">Campus</option>
              </select>

              <button
                type="button"
                onClick={() => loadLots(vehicleFilter, lotTypeFilter)}
                className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#101828] hover:bg-[#F5F7FA]"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingLots ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-[#F5F7FA] px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={startLiveGps}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                  watchingGps
                    ? 'bg-[#00D4E5] text-[#101828]'
                    : 'bg-[#101828] text-white hover:bg-[#1D2939]'
                }`}
              >
                <LocateFixed className="h-3.5 w-3.5" />
                {watchingGps ? 'Stop Live GPS' : 'Use Live GPS'}
              </button>

              <span className="text-xs text-slate-500">or jump to Greater Noida hub:</span>

              {REFERENCE_ANCHORS.map((anchor) => {
                const isActive =
                  userCoords &&
                  !userCoords.isLiveGps &&
                  userCoords.label === anchor.label;
                return (
                  <button
                    key={anchor.label}
                    type="button"
                    onClick={() => {
                      stopLiveGps();
                      setGeoStatus(null);
                      setFocusedLotId(null);
                      onUserCoordsChange({
                        lat: anchor.lat,
                        lng: anchor.lng,
                        label: anchor.label,
                        isLiveGps: false,
                      });
                    }}
                    className={`inline-flex items-center gap-1 whitespace-nowrap shrink-0 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      isActive
                        ? 'border-[#00B8C8] bg-white text-[#101828] shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:text-[#101828]'
                    }`}
                  >
                    <MapPin className="h-3 w-3 text-[#008C99]" />
                    {anchor.label}
                  </button>
                );
              })}

              {userCoords && (
                <button
                  type="button"
                  onClick={() => {
                    stopLiveGps();
                    setFocusedLotId(null);
                    onUserCoordsChange(null);
                  }}
                  className="text-xs font-medium text-slate-500 underline hover:text-[#101828]"
                >
                  Clear pin
                </button>
              )}
            </div>

            {userCoords && (
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-[#101828]">
                <input
                  type="checkbox"
                  checked={sortByNearest}
                  onChange={(e) => setSortByNearest(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[#101828]"
                />
                Sort lots nearest to coordinates
              </label>
            )}
          </div>

          {geoStatus && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
              <AlertCircle className="h-4 w-4 shrink-0 text-[#F59E0B]" />
              <span>{geoStatus}</span>
            </div>
          )}

          <div ref={mapSectionRef} className="mt-6">
            <ParkingMap
              lots={lots}
              userCoords={userCoords}
              focusedLotId={focusedLotId}
              onSelectLot={(lotId) => setFocusedLotId(lotId)}
              onInspectLot={handleInspectLot}
              onRequestLiveGps={startLiveGps}
            />
          </div>

          {lotsError && (
            <div className="mt-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-[#EF4444]" />
              <span>{lotsError}</span>
            </div>
          )}

          {loadingLots ? (
            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-48 animate-pulse rounded-xl border border-slate-200 bg-[#F5F7FA]"
                />
              ))}
            </div>
          ) : displayedLots.length === 0 ? (
            <div className="mt-8 rounded-xl border border-slate-200 bg-[#F5F7FA] p-8 text-center">
              <p className="text-sm font-medium text-[#101828]">
                No seeded parking lots match your current filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setVehicleFilter('all');
                  setLotTypeFilter('all');
                  loadLots('all', 'all');
                }}
                className="mt-3 rounded-lg bg-[#101828] px-4 py-2 text-xs font-semibold text-white"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {displayedLots.map(({ lot, distanceMeters }) => {
                const status = getAvailabilityStatus(lot.latest_occupancy_rate);
                const isFocused = focusedLotId === lot.id;
                return (
                <article
                  key={lot.id}
                  className={`flex flex-col justify-between rounded-xl border bg-white p-5 transition-colors ${
                    isFocused
                      ? 'border-[#00B8C8] ring-2 ring-[#00D4E5]/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span>
                        {lot.area} · <span className="capitalize">{lot.lot_type}</span>
                        {distanceMeters !== null && (
                          <span className="font-mono font-semibold text-[#008C99] tabular-nums">
                            {' '}· {formatDistanceLabel(distanceMeters)}
                          </span>
                        )}
                      </span>
                      <span className="font-mono tabular-nums text-slate-500">
                        {lot.is_24_hours ? '24 Hours' : `${lot.opening_time}–${lot.closing_time}`}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${status.dotClass}`}
                        role="img"
                        aria-label={status.label}
                        title={status.label}
                      />
                      <h3 className="text-base font-semibold text-[#101828]">{lot.name}</h3>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{lot.address}</p>
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="block text-slate-500">Rate</span>
                        <span className="font-mono font-semibold text-[#101828] tabular-nums">
                          Rs {lot.price_per_hour}/hr
                        </span>
                      </div>
                      <div>
                        <span className="block text-slate-500">Capacity</span>
                        <span className="font-mono font-semibold text-[#101828] tabular-nums">
                          {lot.capacity} slots
                        </span>
                      </div>
                      <div>
                        <span className="block text-slate-500">Vehicles</span>
                        <span className="font-semibold capitalize text-[#101828]">
                          {lot.supported_vehicles === 'both' ? 'Car & Bike' : lot.supported_vehicles}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs">
                      <div>
                        <span className={`font-mono font-semibold tabular-nums ${status.textClass}`}>
                          {lot.latest_free_slots !== null
                            ? `${lot.latest_free_slots} free (${status.shortLabel})`
                            : 'Unavailable'}
                        </span>
                        <span className="ml-1.5 text-slate-500">
                          · {lot.availability_source} ({lot.data_label})
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setFocusedLotId(lot.id);
                            mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                          }}
                          className="whitespace-nowrap font-semibold text-[#101828] hover:text-[#008C99]"
                        >
                          Map
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInspectLot(lot.id)}
                          className="whitespace-nowrap font-semibold text-[#008C99] hover:text-[#101828]"
                        >
                          24h Log
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section id="pipeline" className="border-t border-slate-200 bg-[#F5F7FA] py-16">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#008C99]">
                  <Database className="h-4 w-4" />
                  <span>Relational Storage & Pandas/NumPy Pipeline</span>
                </div>
                <h2 className="mt-2 text-xl font-bold text-[#101828] sm:text-2xl">
                  Data Pipeline & Schema Status
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Validates raw occupancy records, deduplicates intervals, interpolates missing slots, normalises occupancy rates, and stores cleaned records.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRunPipeline}
                disabled={runningPipeline}
                className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-[#101828] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#1D2939] disabled:opacity-60"
              >
                <Play className="h-3.5 w-3.5 text-[#00D4E5]" />
                {runningPipeline ? 'Running Pipeline...' : 'Run Data Pipeline'}
              </button>
            </div>

            {pipelineError && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-[#EF4444]" />
                <span>{pipelineError}</span>
              </div>
            )}

            {pipelineStatus && (
              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-6 sm:grid-cols-5">
                <div>
                  <span className="block text-xs text-slate-500">Database Engine</span>
                  <span className="mt-1 block font-mono text-sm font-semibold uppercase text-[#101828]">
                    {pipelineStatus.database_engine}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500">Seeded Lots</span>
                  <span className="mt-1 block font-mono text-sm font-semibold text-[#101828] tabular-nums">
                    {pipelineStatus.total_lots}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500">Raw Occupancy Rows</span>
                  <span className="mt-1 block font-mono text-sm font-semibold text-[#101828] tabular-nums">
                    {pipelineStatus.total_raw_occupancy_records.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500">Normalised History</span>
                  <span className="mt-1 block font-mono text-sm font-semibold text-[#101828] tabular-nums">
                    {pipelineStatus.total_historical_records.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500">Simulated / Live</span>
                  <span className="mt-1 block font-mono text-sm font-semibold text-[#101828] tabular-nums">
                    {pipelineStatus.simulated_records.toLocaleString()} / {pipelineStatus.live_records}
                  </span>
                </div>
              </div>
            )}

            {pipelineStatus && (
              <div className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Database Tables ({pipelineStatus.tables.length}): </span>
                <span className="font-mono">{pipelineStatus.tables.join(', ')}</span>
              </div>
            )}

            {pipelineResult && (
              <div className="mt-5 rounded-lg border border-slate-200 bg-[#F5F7FA] p-4 text-xs text-[#101828]">
                <p className="font-semibold">
                  Last Pipeline Run ({pipelineResult.status})
                </p>
                <div className="mt-2 grid grid-cols-2 gap-3 font-mono tabular-nums sm:grid-cols-5">
                  <div>Read: {pipelineResult.raw_records_read.toLocaleString()}</div>
                  <div>Invalid Dropped: {pipelineResult.invalid_dropped}</div>
                  <div>Deduped: {pipelineResult.duplicates_removed}</div>
                  <div>Missing Imputed: {pipelineResult.missing_imputed}</div>
                  <div>Stored: {pipelineResult.records_normalised_stored.toLocaleString()}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {(selectedLotDetail || loadingDetail) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#101828]/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-[#101828]">
                  {loadingDetail ? 'Loading occupancy log...' : selectedLotDetail?.lot.name}
                </h3>
                {selectedLotDetail && (
                  <p className="text-xs text-slate-500">
                    {selectedLotDetail.availability_source} · {selectedLotDetail.data_label} · Last 24h (15-min intervals)
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedLotDetail(null)}
                aria-label="Close modal"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#101828]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto p-6">
              {loadingDetail ? (
                <div className="py-12 text-center text-sm text-slate-500">Loading records...</div>
              ) : (
                selectedLotDetail && (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2 font-semibold">Timestamp</th>
                        <th className="py-2 text-right font-semibold">Occupied</th>
                        <th className="py-2 text-right font-semibold">Free</th>
                        <th className="py-2 text-right font-semibold">Occupancy Rate</th>
                        <th className="py-2 text-right font-semibold">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                      {selectedLotDetail.recent_24h
                        .slice(-24)
                        .reverse()
                        .map((pt) => (
                          <tr key={pt.timestamp} className="hover:bg-[#F5F7FA]">
                            <td className="py-2 text-slate-700">
                              {new Date(pt.timestamp).toLocaleString()}
                            </td>
                            <td className="py-2 text-right text-[#101828]">{pt.occupied_slots}</td>
                            <td className="py-2 text-right font-semibold text-[#16A34A]">
                              {pt.free_slots}
                            </td>
                            <td className="py-2 text-right text-slate-700">
                              {(pt.occupancy_rate * 100).toFixed(1)}%
                            </td>
                            <td className="py-2 text-right text-slate-500 capitalize">
                              {pt.source_type}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
