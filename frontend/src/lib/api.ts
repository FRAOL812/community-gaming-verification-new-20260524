export type Role = 'registrar' | 'admin' | 'super_admin';
export type VerifyStatus = 'not_found' | 'already_played' | 'ready';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || data.message || 'Request failed');
  }
  return data as T;
}

export const api = {
  login: (role: Role, password: string) =>
    request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ role, password }),
    }),

  verifyHandle: (youtube_handle: string, token: string) =>
    request<VerifyResponse>('/api/registrar/verify', {
      method: 'POST',
      body: JSON.stringify({ youtube_handle }),
    }, token),

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
    }, token),

  getPlayers: (token: string) => request<Player[]>('/api/admin/players', {}, token),

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
    }, token),

  updatePlayerStatus: (rowNumber: number, payload: {
    verification_status: string;
  }, token: string) =>
    request<StatusUpdateResponse>(`/api/admin/players/${rowNumber}/status`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token),
};
