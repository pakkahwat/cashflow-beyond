# Cashflow Beyond v2 — Phase 2a: Realtime Backbone (custom server + WebSocket + RoomManager) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the authoritative realtime game backend as a Node WebSocket server inside the Next.js app — porting the existing `GameRoom.ts` protocol into an in-memory `RoomManager`, exposing the HTTP board/room APIs as Next route handlers, and a custom server that serves both — proven by an integration test where two real WebSocket clients create/join a room and drive the engine.

**Architecture:** The audited engine (`app-next/engine`) is the source of truth. A single Node process holds all rooms in memory (`RoomManager: Map<code, Room>`). The WebSocket protocol (reqId/ack request-reply + `state` broadcast) is ported verbatim from the Cloudflare `GameRoom.ts`, minus all Durable-Object persistence (rooms are in-memory; the spec accepts losing active games on restart). A reusable `attachWsServer(httpServer)` is shared by the production custom server (`server.ts` = `next()` + ws on one port) and a dev-only bare ws server (`ws-dev.ts`), because Next 16 forces Turbopack for `next dev` and we run the UI via `next dev` + a separate ws process in development.

**Tech Stack:** Next.js 16 (App Router) + React 19, TypeScript, `ws` (WebSocket library), `tsx` (run the TS custom server), Vitest (integration test). Node ≥ 22.13 in Docker.

**Spec:** `docs/superpowers/specs/2026-06-23-nextjs-firebase-auth-mongo-selfhost-design.md`
**Prior phase:** Phase 1 (foundation) complete — `app-next/` scaffolded (Next 16.2.9 / React 19.2.4), engine + data ported, 30 engine tests green.

## Global Constraints

Copied verbatim from the spec and the locked Phase-2 decisions; every task inherits these.

- **Branch:** all work on `feat/nextjs-rewrite`. Do not touch `main`.
- **App location:** all new code under `app-next/`.
- **Next version:** stay on **Next 16** (user decision "เอาใหม่สุด"). No downgrade/re-scaffold.
- **Dev vs prod servers:** PROD = one custom Node server `server.ts` (`next({ dev: false })` + ws) on a single port. DEV = `next dev` (Turbopack) for the UI on its own port **plus** a separate bare ws server `ws-dev.ts`. Both share `attachWsServer(httpServer)`. Do NOT call `next({ dev: true })` programmatically (avoids the Next-16 Turbopack-custom-server caveat).
- **Realtime transport:** native WebSocket with the EXISTING protocol — client sends `{ reqId, event, payload }`; server replies `{ reqId, ok, error?, roomId? }`; server broadcasts `{ event: 'state', state }`; on connect the server sends `{ event: 'ready' }`. Ported from `cashflow-modern/worker/src/GameRoom.ts`.
- **Rooms are in-memory.** No persistence across server restart (NO Durable-Object `storage`/`hydrate`/`save`/`blockConcurrencyWhile` — those are dropped in the port). A *client* refresh still resumes because the room lives in the server process.
- **Authoritative engine:** the server only ever mutates game state through `app-next/engine` `Game` methods. Never trust client-reported state.
- **Server-authoritative writes (later):** Mongo/stats writes are Phase 4 — do NOT add them here. Auth/token verification is Phase 3 — do NOT add it here. `playerId` in this phase remains the client-supplied id (Phase 3 replaces it with the Firebase uid).
- **Do not modify** `app-next/engine/*` or `app-next/data/*` (audited).

## Source of truth for the port

`cashflow-modern/worker/src/GameRoom.ts` (223 lines) and `cashflow-modern/worker/src/index.ts` are the reference. The engine `Game` public API used by the protocol: `addPlayer(id, username)`, `setConnected(id, bool)`, `removePlayer(id)`, `start(id)`, `setDifficulty(id, 'normal'|'easy')`, `rollDice(id, n)`, `chooseDeal(id, size)`, `cardAction(id, action, payload)`, `takeLoan(id, n)`, `payLoan(id, type, n)`, `liquidate(id)`, `chooseDream(id, dreamId)`, `enterFastTrack(id)`, `fastTrackAction(id, action)`, `endTurn(id)`, `getState()` (public client state used in broadcasts), plus `players` (array with `.id`). Action methods return `{ ok: boolean; error?: string }`.

---

## File Structure (Phase 2a)

