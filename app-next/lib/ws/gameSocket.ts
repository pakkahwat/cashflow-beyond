import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { Liabilities } from '../../engine/types.js';
import { rooms, type Room } from './RoomManager.js';

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
  if (!playerId) return;
  const stillConnected = [...room.sockets.values()].includes(playerId);
  if (stillConnected) return;
  room.game.removePlayer(playerId);
  broadcast(room);
  if (room.sockets.size === 0) rooms.delete(room.code); // free empty rooms
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
    const playerId = String(p.playerId || '').trim();
    const username = String(p.username || '').trim();
    const intent: 'create' | 'join' | 'resume' = p.intent || 'join';
    if (!playerId) return ack(false, { error: 'name_required' });

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
  }

  const playerId = room.sockets.get(ws);
  if (!playerId) return ack(false, { error: 'not_joined' });

  if (msg.event === 'leaveRoom') {
    g.removePlayer(playerId);
    room.sockets.delete(ws);
    ack(true);
    return broadcast(room);
  }

  let res: { ok: boolean; error?: string } = { ok: false, error: 'unknown_event' };
  switch (msg.event) {
    case 'startGame': res = g.start(playerId); break;
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
