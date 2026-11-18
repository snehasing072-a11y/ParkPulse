import type {
  LotDetailResponse,
  ParkingLot,
  PipelineRunResult,
  PipelineStatus,
  SearchPayload,
  SearchRecord,
  ValidationFieldError,
} from '../types/parking';

export class ApiValidationError extends Error {
  errors: ValidationFieldError[];

  constructor(message: string, errors: ValidationFieldError[] = []) {
    super(message);
    this.name = 'ApiValidationError';
    this.errors = errors;
  }
}

async function handleJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 422) {
      const detail = typeof data.detail === 'string' ? data.detail : 'Validation failed.';
      const errors = Array.isArray(data.errors) ? data.errors : [];
      throw new ApiValidationError(detail, errors);
    }
    throw new Error(typeof data.detail === 'string' ? data.detail : `Request failed (${response.status})`);
  }
  return data as T;
}

async function fetchWithWarmupRetry(url: string, attempts = 15): Promise<Response> {
  let lastResponse: Response | null = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      const contentType = res.headers.get('content-type') || '';
      const isWarmupHtml = contentType.includes('text/html');
      if (![500, 502, 503, 504].includes(res.status) && !isWarmupHtml) {
        return res;
      }
      lastResponse = res;
    } catch (err) {
      if (i === attempts - 1) throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (lastResponse) return lastResponse;
  return fetch(url);
}

export async function fetchLots(params?: {
  vehicle_type?: string;
  lot_type?: string;
  area?: string;
}): Promise<ParkingLot[]> {
  const query = new URLSearchParams();
  if (params?.vehicle_type && params.vehicle_type !== 'all') {
    query.set('vehicle_type', params.vehicle_type);
  }
  if (params?.lot_type && params.lot_type !== 'all') {
    query.set('lot_type', params.lot_type);
  }
  if (params?.area) {
    query.set('area', params.area);
  }
  const qs = query.toString();
  const res = await fetchWithWarmupRetry(`/api/lots${qs ? `?${qs}` : ''}`);
  return handleJsonResponse<ParkingLot[]>(res);
}

export async function fetchLotDetail(lotId: number): Promise<LotDetailResponse> {
  const res = await fetchWithWarmupRetry(`/api/lots/${lotId}`);
  return handleJsonResponse<LotDetailResponse>(res);
}

export async function submitSearch(payload: SearchPayload): Promise<SearchRecord> {
  const res = await fetch('/api/searches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleJsonResponse<SearchRecord>(res);
}

export async function fetchRecentSearches(limit = 6): Promise<SearchRecord[]> {
  const res = await fetchWithWarmupRetry(`/api/searches?limit=${limit}`);
  return handleJsonResponse<SearchRecord[]>(res);
}

export async function fetchPipelineStatus(): Promise<PipelineStatus> {
  const res = await fetchWithWarmupRetry('/api/pipeline/status');
  return handleJsonResponse<PipelineStatus>(res);
}

export async function runDataPipeline(reprocessAll = false): Promise<PipelineRunResult> {
  const res = await fetch(`/api/pipeline/run?reprocess_all=${reprocessAll ? 'true' : 'false'}`, {
    method: 'POST',
  });
  return handleJsonResponse<PipelineRunResult>(res);
}