- `app-next/lib/ws/RoomManager.ts` — **new.** In-memory room registry: `Map<code, Room>` where `Room = { code: string; game: Game; sockets: Map<WebSocket, string> }`. Methods: `get(code)`, `getOrCreate(code)`, `delete(code)`. One responsibility: room lifecycle/lookup.
- `app-next/lib/ws/gameSocket.ts` — **new.** The protocol handler ported from `GameRoom.ts`: `attachWsServer(httpServer)` creates a `ws` server (`noServer`), handles `upgrade` on `/ws?room=CODE`, and per-connection wires `onMessage`/`onClose` with join/resume/attach/broadcast logic. No persistence.
- `app-next/server.ts` — **new.** Production custom server: `next({ dev: false })` request handler on an `http` server + `attachWsServer`. Run with `tsx`.
- `app-next/ws-dev.ts` — **new.** Dev-only bare `http` server (no Next) + `attachWsServer`, on a separate port for use alongside `next dev`.
- `app-next/app/api/board/route.ts` — **new.** `GET` → `{ dreams: DREAMS, fastTrack: FAST_TRACK_BOARD }` from `app-next/data/fastTrack`.
- `app-next/app/api/room/route.ts` — **new.** `POST` → `{ roomId: <new code> }` via a ported `makeCode()`.
- `app-next/lib/roomCode.ts` — **new.** `makeCode(): string` (ported from `worker/src/index.ts`).
- `app-next/lib/ws/gameSocket.integration.test.ts` — **new.** Vitest integration test booting `attachWsServer` on an ephemeral port and driving it with real `ws` clients.
- `app-next/package.json` — **modify.** Add deps `ws`, `tsx`; devDep `@types/ws`; scripts for the custom server + dev ws server.

---

### Task 1: HTTP route handlers — `/api/board` and `/api/room`

**Files:**
- Create: `app-next/lib/roomCode.ts`
- Create: `app-next/app/api/room/route.ts`
- Create: `app-next/app/api/board/route.ts`
- Test: `app-next/lib/roomCode.test.ts`

