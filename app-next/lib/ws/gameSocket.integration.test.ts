import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'http';
import { AddressInfo } from 'net';
import WebSocket from 'ws';
import { attachWsServer } from './gameSocket.js';

let server: Server;
let port: number;

beforeAll(async () => {
  server = createServer();
  attachWsServer(server);
  await new Promise<void>((r) => server.listen(0, r));
  port = (server.address() as AddressInfo).port;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

// Minimal promise-based client over the reqId/ack protocol.
function connect(code: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?room=${code}`);
  const acks = new Map<string, (m: any) => void>();
  const states: any[] = [];
  let ready: () => void;
  const readyP = new Promise<void>((r) => (ready = r));
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.event === 'ready') return ready();
    if (msg.event === 'state') return void states.push(msg.state);
    if (msg.reqId && acks.has(msg.reqId)) {
      acks.get(msg.reqId)!(msg);
      acks.delete(msg.reqId);
    }
  });
  const emit = (event: string, payload: any = {}) =>
    new Promise<any>((resolve) => {
      const reqId = Math.random().toString(36).slice(2);
      acks.set(reqId, resolve);
      ws.send(JSON.stringify({ reqId, event, payload }));
    });
  return { ws, emit, states, readyP, close: () => ws.close() };
}

describe('game websocket protocol', () => {
  it('creates a room, lets a second player join, and broadcasts state', async () => {
    const code = 'TEST1';
    const a = connect(code);
    await a.readyP;
    const createAck = await a.emit('join', { playerId: 'p1', username: 'Alice', intent: 'create' });
    expect(createAck.ok).toBe(true);
    expect(createAck.roomId).toBe(code);

    const b = connect(code);
    await b.readyP;
    const joinAck = await b.emit('join', { playerId: 'p2', username: 'Bob', intent: 'join' });
    expect(joinAck.ok).toBe(true);

    // both sockets should have received at least one state broadcast
    await new Promise((r) => setTimeout(r, 50));
    expect(a.states.length).toBeGreaterThan(0);
    expect(b.states.length).toBeGreaterThan(0);

    a.close();
    b.close();
  });

  it('rejects joining a non-existent room', async () => {
    const c = connect('EMPTY');
    await c.readyP;
    const ack = await c.emit('join', { playerId: 'x', username: 'X', intent: 'join' });
    expect(ack.ok).toBe(false);
    expect(ack.error).toBe('room_not_found');
    c.close();
  });

  it('keeps a started room alive when all sockets disconnect (resume guarantee)', async () => {
    const code = 'RESM1';

    // Two players join so the engine's minimum-2-players check passes
    const a = connect(code);
    await a.readyP;
    await a.emit('join', { playerId: 'host', username: 'Host', intent: 'create' });

    const b = connect(code);
    await b.readyP;
    await b.emit('join', { playerId: 'p2', username: 'Player2', intent: 'join' });

    const startAck = await a.emit('startGame', {});
    expect(startAck.ok).toBe(true);

    // Simulate both tabs refreshing: all sockets close while game is running
    a.close();
    b.close();
    await new Promise((r) => setTimeout(r, 50));

    // Reconnect with intent: resume — room must still exist (not purged)
    const c = connect(code);
    await c.readyP;
    const resumeAck = await c.emit('join', { playerId: 'host', intent: 'resume' });
    expect(resumeAck.ok).toBe(true);
    expect(resumeAck.roomId).toBe(code);

    c.close();
  });
});
