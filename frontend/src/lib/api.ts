export type Role = 'registrar' | 'admin' | 'super_admin';
export type VerifyStatus = 'not_found' | 'already_played' | 'ready';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const TRANSIENT_HTTP_STATUSES = new Set([502, 503, 504]);
const RETRY_DELAYS_MS = [1200, 2400, 4000, 6500];
const BACKEND_READY_TTL_MS = 8 * 60 * 1000;
const WARMUP_TIMEOUT_MS = 70 * 1000;
const WARMUP_POLL_MS = 4000;
const WARMUP_ERROR_MESSAGE = 'Server is waking up. Please wait about a minute and try again.';

type RequestConfig = {
  retryable?: boolean;
  warmup?: boolean;
};

export type LoginResponse = {
  token: string;
  role: Role;
};

export type VerifyResponse = {
  status: VerifyStatus;
  color: 'red' | 'yellow' | 'green';
  message: string;
  youtube_handle: string;
  channel_id?: string;
  channel_title?: string;
  sheet_row?: number;
};

export type Player = {
  row_number: number;
  timestamp: string;
  full_name: string;
  email: string;
  phone_number: string;
  youtube_handle: string;
  channel_id: string;
  channel_title: string;
  verification_status: string;
  exit_level: string;
  result_status: string;
  winnings: string;
  telebirr_ref: string;
  updated_at: string;
};

export type StatusUpdateResponse = {
  ok: boolean;
  message: string;
  row_number: number;
  verification_status: string;
};

let backendReadyUntil = 0;
let warmupPromise: Promise<void> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isNetworkOrCorsError(err: unknown): boolean {
  return err instanceof TypeError;
}

function shouldSetJsonContentType(body: RequestInit['body']): boolean {
  return body !== undefined && body !== null && !(body instanceof FormData);
}

function buildHeaders(options: RequestInit, token?: string): Headers {
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (shouldSetJsonContentType(options.body) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return headers;
}

async function pingBackendHealthWithCors(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health?cb=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function wakeBackendIfNeeded(): Promise<void> {
  if (Date.now() < backendReadyUntil) return;
  if (warmupPromise) {
    await warmupPromise;
    return;
  }

  warmupPromise = (async () => {
    const deadline = Date.now() + WARMUP_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (await pingBackendHealthWithCors()) {
        backendReadyUntil = Date.now() + BACKEND_READY_TTL_MS;
        return;
      }

      // no-cors wake request still reaches Render/backend even when CORS headers are absent.
      try {
        await fetch(`${API_BASE_URL}/api/health?wake=${Date.now()}`, {
          method: 'GET',
          mode: 'no-cors',
          cache: 'no-store',
        });
      } catch {
        // ignore and continue polling
      }
      await sleep(WARMUP_POLL_MS);
    }
    throw new Error(WARMUP_ERROR_MESSAGE);
  })()
    .finally(() => {
      warmupPromise = null;
    });

  await warmupPromise;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
  config: RequestConfig = {},
): Promise<T> {
  const retryable = config.retryable === true;
  const warmup = config.warmup !== false;

  if (warmup) {
    await wakeBackendIfNeeded();
  }

  const maxAttempts = retryable ? RETRY_DELAYS_MS.length + 1 : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const headers = buildHeaders(options, token);
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        backendReadyUntil = Date.now() + BACKEND_READY_TTL_MS;
        return data as T;
      }

      const message = data.detail || data.message || `Request failed (${response.status})`;
      if (retryable && TRANSIENT_HTTP_STATUSES.has(response.status) && attempt < maxAttempts - 1) {
        await sleep(RETRY_DELAYS_MS[attempt] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
        continue;
      }
      throw new Error(message);
    } catch (err) {
      if (retryable && isNetworkOrCorsError(err) && attempt < maxAttempts - 1) {
        await sleep(RETRY_DELAYS_MS[attempt] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
        continue;
      }
      if (isNetworkOrCorsError(err)) {
        throw new Error(WARMUP_ERROR_MESSAGE);
      }
      throw err;
    }
  }

  throw new Error(WARMUP_ERROR_MESSAGE);
}

export const api = {
  login: (role: Role, password: string) =>
    request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ role, password }),
    }, undefined, { retryable: true, warmup: true }),

  verifyHandle: (youtube_handle: string, token: string) =>
    request<VerifyResponse>('/api/registrar/verify', {
      method: 'POST',
      body: JSON.stringify({ youtube_handle }),
    }, token, { retryable: true, warmup: true }),

  registerPlayer: (payload: {
    full_name: string;
    email: string;
    phone_number: string;
    youtube_handle: string;
    channel_id?: string;
    channel_title?: string;
  }, token: string) =>
    request<{ ok: boolean; message: string; player: Player }>('/api/registrar/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token, { warmup: true }),

  getPlayers: (token: string) => request<Player[]>('/api/admin/players', {}, token, { retryable: true, warmup: true }),

  logResult: (rowNumber: number, payload: {
    exit_level:
      | 'Level 1'
      | 'Level 2'
      | 'Level 3'
      | 'Level 4'
      | 'Level 5'
      | 'Level 6'
      | 'Level 7'
      | 'Level 8'
      | 'Level 9';
    status: 'Won' | 'Failed';
    telebirr_ref: string;
  }, token: string) =>
    request<{ ok: boolean; message: string; row_number: number; winnings: number }>(`/api/admin/players/${rowNumber}/result`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token, { warmup: true }),

  updatePlayerStatus: (rowNumber: number, payload: {
    verification_status: string;
  }, token: string) =>
    request<StatusUpdateResponse>(`/api/admin/players/${rowNumber}/status`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token, { warmup: true }),
};
