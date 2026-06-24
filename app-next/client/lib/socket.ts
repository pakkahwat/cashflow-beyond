// Native WebSocket transport for the Next.js game backend.
// Identity is Firebase-authoritative: playerId = Firebase uid, username from
// Google displayName, and a fresh idToken is attached to every join/resume.
// A localStorage UUID is kept only as a pre-auth fallback (should never reach
// the server once the user is signed in, because the join is blocked by AuthGate).

import { auth, getIdToken, onAuthChange, authReady } from './firebase';

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

// E2E test mode: skip real Firebase and present a bypass token the server accepts
// when WS_AUTH_BYPASS=1. Never set in production builds (guarded by the env flag),
// so it cannot weaken real auth.
const E2E = process.env.NEXT_PUBLIC_E2E === '1';

const uuid = (): string =>
  (crypto as any).randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);

/** The token attached to join/API calls: a real Firebase id token, or — in E2E
 *  test mode — a `test:<uid>:<name>` token matching the server's WS_AUTH_BYPASS. */
const authToken = async (): Promise<string | null> =>
  E2E ? `test:${getPlayerId()}:${getUsername()}` : getIdToken();

/** Get the current player's Firebase uid, falling back to a localStorage uuid. */
const getPlayerId = (): string => {
  if (auth.currentUser?.uid) return auth.currentUser.uid;
  const existing = localStorage.getItem(LS.pid);
  if (existing) return existing;
  const id = uuid();
  localStorage.setItem(LS.pid, id);
  return id;
};

/** Get the current player's display name (Google displayName → stored name → 'Player'). */
const getUsername = (): string =>
  auth.currentUser?.displayName ||
  localStorage.getItem(LS.name) ||
  'Player';

let ws: WebSocket | null = null;
const pending = new Map<string, (a: Ack) => void>();
let stateCb: (s: any) => void = () => {};
let idCb: (id: string) => void = () => {};

export const onState = (cb: (s: any) => void) => {
  stateCb = cb;
};
export const onId = (cb: (id: string) => void) => {
  idCb = cb;
  cb(getPlayerId());
  // Keep the reported player id in sync with Firebase. At page load the store reads
  // `getPlayerId()` before Firebase has restored the session, so it gets the pre-auth
  // localStorage uuid. When auth resolves (or the user signs in/out) we re-emit the
  // now-correct uid, otherwise `myId` would stay stuck on the uuid and never match the
  // server-side player (keyed by Firebase uid) — breaking "is it my turn" everywhere.
  // Registered here (not at module load) so importing socket without the store — e.g.
  // AuthGate pulling in clearSession — doesn't trigger the auth subscription.
  onAuthChange(() => idCb(getPlayerId()));
};
export const getMyId = () => getPlayerId();
export const savedRoom = () => localStorage.getItem(LS.room);

let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

/** Reconnect with exponential backoff and re-join the saved room. No-op after an
 *  intentional leave (forget() clears LS.room). */
