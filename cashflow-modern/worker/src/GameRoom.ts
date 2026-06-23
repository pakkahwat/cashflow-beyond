import { Game } from '../../server/src/engine/Game.js';
import type { Liabilities } from '../../server/src/engine/types.js';

interface ClientMessage {
  reqId?: string;
  event: string;
  payload?: any;
}

/**
 * One Durable Object instance == one game room. Holds the authoritative Game,
 * the connected WebSockets, and persists state to DO storage so a refresh (or
 * the DO being evicted) never loses the game. Players are keyed by a stable
 * client-provided playerId, which lets a player reclaim their seat on reconnect.
 */
export class GameRoom {
  private game: Game | null = null;
  private roomCode = '';
  private sockets = new Map<WebSocket, string>(); // ws -> playerId
  private state: DurableObjectState;
  private loaded: Promise<void>;

  constructor(state: DurableObjectState, _env: unknown) {
    this.state = state;
    this.loaded = state.blockConcurrencyWhile(async () => {
      const saved = await state.storage.get<any>('game');
      if (saved) {
        this.roomCode = saved.roomId || '';
        this.game = new Game(this.roomCode);
        this.game.hydrate(saved);
      }
    });
  }

  private async save() {
    if (this.game) await this.state.storage.put('game', this.game.toState());
  }

  async fetch(request: Request): Promise<Response> {
    await this.loaded;
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

    server.addEventListener('message', (evt) => this.onMessage(server, evt));
    server.addEventListener('close', () => this.onClose(server));
    server.addEventListener('error', () => this.onClose(server));

    // Tell the client the socket is ready; the client then sends `join`.
    server.send(JSON.stringify({ event: 'ready' }));

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
    if (!playerId || !this.game) return;
    // Another tab/socket may still represent this player.
    const stillConnected = [...this.sockets.values()].includes(playerId);
    if (stillConnected) return;
    this.game.removePlayer(playerId); // lobby: remove; started: mark disconnected (seat kept)
    this.broadcast();
    void this.save();
  }

  private attach(ws: WebSocket, playerId: string) {
    // Replace any previous socket for the same player (e.g. after refresh).
    for (const [s, id] of this.sockets) {
      if (id === playerId && s !== ws) {
        this.sockets.delete(s);
        try {
          s.close();
        } catch {
          /* ignore */
        }
      }
    }
    this.sockets.set(ws, playerId);
  }

  private onMessage(ws: WebSocket, evt: MessageEvent) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(typeof evt.data === 'string' ? evt.data : '');
    } catch {
      return;
    }
    const ack = (ok: boolean, extra: Record<string, unknown> = {}) =>
      this.send(ws, { reqId: msg.reqId, ok, ...extra });
    const p = msg.payload || {};

    // ---- join / create / resume (establishes this socket's playerId) ----
    if (msg.event === 'join') {
      const playerId = String(p.playerId || '').trim();
      const username = String(p.username || '').trim();
      const intent: 'create' | 'join' | 'resume' = p.intent || 'join';
      if (!playerId) return ack(false, { error: 'name_required' });

      const existing = this.game?.players.find((pl) => pl.id === playerId);

      if (intent === 'resume') {
        if (!this.game || !existing) return ack(false, { error: 'room_not_found' });
        this.game.setConnected(playerId, true);
        this.attach(ws, playerId);
        ack(true, { roomId: this.roomCode });
        this.broadcast();
        void this.save();
        return;
      }

      if (existing) {
        // Same player reconnecting (or a duplicate tab) — reclaim the seat.
        this.game!.setConnected(playerId, true);
        this.attach(ws, playerId);
        ack(true, { roomId: this.roomCode });
        this.broadcast();
        void this.save();
        return;
      }

      if (intent === 'join' && (!this.game || this.game.players.length === 0)) {
        return ack(false, { error: 'room_not_found' });
      }

      if (!this.game) this.game = new Game(this.roomCode || 'ROOM');
      const res = this.game.addPlayer(playerId, username);
      if (res.ok) this.attach(ws, playerId);
      ack(res.ok, { error: res.error, roomId: this.roomCode });
      this.broadcast();
      void this.save();
      return;
    }

    const playerId = this.sockets.get(ws);
    if (!playerId) return ack(false, { error: 'not_joined' });

    if (msg.event === 'leaveRoom') {
      this.game?.removePlayer(playerId);
      this.sockets.delete(ws);
      ack(true);
      this.broadcast();
      void this.save();
      return;
    }

    if (!this.game) return ack(false, { error: 'no_room' });
    const g = this.game;
    let res: { ok: boolean; error?: string } = { ok: false, error: 'unknown_event' };

    switch (msg.event) {
      case 'startGame':
        res = g.start(playerId);
        break;
      case 'setDifficulty':
        res = g.setDifficulty(playerId, p.difficulty === 'easy' ? 'easy' : 'normal');
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
      case 'enterFastTrack':
        res = g.enterFastTrack(playerId);
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
    void this.save();
  }
}
