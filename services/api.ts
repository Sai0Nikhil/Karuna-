// =====================================================================
// KARUNA — REST API client for the FastAPI backend.
//
// Set VITE_API_URL in .env to enable remote mode:
//   VITE_API_URL=http://localhost:8000
//
// When unset, the app falls back to the local-only store (no network).
// =====================================================================

import { Case } from '../types';

// Vite exposes import.meta.env.VITE_*; fall back to process.env for safety.
const API_URL: string =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
  (typeof process !== 'undefined' && (process as any).env?.VITE_API_URL) ||
  '';

export const REMOTE_ENABLED = !!API_URL;

const TOKEN_KEY = 'karuna.auth.token';
const USER_KEY  = 'karuna.auth.user';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'citizen' | 'ngo' | 'vet' | 'admin';
  ngo_name?: string | null;
}

export const getToken = (): string | null => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};

export const getUser = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) as AuthUser : null;
  } catch { return null; }
};

const setAuth = (token: string, user: AuthUser) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

// ───────────────────────────────────────────────────────────────────────
// Low-level fetch wrapper
// ───────────────────────────────────────────────────────────────────────

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  if (!REMOTE_ENABLED) {
    throw new ApiError('Remote mode disabled (VITE_API_URL not set)', 0);
  }
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(opts.headers as Record<string, string> || {}),
  };
  const token = getToken();
  if (token) headers['authorization'] = `Bearer ${token}`;

  const res = await fetch(API_URL + path, { ...opts, headers });
  const text = await res.text();
  let body: any = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  if (!res.ok) {
    const msg = body?.detail || body?.message || `HTTP ${res.status}`;
    throw new ApiError(typeof msg === 'string' ? msg : JSON.stringify(msg), res.status);
  }
  return body as T;
}

// ───────────────────────────────────────────────────────────────────────
// Auth
// ───────────────────────────────────────────────────────────────────────

export const api = {
  apiUrl: API_URL,
  remoteEnabled: REMOTE_ENABLED,

  async register(input: { email: string; password: string; name: string; role?: string; ngo_name?: string }) {
    const out = await request<{ access_token: string; user: AuthUser }>('/api/auth/register', {
      method: 'POST', body: JSON.stringify(input),
    });
    setAuth(out.access_token, out.user);
    return out;
  },

  async login(email: string, password: string) {
    const out = await request<{ access_token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    });
    setAuth(out.access_token, out.user);
    return out;
  },

  logout() {
    clearAuth();
  },

  // ─── Cases ──────────────────────────────────────────────────────
  listCases: () => request<Case[]>('/api/cases'),
  getCase:  (id: string) => request<Case>(`/api/cases/${id}`),

  createCase: (body: any) =>
    request<Case>('/api/cases', { method: 'POST', body: JSON.stringify(body) }),

  assignCase: (id: string, responder: string, ngo?: string) =>
    request<Case>(`/api/cases/${id}/assign`, {
      method: 'PATCH', body: JSON.stringify({ responder, ngo }),
    }),

  updateStatus: (id: string, to: string, actor: string, note?: string) =>
    request<Case>(`/api/cases/${id}/status`, {
      method: 'PATCH', body: JSON.stringify({ to, actor, note }),
    }),

  addNote: (id: string, actor: string, note: string) =>
    request<Case>(`/api/cases/${id}/notes`, {
      method: 'POST', body: JSON.stringify({ actor, note }),
    }),

  addDonation: (id: string, donorName: string, amountInr: number, message?: string, paymentMethod?: string, billOffsetDetails?: string) =>
    request<any>(`/api/donations/case/${id}`, {
      method: 'POST', body: JSON.stringify({ donorName, amountInr, message, paymentMethod, billOffsetDetails }),
    }),

  applyForAdoption: (id: string, applicantName: string, contact: string, reason: string, adopterIdUrl?: string) =>
    request<any>(`/api/adoptions/case/${id}/apply`, {
      method: 'POST', body: JSON.stringify({ applicantName, contact, reason, adopterIdUrl }),
    }),

  decideAdoption: (caseId: string, appId: string, status: 'approved' | 'rejected') =>
    request<any>(`/api/adoptions/${appId}`, {
      method: 'PUT', body: JSON.stringify({ status }),
    }),

  addCheckin: (appId: string, text: string, photoUrl?: string) =>
    request<any>(`/api/adoptions/${appId}/checkin`, {
      method: 'POST', body: JSON.stringify({ text, photoUrl }),
    }),

  // ─── AI proxy ──────────────────────────────────────────────────
  aiTriage: (imageDataUrl: string, description: string, language: string, location?: any) =>
    request<any>('/api/ai/triage', {
      method: 'POST',
      body: JSON.stringify({ imageDataUrl, description, language, location }),
    }),

  // ─── Health ────────────────────────────────────────────────────
  health: () => request<{ ok: boolean; claudeEnabled: boolean }>('/api/health'),
};
