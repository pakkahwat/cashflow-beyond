import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { rooms } from './rooms.js';
import { DREAMS, FAST_TRACK_BOARD } from './data/fastTrack.js';

const PORT = Number(process.env.PORT) || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.get('/health', (_req, res) => res.json({ ok: true }));
// Static board metadata for the client.
app.get('/api/board', (_req, res) => res.json({ dreams: DREAMS, fastTrack: FAST_TRACK_BOARD }));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: CLIENT_ORIGIN } });

// socket.id -> roomId
const socketRoom = new Map<string, string>();

const broadcast = (roomId: string) => {
  const game = rooms.get(roomId);
  if (game) io.to(roomId).emit('state', game.getState());
};

type Ack = (res: { ok: boolean; error?: string; roomId?: string }) => void;

io.on('connection', (socket: Socket) => {
  const inRoom = () => socketRoom.get(socket.id);

  const withGame = (cb: (game: ReturnType<typeof rooms.get>) => void) => {
    const roomId = inRoom();
    if (!roomId) return;
    cb(rooms.get(roomId));
  };

  socket.on('createRoom', ({ username }: { username: string }, ack: Ack) => {
    const name = (username || '').trim();
    if (!name) return ack?.({ ok: false, error: 'name_required' });
    const game = rooms.create();
    const res = game.addPlayer(socket.id, name);
    if (!res.ok) {
      rooms.delete(game.roomId);
      return ack?.(res);
    }
    socket.join(game.roomId);
    socketRoom.set(socket.id, game.roomId);
    ack?.({ ok: true, roomId: game.roomId });
    broadcast(game.roomId);
  });

  socket.on('joinRoom', ({ roomId, username }: { roomId: string; username: string }, ack: Ack) => {
    const name = (username || '').trim();
    const game = rooms.get((roomId || '').toUpperCase());
    if (!game) return ack?.({ ok: false, error: 'room_not_found' });
    const res = game.addPlayer(socket.id, name);
    if (!res.ok) return ack?.(res);
    socket.join(game.roomId);
    socketRoom.set(socket.id, game.roomId);
    ack?.({ ok: true, roomId: game.roomId });
    broadcast(game.roomId);
  });

  const action = (handler: (game: NonNullable<ReturnType<typeof rooms.get>>) => { ok: boolean; error?: string }) =>
    (_payload: unknown, ack: Ack) => {
      const roomId = inRoom();
      const game = roomId ? rooms.get(roomId) : undefined;
      if (!game) return ack?.({ ok: false, error: 'no_room' });
      const res = handler(game);
      ack?.(res);
      broadcast(game.roomId);
    };

  socket.on('startGame', action((g) => g.start(socket.id)));
  socket.on('rollDice', ((payload: { diceCount?: number }, ack: Ack) =>
    action((g) => g.rollDice(socket.id, payload?.diceCount ?? 1))(payload, ack)) as any);
  socket.on('chooseDeal', ((payload: { size: 'small' | 'big' }, ack: Ack) =>
    action((g) => g.chooseDeal(socket.id, payload.size))(payload, ack)) as any);
  socket.on('cardAction', ((payload: { action: string; payload?: any }, ack: Ack) =>
    action((g) => g.cardAction(socket.id, payload.action, payload.payload))(payload, ack)) as any);
  socket.on('takeLoan', ((payload: { amount: number }, ack: Ack) =>
    action((g) => g.takeLoan(socket.id, Number(payload.amount)))(payload, ack)) as any);
  socket.on('payLoan', ((payload: { type: any; amount: number }, ack: Ack) =>
    action((g) => g.payLoan(socket.id, payload.type, Number(payload.amount)))(payload, ack)) as any);
  socket.on('liquidate', action((g) => g.liquidate(socket.id)));
  socket.on('chooseDream', ((payload: { dreamId: string }, ack: Ack) =>
    action((g) => g.chooseDream(socket.id, payload.dreamId))(payload, ack)) as any);
  socket.on('fastTrackAction', ((payload: { action: 'buy' | 'skip' }, ack: Ack) =>
    action((g) => g.fastTrackAction(socket.id, payload.action))(payload, ack)) as any);
  socket.on('endTurn', action((g) => g.endTurn(socket.id)));

  socket.on('leaveRoom', (_p, ack: Ack) => {
    withGame((game) => {
      if (!game) return;
      game.removePlayer(socket.id);
      socket.leave(game.roomId);
      broadcast(game.roomId);
    });
    socketRoom.delete(socket.id);
    ack?.({ ok: true });
  });

  socket.on('disconnect', () => {
    withGame((game) => {
      if (!game) return;
      game.removePlayer(socket.id);
      broadcast(game.roomId);
    });
    socketRoom.delete(socket.id);
    rooms.cleanup();
  });
});

httpServer.listen(PORT, () => {
  console.log(`Cashflow server listening on http://localhost:${PORT}`);
});
