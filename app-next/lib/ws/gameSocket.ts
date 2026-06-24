import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { Liabilities } from '../../engine/types.js';
import { rooms, type Room } from './RoomManager.js';
import { maybeRunBots } from './botRunner.js';
import { verifyToken } from '../auth/verifyToken.js';
import { maybeRecordGameEnd } from './recordGameEnd.js';

/** Add `count` (1–3) server-driven bots to a room and flag it as a bot game.
 *  Bots are normal Game players with synthetic ids (`bot:1..N`); they never
 *  connect over WebSocket and present no token. Returns the ids actually added. */
const addBots = (room: Room, count: number): string[] => {
  if (!room.bots) room.bots = new Set();
  const added: string[] = [];
  const n = Math.max(1, Math.min(3, Math.floor(count) || 1));
  for (let i = 0; i < n; i++) {
    // Find the next free bot index so repeated `addBot` calls don't collide.
    let idx = room.bots.size + 1;
    let id = `bot:${idx}`;
    while (room.game.players.some((p) => p.id === id)) {
      idx += 1;
      id = `bot:${idx}`;
    }
    const res = room.game.addPlayer(id, `Bot ${idx}`);
    if (res.ok) {
      room.bots.add(id);
      added.push(id);
    } else {
      break; // room full / already started — stop adding
    }
  }
  if (room.bots.size > 0) room.vsBots = true;
  return added;
};

const IDLE_MS = Number(process.env.WS_IDLE_MS) || 30 * 60 * 1000;

interface ClientMessage {
  reqId?: string;
  event: string;
  payload?: any;
}

const send = (ws: WebSocket, obj: unknown) => {
  try {
    ws.send(JSON.stringify(obj));
  } catch {
    /* socket closing */
  }
};

const broadcast = (room: Room) => {
  const msg = JSON.stringify({ event: 'state', state: room.game.getState() });
  for (const ws of room.sockets.keys()) {
    try {
      ws.send(msg);
    } catch {
      /* ignore */
    }
  }
};

const attach = (room: Room, ws: WebSocket, playerId: string) => {
  // Cancel any pending idle-deletion — a player is (re)attaching.
  if (room.idleTimer) {
    clearTimeout(room.idleTimer);
    room.idleTimer = undefined;
  }
  for (const [s, id] of room.sockets) {
    if (id === playerId && s !== ws) {
      room.sockets.delete(s);
      try {
        s.close();
      } catch {
        /* ignore */
      }
    }
  }
  room.sockets.set(ws, playerId);
};

const onClose = (room: Room, ws: WebSocket) => {
  const playerId = room.sockets.get(ws);
  room.sockets.delete(ws);

  // If the socket had a real player attached, remove them and broadcast.
  if (playerId) {
    const stillConnected = [...room.sockets.values()].includes(playerId);
    if (!stillConnected) {
      room.game.removePlayer(playerId);
      broadcast(room);
    }
  }

  // Room eviction — runs regardless of whether playerId was set so that
  // pre-join (lobby) sockets that close before sending 'join' are also handled.
  if (room.sockets.size === 0) {
    if (room.game.status === 'lobby') {
      // Empty lobby → delete immediately (covers pre-join leak too).
      rooms.delete(room.code);
    } else {
      // Started/finished game → keep alive briefly for reconnect; delete after
      // IDLE_MS if nobody re-attaches.
      room.idleTimer = setTimeout(() => {
        if (room.sockets.size === 0) rooms.delete(room.code);
      }, IDLE_MS);
    }
  }
};

