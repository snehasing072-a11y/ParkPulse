import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertCircle, LocateFixed, Navigation } from 'lucide-react';
import type { ParkingLot } from '../types/parking';

export interface UserCoordinates {
  lat: number;
  lng: number;
  accuracyMeters?: number;
  label: string;
  isLiveGps: boolean;
}

interface ParkingMapProps {
  lots: ParkingLot[];
  userCoords: UserCoordinates | null;
  focusedLotId: number | null;
  onSelectLot: (lotId: number) => void;
  onInspectLot: (lotId: number) => void;
  onRequestLiveGps: () => void;
}

const GREATER_NOIDA_CENTER: [number, number] = [28.4744, 77.5085];

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistanceLabel(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function getMarkerColors(rate: number | null): { fill: string; stroke: string; status: string } {
  if (rate === null) {
    return { fill: '#94A3B8', stroke: '#475569', status: 'Unknown' };
  }
  if (rate < 0.6) {
    return { fill: '#22C55E', stroke: '#15803D', status: 'High availability' };
  }
  if (rate < 0.85) {
    return { fill: '#F59E0B', stroke: '#B45309', status: 'Moderate availability' };
  }
  return { fill: '#EF4444', stroke: '#B91C1C', status: 'Low availability' };
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function ParkingMap({
  lots,
  userCoords,
  focusedLotId,
  onSelectLot,
  onInspectLot,
  onRequestLiveGps,
}: ParkingMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const lotLayerRef = useRef<L.LayerGroup | null>(null);
  const userLayerRef = useRef<L.LayerGroup | null>(null);
  const lineLayerRef = useRef<L.LayerGroup | null>(null);
  const markersByIdRef = useRef<Map<number, L.CircleMarker>>(new Map());
  const onInspectRef = useRef(onInspectLot);
  const onSelectRef = useRef(onSelectLot);

  const [tileError, setTileError] = useState(false);
  const [mapInitError, setMapInitError] = useState<string | null>(null);
  const lastCenteredKeyRef = useRef<string | null>(null);

  onInspectRef.current = onInspectLot;
  onSelectRef.current = onSelectLot;

  const isFarFromGreaterNoida = userCoords
    ? haversineMeters(
        userCoords.lat,
        userCoords.lng,
        GREATER_NOIDA_CENTER[0],
        GREATER_NOIDA_CENTER[1],
      ) > 25000
    : false;

  function fitAllLots() {
    const map = mapRef.current;
    if (!map || lots.length === 0) return;
    const points: [number, number][] = lots.map((l) => [l.latitude, l.longitude]);
    if (userCoords && !isFarFromGreaterNoida) {
      points.push([userCoords.lat, userCoords.lng]);
    }
    map.fitBounds(points, { padding: [32, 32], maxZoom: 14 });
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    try {
      const map = L.map(containerRef.current, {
        center: userCoords ? [userCoords.lat, userCoords.lng] : GREATER_NOIDA_CENTER,
        zoom: 13,
        zoomControl: true,
      });

      const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      });

      let tileErrorCount = 0;
      tiles.on('tileerror', () => {
        tileErrorCount += 1;
        if (tileErrorCount >= 4) {
          setTileError(true);
        }
      });
      tiles.on('tileload', () => {
        setTileError(false);
      });

      tiles.addTo(map);

      lotLayerRef.current = L.layerGroup().addTo(map);
      lineLayerRef.current = L.layerGroup().addTo(map);
      userLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
    } catch (err) {
      setMapInitError(err instanceof Error ? err.message : 'Unable to initialize Leaflet map.');
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      lotLayerRef.current = null;
      userLayerRef.current = null;
      lineLayerRef.current = null;
      markersByIdRef.current.clear();
    };
  }, []);

  // Render user location marker + accuracy radius
  useEffect(() => {
    const map = mapRef.current;
    const userLayer = userLayerRef.current;
    if (!map || !userLayer) return;

    userLayer.clearLayers();
    if (!userCoords) return;

    if (userCoords.accuracyMeters && userCoords.accuracyMeters > 0) {
      L.circle([userCoords.lat, userCoords.lng], {
        radius: Math.min(userCoords.accuracyMeters, 1500),
        color: '#00D4E5',
        weight: 1,
        fillColor: '#00D4E5',
        fillOpacity: 0.12,
      }).addTo(userLayer);
    }

    const userMarker = L.circleMarker([userCoords.lat, userCoords.lng], {
      radius: 9,
      color: '#101828',
      weight: 3,
      fillColor: '#00D4E5',
      fillOpacity: 1,
    });

    userMarker.bindPopup(
      `<div style="font-family: DM Sans, sans-serif; min-width: 170px;">
        <div style="font-weight: 700; color: #101828; font-size: 13px;">${escapeHtml(userCoords.label)}</div>
        <div style="color: #475569; font-size: 11px; margin-top: 2px;">
          ${userCoords.lat.toFixed(5)}, ${userCoords.lng.toFixed(5)}
        </div>
        <div style="color: #008C99; font-size: 11px; font-weight: 600; margin-top: 4px;">
          ${userCoords.isLiveGps ? 'Live GPS Coordinates' : 'Selected Reference Point'}
        </div>
      </div>`,
    );
    userMarker.addTo(userLayer);
  }, [userCoords]);

  // Render parking lot markers dynamically
  useEffect(() => {
    const map = mapRef.current;
    const lotLayer = lotLayerRef.current;
    if (!map || !lotLayer) return;

    lotLayer.clearLayers();
    markersByIdRef.current.clear();

    const boundsPoints: [number, number][] = [];
    if (userCoords && !isFarFromGreaterNoida) {
      boundsPoints.push([userCoords.lat, userCoords.lng]);
    }

    for (const lot of lots) {
      const colors = getMarkerColors(lot.latest_occupancy_rate);
      const isFocused = lot.id === focusedLotId;
      const distText = userCoords
        ? `${formatDistanceLabel(haversineMeters(userCoords.lat, userCoords.lng, lot.latitude, lot.longitude))} away`
        : lot.area;

      const marker = L.circleMarker([lot.latitude, lot.longitude], {
        radius: isFocused ? 11 : 8,
        color: isFocused ? '#101828' : colors.stroke,
        weight: isFocused ? 3 : 2,
        fillColor: colors.fill,
        fillOpacity: 0.92,
      });

      const freeText =
        lot.latest_free_slots !== null
          ? `${lot.latest_free_slots} / ${lot.capacity} free`
          : 'Unavailable';

      const popupHtml = `
        <div style="font-family: DM Sans, sans-serif; min-width: 210px;">
          <div style="font-size: 11px; color: #64748B;">${escapeHtml(distText)} · ${escapeHtml(lot.lot_type)}</div>
          <div style="font-weight: 700; color: #101828; font-size: 13px; margin-top: 2px;">${escapeHtml(lot.name)}</div>
          <div style="font-size: 12px; color: #334155; margin-top: 6px;">
            <strong>${escapeHtml(freeText)}</strong> · Rs ${lot.price_per_hour}/hr
          </div>
          <div style="font-size: 11px; color: #475569; margin-top: 3px;">
            ${escapeHtml(colors.status)} · ${escapeHtml(lot.availability_source)} (${escapeHtml(lot.data_label)})
          </div>
          <button
            type="button"
            data-inspect-lot-id="${lot.id}"
            style="margin-top: 8px; background: #101828; color: #fff; border: none; border-radius: 6px; padding: 5px 10px; font-size: 11px; font-weight: 600; cursor: pointer;"
          >
            View 24h Log
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.on('click', () => {
        onSelectRef.current(lot.id);
      });
      marker.on('popupopen', (evt) => {
        const popupEl = evt.popup.getElement();
        const btn = popupEl?.querySelector<HTMLButtonElement>(`[data-inspect-lot-id="${lot.id}"]`);
        if (btn) {
          btn.onclick = () => onInspectRef.current(lot.id);
        }
      });

      marker.addTo(lotLayer);
      markersByIdRef.current.set(lot.id, marker);
      boundsPoints.push([lot.latitude, lot.longitude]);
    }

    if (!focusedLotId && boundsPoints.length > 0) {
      const targetKey = userCoords
        ? `${userCoords.isLiveGps ? 'gps' : userCoords.label}:${userCoords.isLiveGps ? 'live' : `${userCoords.lat},${userCoords.lng}`}`
        : `lots:${lots.length}`;

      if (lastCenteredKeyRef.current !== targetKey) {
        lastCenteredKeyRef.current = targetKey;
        if (userCoords) {
          map.setView([userCoords.lat, userCoords.lng], 13, { animate: true });
        } else {
          map.fitBounds(boundsPoints, { padding: [32, 32], maxZoom: 14 });
        }
      }
    }
  }, [lots, userCoords, focusedLotId, isFarFromGreaterNoida]);

  // Focus selected lot & draw straight-line bearing guide from user coordinates
  useEffect(() => {
    const map = mapRef.current;
    const lineLayer = lineLayerRef.current;
    if (!map || !lineLayer) return;

    lineLayer.clearLayers();
    if (!focusedLotId) return;

    const targetLot = lots.find((l) => l.id === focusedLotId);
    if (!targetLot) return;

    if (userCoords) {
      L.polyline(
        [
          [userCoords.lat, userCoords.lng],
          [targetLot.latitude, targetLot.longitude],
        ],
        {
          color: '#00B8C8',
          weight: 2.5,
          dashArray: '6, 6',
          opacity: 0.9,
        },
      ).addTo(lineLayer);
    }

    map.setView([targetLot.latitude, targetLot.longitude], 14, { animate: true });
    const marker = markersByIdRef.current.get(targetLot.id);
    if (marker) {
      marker.openPopup();
    }
  }, [focusedLotId, lots, userCoords]);

  if (mapInitError) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#F59E0B]" />
          <div>
            <p className="font-semibold">Interactive map unavailable — showing list view</p>
            <p className="mt-1 text-xs text-amber-800">{mapInitError}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-[#F5F7FA] px-4 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 text-slate-700">
          <Navigation className="h-3.5 w-3.5 text-[#008C99]" />
          {userCoords ? (
            <span className="font-medium">
              Centered on <strong className="text-[#101828]">{userCoords.label}</strong>{' '}
              <span className="font-mono text-slate-500 tabular-nums">
                ({userCoords.lat.toFixed(4)}, {userCoords.lng.toFixed(4)})
              </span>
            </span>
          ) : (
            <span>Showing Greater Noida parking network ({lots.length} lots)</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {lots.length > 0 && (
            <button
              type="button"
              onClick={fitAllLots}
              className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-[#00D4E5] hover:text-[#101828]"
            >
              Fit All Lots
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (userCoords && mapRef.current) {
                mapRef.current.setView([userCoords.lat, userCoords.lng], 14, { animate: true });
              } else {
                onRequestLiveGps();
              }
            }}
            className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-[#101828] hover:border-[#00D4E5]"
          >
            <LocateFixed className="h-3.5 w-3.5 text-[#008C99]" />
            {userCoords ? 'Re-center on Me' : 'Center on My GPS'}
          </button>
        </div>
      </div>

      {isFarFromGreaterNoida && lots.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-200 bg-cyan-50/70 px-4 py-2 text-xs text-[#101828]">
          <span>
            Your coordinates are outside Greater Noida. Distances on every lot card reflect distance from your live pin.
          </span>
          <button
            type="button"
            onClick={fitAllLots}
            className="font-semibold text-[#008C99] underline hover:text-[#101828]"
          >
            Jump to Greater Noida lots
          </button>
        </div>
      )}

      {tileError && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-[#F59E0B]" />
          <span>OpenStreetMap background tiles could not load; marker positions and lot cards remain active.</span>
        </div>
      )}

      <div
        ref={containerRef}
        aria-label="Greater Noida Parking Lot Map"
        className="h-[380px] w-full bg-slate-100 sm:h-[420px]"
      />
    </div>
  );
}