**Interfaces:**
- Consumes: `app-next/data/fastTrack` exports `DREAMS` and `FAST_TRACK_BOARD` (confirm the exact export names by reading `app-next/data/fastTrack.ts` first).
- Produces: `makeCode(): string` (5 chars from alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`); `GET /api/board` → `{ dreams, fastTrack }`; `POST /api/room` → `{ roomId }`.

- [ ] **Step 1: Write the failing test for `makeCode`**

Create `app-next/lib/roomCode.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { makeCode } from './roomCode.js';

describe('makeCode', () => {
  it('returns a 5-char code from the unambiguous alphabet', () => {
    const code = makeCode();
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
  });
  it('is reasonably unique across calls', () => {
    const codes = new Set(Array.from({ length: 200 }, () => makeCode()));
    expect(codes.size).toBeGreaterThan(190); // collisions extremely unlikely
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd app-next && npx vitest run lib/roomCode.test.ts`
Expected: FAIL — cannot resolve `./roomCode.js` (module not found).

- [ ] **Step 3: Implement `makeCode`**

Create `app-next/lib/roomCode.ts`:
```typescript
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** 5-character room code from an unambiguous alphabet (ported from the worker). */
export function makeCode(): string {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ROOM_ALPHABET[b % ROOM_ALPHABET.length]).join('');
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd app-next && npx vitest run lib/roomCode.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Add the route handlers**

First read `app-next/data/fastTrack.ts` to confirm the export names (`DREAMS`, `FAST_TRACK_BOARD`). Then create `app-next/app/api/board/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { DREAMS, FAST_TRACK_BOARD } from '../../../data/fastTrack.js';

export function GET() {
  return NextResponse.json({ dreams: DREAMS, fastTrack: FAST_TRACK_BOARD });
}
```
Create `app-next/app/api/room/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { makeCode } from '../../../lib/roomCode.js';

export function POST() {
  return NextResponse.json({ roomId: makeCode() });
}
```

- [ ] **Step 6: Verify the build typechecks the new routes**

Run: `cd app-next && npm run build`
Expected: build succeeds; `/api/board` and `/api/room` appear as route handlers in the build output.

- [ ] **Step 7: Commit**

```bash
cd /Users/palm/Desktop/projects/cashflow-beyond
git add app-next/lib/roomCode.ts app-next/lib/roomCode.test.ts app-next/app/api
git commit -m "feat: add /api/board and /api/room route handlers + makeCode"
```

---

### Task 2: RoomManager + WebSocket protocol handler (ported, in-memory)

**Files:**
- Create: `app-next/lib/ws/RoomManager.ts`
- Create: `app-next/lib/ws/gameSocket.ts`
- Test: `app-next/lib/ws/gameSocket.integration.test.ts`
- Modify: `app-next/package.json` (add `ws`, `@types/ws`)

**Interfaces:**
- Consumes: `Game` from `app-next/engine/Game.js` (constructor `new Game(code)`, methods per "Source of truth"); the `ws` library.
- Produces: `attachWsServer(server: http.Server): void` — attaches a `ws` server that handles `upgrade` on `/ws?room=CODE` and runs the full game protocol. `RoomManager` with `getOrCreate(code): Room`, `get(code): Room | undefined`, `delete(code): void`, `Room = { code: string; game: Game; sockets: Map<WebSocket, string> }`.

- [ ] **Step 1: Add the `ws` dependency**

Run: `cd app-next && npm install ws && npm install -D @types/ws`
Expected: `ws` in `dependencies`, `@types/ws` in `devDependencies`.

- [ ] **Step 2: Write `RoomManager`**

Create `app-next/lib/ws/RoomManager.ts`:
```typescript
import type { WebSocket } from 'ws';
import { Game } from '../../engine/Game.js';

export interface Room {
  code: string;
  game: Game;
  sockets: Map<WebSocket, string>; // ws -> playerId
}

/** In-memory registry of active rooms. One process owns all rooms; nothing is
 *  persisted, so a server restart drops in-progress games (accepted per spec). */
export class RoomManager {
  private rooms = new Map<string, Room>();

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  getOrCreate(code: string): Room {
    let room = this.rooms.get(code);
    if (!room) {
      room = { code, game: new Game(code), sockets: new Map() };
      this.rooms.set(code, room);
    }
    return room;
  }

  delete(code: string): void {
    this.rooms.delete(code);
  }
}

export const rooms = new RoomManager();
```

- [ ] **Step 3: Write the integration test FIRST (RED)**

Create `app-next/lib/ws/gameSocket.integration.test.ts`. It boots the ws server on an ephemeral port, connects two real `ws` clients, and exercises the create/join/start/roll protocol. Note the engine's exact action names and the `state` shape are validated indirectly (acks + a `state` event arriving).

```typescript
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
});
```

- [ ] **Step 4: Run the test to confirm it fails**

Run: `cd app-next && npx vitest run lib/ws/gameSocket.integration.test.ts`
Expected: FAIL — cannot resolve `./gameSocket.js`.

- [ ] **Step 5: Implement `attachWsServer` (port of GameRoom.ts, no persistence)**

Create `app-next/lib/ws/gameSocket.ts`. Port the `GameRoom` message/connection logic onto the `ws` library: replace `WebSocketPair`/`server.accept()` with the `ws` `connection` event, drop `save()`/`hydrate()`/`blockConcurrencyWhile`/`storage`, and resolve the room from `RoomManager` by the `?room=` query. The `join`/`resume`/reconnect/`attach`/`broadcast`/`onClose` rules and the action `switch` are ported verbatim from `GameRoom.ts` (lines 64–222).

```typescript
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
```

- [ ] **Step 6: Run the integration test to confirm it passes**

Run: `cd app-next && npx vitest run lib/ws/gameSocket.integration.test.ts`
Expected: PASS (2 tests). If `getState` is not a method on `Game`, read `app-next/engine/Game.ts` to find the public-state method the original broadcast used (the Cloudflare `GameRoom.ts:74` calls `this.game.getState()`) and use that exact name — do not invent one.

- [ ] **Step 7: Run the whole suite (engine + new) to confirm no regressions**

Run: `cd app-next && npm run test`
Expected: 30 engine tests + 2 roomCode + 2 ws integration = 34 passing, output pristine.

- [ ] **Step 8: Commit**

```bash
cd /Users/palm/Desktop/projects/cashflow-beyond
git add app-next/lib/ws app-next/package.json app-next/package-lock.json
git commit -m "feat: port game WebSocket protocol to in-memory RoomManager + ws server"
```

---

### Task 3: Custom production server + dev ws server + scripts

**Files:**
- Create: `app-next/server.ts`
- Create: `app-next/ws-dev.ts`
- Modify: `app-next/package.json` (add `tsx`; add scripts)

**Interfaces:**
- Consumes: `attachWsServer` from `lib/ws/gameSocket.js`; `next`.
- Produces: `npm run start:prod` (custom server), `npm run dev:ws` (dev ws server). The production server serves Next HTTP + `/ws` on `PORT` (default 8080); the dev ws server serves `/ws` on `WS_PORT` (default 3001).

- [ ] **Step 1: Add `tsx`**

Run: `cd app-next && npm install -D tsx`
Expected: `tsx` in `devDependencies`.

- [ ] **Step 2: Write the dev ws server**

Create `app-next/ws-dev.ts`:
```typescript
import { createServer } from 'http';
import { attachWsServer } from './lib/ws/gameSocket.js';

const port = Number(process.env.WS_PORT) || 3001;
const server = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ws-dev: game socket server\n');
});
attachWsServer(server);
server.listen(port, () => console.log(`[ws-dev] game socket on :${port}/ws`));
```

- [ ] **Step 3: Write the production custom server**

Create `app-next/server.ts`:
```typescript
import { createServer } from 'http';
import next from 'next';
import { attachWsServer } from './lib/ws/gameSocket.js';

const port = Number(process.env.PORT) || 8080;
const app = next({ dev: false });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));
  attachWsServer(server);
  server.listen(port, () => console.log(`[server] Next + game socket on :${port}`));
});
```

- [ ] **Step 4: Add scripts**

In `app-next/package.json` `"scripts"`, add:
```json
"dev:ws": "tsx ws-dev.ts",
"start:prod": "tsx server.ts"
```
(Leave the default `dev`/`build`/`start`/`lint`/`test` scripts as they are.)

- [ ] **Step 5: Verify the production server boots against a real build**

Run:
```bash
cd app-next && npm run build && (PORT=8099 npm run start:prod & sleep 8 && \
  curl -sS -o /dev/null -w "home=%{http_code}\n" http://localhost:8099/ && \
  curl -sS -o /dev/null -w "board=%{http_code}\n" http://localhost:8099/api/board && \
  kill %1)
```
Expected: `home=200` and `board=200` (Next serves the page and the route handler through the custom server). If `%1` job control misbehaves, stop the server by another means; the goal is the two `200`s.

- [ ] **Step 6: Verify the dev ws server boots**

Run:
```bash
cd app-next && (WS_PORT=3199 npm run dev:ws & sleep 3 && \
  curl -sS -o /dev/null -w "wsdev=%{http_code}\n" http://localhost:3199/ && kill %1)
```
Expected: `wsdev=200`.

- [ ] **Step 7: Confirm tests still green**

Run: `cd app-next && npm run test`
Expected: 34 passing.

- [ ] **Step 8: Commit**

```bash
cd /Users/palm/Desktop/projects/cashflow-beyond
git add app-next/server.ts app-next/ws-dev.ts app-next/package.json app-next/package-lock.json
git commit -m "feat: custom production server (next + ws) and dev ws server + scripts"
```

---

## Self-Review

**1. Spec coverage (Phase 2a portion):** The custom-server + ws architecture (spec §3, §6), the in-memory `RoomManager` (spec §6), the ported reqId/ack + `state` protocol (spec locked decisions), and the `/api/board` + `/api/room` HTTP endpoints (client `fetchBoard`/`createRoom` needs, spec §3 layout) are all implemented across Tasks 1–3. The client WS transport + 3D UI + i18n are **Phase 2b**; Firebase auth is **Phase 3**; Mongo/stats are **Phase 4**; Docker/cloudflared are **Phase 5** — explicitly out of this plan, not gaps.

**2. Placeholder scan:** No "TBD/handle later". Task 2 Step 6 carries an explicit fallback instruction (read `Game.ts` for the exact public-state method name) rather than guessing — grounded, not a placeholder. All code blocks are complete and runnable.

**3. Type consistency:** `attachWsServer(server: http.Server): void`, `Room = { code, game, sockets: Map<WebSocket, string> }`, and `rooms` (singleton `RoomManager`) are named identically across `RoomManager.ts`, `gameSocket.ts`, `server.ts`, `ws-dev.ts`, and the test. The engine action method names + `getState()` match the verified `GameRoom.ts` reference. `makeCode()` is defined in Task 1 and consumed in the Task 1 route handler.

---

## Phase 2a → 2b handoff (next plan)

After 2a is green: **Phase 2b — UI port**: port the client WS transport (`lib/socket.ts`, env-driven ws base URL — dev `ws://localhost:3001`, prod same-origin), the 3D board (React Three Fiber **v9** for React 19) and all screens (Home/Lobby/Game/Card modals/winner/etc.), the zustand store, i18n (TH/EN + 147 card strings), and styles — turning the green backbone into a fully playable game in the browser. The client transport's real end-to-end verification happens there (the UI exercising it), plus Playwright two-client smoke.