const onMessage = (room: Room, ws: WebSocket, raw: string) => {
  let msg: ClientMessage;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  const ack = (ok: boolean, extra: Record<string, unknown> = {}) =>
    send(ws, { reqId: msg.reqId, ok, ...extra });
  const p = msg.payload || {};
  const g = room.game;

  if (msg.event === 'join') {
    // Verify the token asynchronously; everything inside is async from here.
    verifyToken(p.idToken).then((u) => {
      if (!u) return ack(false, { error: 'auth_required' });

      // Use server-authoritative uid and name from the verified token.
      const playerId = u.uid;
      const username = u.name;
      const intent: 'create' | 'join' | 'resume' = p.intent || 'join';

      const existing = g.players.find((pl) => pl.id === playerId);

      if (intent === 'resume') {
        if (!existing) return ack(false, { error: 'room_not_found' });
        g.setConnected(playerId, true);
        attach(room, ws, playerId);
        ack(true, { roomId: room.code });
        return broadcast(room);
      }
      if (existing) {
        g.setConnected(playerId, true);
        attach(room, ws, playerId);
        ack(true, { roomId: room.code });
        return broadcast(room);
      }
      if (intent === 'join' && g.players.length === 0) {
        return ack(false, { error: 'room_not_found' });
      }
      const res = g.addPlayer(playerId, username);
      if (res.ok) attach(room, ws, playerId);
      ack(res.ok, { error: res.error, roomId: room.code });
      return broadcast(room);
    }).catch(() => ack(false, { error: 'auth_required' }));
    return; // join is async; return early and let the promise resolve
  }

  const playerId = room.sockets.get(ws);
  if (!playerId) return ack(false, { error: 'not_joined' });

  if (msg.event === 'leaveRoom') {
    g.removePlayer(playerId);
    room.sockets.delete(ws);
    ack(true);
    return broadcast(room);
  }

  // ---- Bot mode (server-authoritative; bots are non-networked players) ----

  if (msg.event === 'addBot') {
    // Lobby-only: host adds a single bot opponent.
    if (g.status !== 'lobby') {
      ack(false, { error: 'game_already_started' });
      return;
    }
    if (g.host?.id !== playerId) {
      ack(false, { error: 'only_host_can_start' });
      return;
    }
    const added = addBots(room, 1);
    ack(added.length > 0, { error: added.length ? undefined : 'cannot_add_bot' });
    return broadcast(room);
  }

  if (msg.event === 'createBotGame') {
    // The human is already joined (this socket has a playerId). Add N bots and
    // start the game; then let the runner auto-play any leading bot turn.
    if (g.status !== 'lobby') {
      ack(false, { error: 'game_already_started' });
      return;
    }
    if (g.host?.id !== playerId) {
      ack(false, { error: 'only_host_can_start' });
      return;
    }
    addBots(room, Number(p.count) || 1);
    const startRes = g.start(playerId);
    if (startRes.ok) room.startedAt = Date.now();
    ack(startRes.ok, { error: startRes.error });
    broadcast(room);
    if (startRes.ok) maybeRunBots(room, broadcast);
    return;
  }

  let res: { ok: boolean; error?: string } = { ok: false, error: 'unknown_event' };
  switch (msg.event) {
    case 'startGame': {
      res = g.start(playerId);
      if (res.ok) room.startedAt = Date.now();
      break;
    }
    case 'setDifficulty': res = g.setDifficulty(playerId, p.difficulty === 'easy' ? 'easy' : 'normal'); break;
    case 'rollDice': res = g.rollDice(playerId, Number(p.diceCount) || 1); break;
    case 'chooseDeal': res = g.chooseDeal(playerId, p.size); break;
    case 'cardAction': res = g.cardAction(playerId, p.action, p.payload); break;
    case 'takeLoan': res = g.takeLoan(playerId, Number(p.amount)); break;
    case 'payLoan': res = g.payLoan(playerId, p.type as keyof Liabilities, Number(p.amount)); break;
    case 'liquidate': res = g.liquidate(playerId); break;
    case 'chooseDream': res = g.chooseDream(playerId, p.dreamId); break;
    case 'enterFastTrack': res = g.enterFastTrack(playerId); break;
    case 'fastTrackAction': res = g.fastTrackAction(playerId, p.action); break;
    case 'endTurn': res = g.endTurn(playerId); break;
  }
  ack(res.ok, { error: res.error });
  broadcast(room);

  // Game-end hook: write stats exactly once when the game finishes.
  maybeRecordGameEnd(room);

  // After any human action (e.g. endTurn), the next turn may belong to a bot —
  // auto-play it (and any following bot turns) until control returns to a human.
  maybeRunBots(room, broadcast);
};

/** Attach the game WebSocket server to an existing HTTP server. Handles
 *  `upgrade` on `/ws?room=CODE`; each room is an in-memory authoritative Game. */
export function attachWsServer(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', 'http://localhost');
    if (url.pathname !== '/ws') {
      socket.destroy();
      return;
    }
    const code = (url.searchParams.get('room') || '').toUpperCase();
    if (!code) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      const room = rooms.getOrCreate(code);
      ws.on('message', (data) => onMessage(room, ws, data.toString()));
      ws.on('close', () => onClose(room, ws));
      ws.on('error', () => onClose(room, ws));
      send(ws, { event: 'ready' });
    });
  });
}
