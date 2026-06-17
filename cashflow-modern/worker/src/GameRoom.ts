import { Game } from '../../server/src/engine/Game.js';
import type { Liabilities } from '../../server/src/engine/types.js';

interface ClientMessage {
  reqId?: string;
  event: string;
  payload?: any;
}

/**
 * One Durable Object instance == one game room. Holds the authoritative
 * Game and the set of connected WebSockets, and broadcasts state on change.
 */
export class GameRoom {
  private game: Game | null = null;
  private roomCode = '';
  private sockets = new Map<WebSocket, string>(); // ws -> playerId

  constructor(_state: DurableObjectState, _env: unknown) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const code = (url.searchParams.get('room') || '').toUpperCase();
    if (code) this.roomCode = code;

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    const playerId = crypto.randomUUID();
    this.sockets.set(server, playerId);

    server.addEventListener('message', (evt) => this.onMessage(server, evt));
    server.addEventListener('close', () => this.onClose(server));
    server.addEventListener('error', () => this.onClose(server));

    server.send(JSON.stringify({ event: 'welcome', id: playerId }));
    if (this.game) {
      server.send(JSON.stringify({ event: 'state', state: this.game.getState() }));
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  private send(ws: WebSocket, obj: unknown) {
    try {
      ws.send(JSON.stringify(obj));
    } catch {
      /* socket closing */
    }
  }

  private broadcast() {
    if (!this.game) return;
    const msg = JSON.stringify({ event: 'state', state: this.game.getState() });
    for (const ws of this.sockets.keys()) {
      try {
        ws.send(msg);
      } catch {
        /* ignore */
      }
    }
  }

  private onClose(ws: WebSocket) {
    const playerId = this.sockets.get(ws);
    this.sockets.delete(ws);
    if (this.game && playerId) {
      this.game.removePlayer(playerId);
      this.broadcast();
    }
  }

  private onMessage(ws: WebSocket, evt: MessageEvent) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(typeof evt.data === 'string' ? evt.data : '');
    } catch {
      return;
    }
    const playerId = this.sockets.get(ws);
    if (!playerId) return;

    const ack = (ok: boolean, extra: Record<string, unknown> = {}) =>
      this.send(ws, { reqId: msg.reqId, ok, ...extra });

    const p = msg.payload || {};

    switch (msg.event) {
      case 'createRoom': {
        const name = String(p.username || '').trim();
        if (!name) return ack(false, { error: 'name_required' });
        if (!this.game) this.game = new Game(this.roomCode || 'ROOM');
        const res = this.game.addPlayer(playerId, name);
        ack(res.ok, { error: res.error, roomId: this.roomCode });
        this.broadcast();
        return;
      }
      case 'joinRoom': {
        const name = String(p.username || '').trim();
        if (!this.game || this.game.players.length === 0) {
          return ack(false, { error: 'room_not_found' });
        }
        const res = this.game.addPlayer(playerId, name);
        ack(res.ok, { error: res.error, roomId: this.roomCode });
        this.broadcast();
        return;
      }
      case 'leaveRoom': {
        if (this.game) this.game.removePlayer(playerId);
        ack(true);
        this.broadcast();
        return;
      }
    }

    if (!this.game) return ack(false, { error: 'no_room' });
    const g = this.game;
    let res: { ok: boolean; error?: string } = { ok: false, error: 'unknown_event' };

    switch (msg.event) {
      case 'startGame':
        res = g.start(playerId);
        break;
      case 'rollDice':
        res = g.rollDice(playerId, Number(p.diceCount) || 1);
        break;
      case 'chooseDeal':
        res = g.chooseDeal(playerId, p.size);
        break;
      case 'cardAction':
        res = g.cardAction(playerId, p.action, p.payload);
        break;
      case 'takeLoan':
        res = g.takeLoan(playerId, Number(p.amount));
        break;
      case 'payLoan':
        res = g.payLoan(playerId, p.type as keyof Liabilities, Number(p.amount));
        break;
      case 'liquidate':
        res = g.liquidate(playerId);
        break;
      case 'chooseDream':
        res = g.chooseDream(playerId, p.dreamId);
        break;
      case 'fastTrackAction':
        res = g.fastTrackAction(playerId, p.action);
        break;
      case 'endTurn':
        res = g.endTurn(playerId);
        break;
    }

    ack(res.ok, { error: res.error });
    this.broadcast();
  }
}