const scheduleReconnect = () => {
  const roomId = localStorage.getItem(LS.room);
  if (!roomId || reconnectTimer) return;
  const delay = Math.min(10000, 500 * 2 ** reconnectAttempts);
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    reconnectAttempts += 1;
    try {
      await authReady; // ensure the real uid + a fresh token, not the pre-auth fallback
      await connect(roomId);
      const idToken = await authToken();
      await emit('join', { intent: 'resume', playerId: getPlayerId(), username: getUsername(), idToken });
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

/** Clear all saved session keys. Called on sign-out so the next user who signs in on
 *  this device doesn't inherit the previous player's room / name / id. */
export const clearSession = () => {
  localStorage.removeItem(LS.room);
  localStorage.removeItem(LS.name);
  localStorage.removeItem(LS.pid);
};

export const createRoom = async (username: string): Promise<Ack> => {
  if (E2E) localStorage.setItem(LS.name, username); // bypass token carries the name
  const idToken = await authToken();
  const res = await fetch(`${apiBase}/api/room`, {
    method: 'POST',
    headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
  });
  if (!res.ok) return { ok: false, error: res.status === 401 ? 'auth_required' : 'generic' };
  const { roomId } = await res.json();
  await connect(roomId);
  const playerId = getPlayerId();
  const ack = await emit('join', { intent: 'create', playerId, username, idToken });
  if (ack.ok) remember(ack.roomId || roomId, username);
  return ack;
};

export const joinRoom = async (roomId: string, username: string): Promise<Ack> => {
  if (E2E) localStorage.setItem(LS.name, username); // bypass token carries the name
  try {
    await connect(roomId);
  } catch {
    return { ok: false, error: 'room_not_found' };
  }
  const idToken = await authToken();
  const playerId = getPlayerId();
  const ack = await emit('join', { intent: 'join', playerId, username, idToken });
  if (ack.ok) remember(ack.roomId || roomId, username);
  return ack;
};

/** Re-join a saved game after a refresh. Returns null if nothing to resume.
 *
 *  Two correctness rules, both learned from the "refresh drops me to home" bug:
 *  1. Wait for Firebase (`authReady`) before reading the id/token. Running at module
 *     load — before the session is restored — sent a null token + the uuid fallback,
 *     so the server rejected the resume.
 *  2. Only `forget()` the saved room when the server says it's genuinely gone
 *     (`room_not_found`). Transient failures (not signed in yet, no connection,
 *     timeout) must KEEP the room so a retry / re-login can still rejoin. */
export const resume = async (): Promise<Ack | null> => {
  const roomId = localStorage.getItem(LS.room);
  if (!roomId) return null;
  await authReady;
  // Not signed in (e.g. session expired) — keep the room and let a later sign-in retry.
  if (!E2E && !auth.currentUser) return { ok: false, error: 'auth_required' };
  try {
    await connect(roomId);
  } catch {
    return { ok: false, error: 'no_connection' };
  }
  const idToken = await authToken();
  const playerId = getPlayerId();
  const name = getUsername();
  const ack = await emit('join', { intent: 'resume', playerId, username: name, idToken });
  if (!ack.ok && ack.error === 'room_not_found') forget();
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
  if (!res.ok) return { dreams: [], fastTrack: [] };
  return res.json();
};

/**
 * Create a room, join it as host, then emit `createBotGame` to add N bots and
 * start immediately. Mirrors the `createRoom` flow for connection/token handling.
 */
export const createBotGame = async (username: string, count: number): Promise<Ack> => {
  if (E2E) localStorage.setItem(LS.name, username); // bypass token carries the name
  const idToken = await authToken();
  const res = await fetch(`${apiBase}/api/room`, {
    method: 'POST',
    headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
  });
  if (!res.ok) return { ok: false, error: res.status === 401 ? 'auth_required' : 'generic' };
  const { roomId } = await res.json();
  await connect(roomId);
  const playerId = getPlayerId();
  // First join as the human host (identical to createRoom).
  const joinAck = await emit('join', { intent: 'create', playerId, username, idToken });
  if (!joinAck.ok) return joinAck;
  remember(joinAck.roomId || roomId, username);
  // Then issue createBotGame which adds bots + starts the game server-side.
  const botAck = await emit('createBotGame', { count });
  return { ...botAck, roomId: joinAck.roomId || roomId };
};

/**
 * Emit `addBot` from the lobby (host only). The server adds one bot player and
 * broadcasts the updated state.
 */
export const addBot = (): Promise<Ack> => emit('addBot');

/** Pass the current pending deal to another player (the rulebook's "sell the option"). */
export const offerDeal = (toPlayerId: string): Promise<Ack> => emit('offerDeal', { toPlayerId });

/** Respond to a deal another player passed to you: buy it (accept) or decline. */
export const respondOffer = (accept: boolean): Promise<Ack> => emit('respondOffer', { accept });

/** Toggle Auto-play for yourself; the server then plays your turns like a bot. */
export const setAutoPlay = (auto: boolean): Promise<Ack> => emit('setAuto', { auto });
