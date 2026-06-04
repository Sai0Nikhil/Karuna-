// =====================================================================
// KARUNA — WebSocket client (auto-reconnect with exponential backoff).
//
// Listens for case-mutation events broadcast by the backend and routes
// them to subscribers. The remote case store subscribes to refresh
// its in-memory copy whenever any other client makes a change.
// =====================================================================

import { Case } from '../types';

export interface RealtimeEvent {
  type:
    | 'hello'
    | 'case.created'
    | 'case.updated'
    | 'case.assigned'
    | 'case.status'
    | 'case.donation'
    | 'case.note'
    | 'case.adoption_application'
    | 'case.adoption_decision';
  caseId?: string;
  payload?: Case | any;
  connections?: number;
}

type Listener = (ev: RealtimeEvent) => void;

class RealtimeClient {
  private url: string;
  private ws: WebSocket | null = null;
  private listeners: Set<Listener> = new Set();
  private retry = 0;
  private maxRetry = 8;
  private stopped = false;

  constructor(httpBaseUrl: string) {
    // Convert http(s)://host → ws(s)://host/ws
    const u = new URL(httpBaseUrl);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    u.pathname = (u.pathname.replace(/\/$/, '')) + '/ws';
    this.url = u.toString();
  }

  start() {
    if (this.stopped) return;
    try {
      this.ws = new WebSocket(this.url);
    } catch (e) {
      console.warn('[karuna/realtime] WS construct failed:', e);
      return this.scheduleReconnect();
    }

    this.ws.onopen = () => {
      console.info('[karuna/realtime] connected:', this.url);
      this.retry = 0;
    };

    this.ws.onmessage = (msg) => {
      try {
        const ev: RealtimeEvent = JSON.parse(msg.data);
        for (const l of this.listeners) l(ev);
      } catch (e) {
        console.warn('[karuna/realtime] bad message:', e);
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (!this.stopped) this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      try { this.ws?.close(); } catch {}
    };
  }

  private scheduleReconnect() {
    if (this.stopped) return;
    if (this.retry >= this.maxRetry) {
      console.warn('[karuna/realtime] max reconnect attempts reached');
      return;
    }
    const delay = Math.min(30000, 500 * Math.pow(2, this.retry));
    this.retry++;
    setTimeout(() => this.start(), delay);
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  stop() {
    this.stopped = true;
    try { this.ws?.close(); } catch {}
    this.ws = null;
    this.listeners.clear();
  }
}

let _instance: RealtimeClient | null = null;

export const getRealtime = (apiUrl: string): RealtimeClient => {
  if (!_instance) {
    _instance = new RealtimeClient(apiUrl);
    _instance.start();
  }
  return _instance;
};
