// Native WebSocket transport for the Cloudflare Worker + Durable Object backend.
// Exposes a small Socket.IO-like surface: emit(event,payload) => Promise<ack>,
// plus onState / onId callbacks and room helpers.

export interface Ack {
  ok: boolean;
  error?: string;
  roomId?: string;
}

// In production the client is served by the same Worker (same origin).
// In dev, set VITE_SERVER_URL=http://localhost:8787 (wrangler dev).
const httpBase = import.meta.env.VITE_SERVER_URL || '';
const wsBase = (httpBase || (typeof location !== 'undefined' ? location.origin : '')).replace(
  /^http/,
  'ws'
);

let ws: WebSocket | null = null;
let myId = '';
const pending = new Map<string, (a: Ack) => void>();
let stateCb: (s: any) => void = () => {};
let idCb: (id: string) => void = () => {};

export const onState = (cb: (s: any) => void) => {
  stateCb = cb;
};
export const onId = (cb: (id: string) => void) => {
  idCb = cb;
};
export const getMyId = () => myId;

const connect = (roomId: string): Promise<void> =>
  new Promise((resolve, reject) => {
    if (ws && ws.readyState === WebSocket.OPEN) return resolve();
    ws = new WebSocket(`${wsBase}/ws?room=${encodeURIComponent(roomId)}`);
    let opened = false;
    ws.onmessage = (e) => {
      let msg: any;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.event === 'welcome') {
        myId = msg.id;
        idCb(myId);
        if (!opened) {
          opened = true;
          resolve();
        }
        return;
      }
      if (msg.event === 'state') {
        stateCb(msg.state);
        return;
      }
      if (msg.reqId && pending.has(msg.reqId)) {
        pending.get(msg.reqId)!(msg as Ack);
        pending.delete(msg.reqId);
      }
    };
    ws.onerror = () => {
      if (!opened) reject(new Error('ws_error'));
    };
  });

export const emit = (event: string, payload?: unknown): Promise<Ack> =>
  new Promise((resolve) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return resolve({ ok: false, error: 'no_connection' });
    }
    const reqId = Math.random().toString(36).slice(2);
    pending.set(reqId, resolve);
    ws.send(JSON.stringify({ reqId, event, payload }));
    setTimeout(() => {
      if (pending.has(reqId)) {
        pending.delete(reqId);
        resolve({ ok: true });
      }
    }, 8000);
  });

export const createRoom = async (username: string): Promise<Ack> => {
  const res = await fetch(`${httpBase}/api/room`, { method: 'POST' });
  const { roomId } = await res.json();
  await connect(roomId);
  return emit('createRoom', { username });
};

export const joinRoom = async (roomId: string, username: string): Promise<Ack> => {
  try {
    await connect(roomId);
  } catch {
    return { ok: false, error: 'room_not_found' };
  }
  return emit('joinRoom', { username });
};

export const leaveRoom = async (): Promise<Ack> => {
  const ack = await emit('leaveRoom');
  ws?.close();
  ws = null;
  return ack;
};

export const fetchBoard = async (): Promise<{ dreams: any[]; fastTrack: any[] }> => {
  const res = await fetch(`${httpBase}/api/board`);
  return res.json();
};
