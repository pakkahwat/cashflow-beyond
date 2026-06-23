// Native WebSocket transport for the Cloudflare Worker + Durable Object backend.
// Uses a stable, client-owned playerId persisted in localStorage so a player
// can reclaim their seat after a refresh (the game itself is saved in the DO).

export interface Ack {
  ok: boolean;
  error?: string;
  roomId?: string;
}

// /api fetches stay same-origin (Next route handlers); only the WebSocket base
// is overridable via NEXT_PUBLIC_WS_URL (dev points at the standalone ws server
// on :3001; prod is same-origin so the env is empty).
const apiBase = '';
const wsBase = (
  process.env.NEXT_PUBLIC_WS_URL ||
  (typeof location !== 'undefined' ? location.origin : '')
).replace(/^http/, 'ws');

const LS = {
  pid: 'cf_pid',
  room: 'cf_room',
  name: 'cf_name'
};

const uuid = (): string =>
  (crypto as any).randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);

const playerId: string = (() => {
  const existing = localStorage.getItem(LS.pid);
  if (existing) return existing;
  const id = uuid();
  localStorage.setItem(LS.pid, id);
  return id;
})();

let ws: WebSocket | null = null;
const pending = new Map<string, (a: Ack) => void>();
let stateCb: (s: any) => void = () => {};
let idCb: (id: string) => void = () => {};

export const onState = (cb: (s: any) => void) => {
  stateCb = cb;
};
export const onId = (cb: (id: string) => void) => {
  idCb = cb;
  cb(playerId);
};
export const getMyId = () => playerId;
export const savedRoom = () => localStorage.getItem(LS.room);

let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

/** Reconnect with exponential backoff and re-join the saved room. No-op after an
 *  intentional leave (forget() clears LS.room). */
const scheduleReconnect = () => {
  const roomId = localStorage.getItem(LS.room);
  const name = localStorage.getItem(LS.name) || 'Player';
  if (!roomId || reconnectTimer) return;
  const delay = Math.min(10000, 500 * 2 ** reconnectAttempts);
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    reconnectAttempts += 1;
    try {
      await connect(roomId);
      await emit('join', { intent: 'resume', playerId, username: name });
      reconnectAttempts = 0;
    } catch {
      scheduleReconnect();
    }
  }, delay);
};

const connect = (roomId: string): Promise<void> =>
  new Promise((resolve, reject) => {
    if (ws && ws.readyState === WebSocket.OPEN) return resolve();
    ws = new WebSocket(`${wsBase}/ws?room=${encodeURIComponent(roomId)}`);
    let opened = false;
    ws.onopen = () => {
      opened = true;
      reconnectAttempts = 0;
      resolve();
    };
    ws.onmessage = (e) => {
      let msg: any;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.event === 'ready') return;
      if (msg.event === 'state') return stateCb(msg.state);
      if (msg.reqId && pending.has(msg.reqId)) {
        pending.get(msg.reqId)!(msg as Ack);
        pending.delete(msg.reqId);
      }
    };
    ws.onerror = () => {
      if (!opened) reject(new Error('ws_error'));
    };
    ws.onclose = () => {
      ws = null;
      scheduleReconnect();
    };
  });

export const emit = (event: string, payload?: Record<string, unknown>): Promise<Ack> =>
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
        resolve({ ok: false, error: 'timeout' });
      }
    }, 8000);
  });

const remember = (roomId: string, name: string) => {
  localStorage.setItem(LS.room, roomId);
  localStorage.setItem(LS.name, name);
};
const forget = () => {
  localStorage.removeItem(LS.room);
};

export const createRoom = async (username: string): Promise<Ack> => {
  const res = await fetch(`${apiBase}/api/room`, { method: 'POST' });
  const { roomId } = await res.json();
  await connect(roomId);
  const ack = await emit('join', { intent: 'create', playerId, username });
  if (ack.ok) remember(ack.roomId || roomId, username);
  return ack;
};

export const joinRoom = async (roomId: string, username: string): Promise<Ack> => {
  try {
    await connect(roomId);
  } catch {
    return { ok: false, error: 'room_not_found' };
  }
  const ack = await emit('join', { intent: 'join', playerId, username });
  if (ack.ok) remember(ack.roomId || roomId, username);
  return ack;
};

/** Re-join a saved game after a refresh. Returns false if nothing to resume. */
export const resume = async (): Promise<Ack | null> => {
  const roomId = localStorage.getItem(LS.room);
  const name = localStorage.getItem(LS.name) || 'Player';
  if (!roomId) return null;
  try {
    await connect(roomId);
  } catch {
    forget();
    return { ok: false, error: 'room_not_found' };
  }
  const ack = await emit('join', { intent: 'resume', playerId, username: name });
  if (!ack.ok) forget();
  return ack;
};

export const leaveRoom = async (): Promise<Ack> => {
  const ack = await emit('leaveRoom');
  forget();
  ws?.close();
  ws = null;
  return ack;
};

export const fetchBoard = async (): Promise<{ dreams: any[]; fastTrack: any[] }> => {
  const res = await fetch(`${apiBase}/api/board`);
  return res.json();
};
