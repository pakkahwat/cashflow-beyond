# Cashflow Beyond v2 — Phase 2c: Play-vs-Bot Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Let a player play against 1–3 server-driven bot opponents — bots are added to a room as players and the authoritative server auto-plays their turns with a watchable cadence, using a sensible heuristic policy built on the existing engine rules.

**Architecture:** Bots are normal `Game` players created by the server (synthetic ids like `bot:1`), tracked per-room in a `bots: Set<string>` on `Room`. They never connect over WebSocket and never present a token (they are server-created, bypassing the human auth gate). After every state change, the ws server checks whether the current turn belongs to a bot and, if so, schedules the bot's next action (~700 ms apart) via a `botPolicy(state, botId)` that maps the engine's currently-expected decision to the matching `Game` method call — looping (with a per-turn safety cap) until control returns to a human. The policy is pure and unit-tested; the auto-play loop is integration-tested over a real bot game.

**Tech Stack:** the existing engine (`app-next/engine`), the Phase-2a ws server (`app-next/lib/ws`), Phase-2b client.

**Spec note:** This extends the spec's gameplay; it is additive and gated by Phase-3 auth (human must be signed in). **Prior:** Phases 1, 2a, 2b complete (playable). Slots BEFORE Phase 3/4/5 so auth gates it and Mongo records `vsBots` games.

## Global Constraints
- Branch `feat/nextjs-rewrite`; never `main`; work from repo root. All code under `app-next/`.
- Do NOT modify `app-next/engine/*` or `app-next/data/*`. Bots use the engine's PUBLIC methods only (`addPlayer`, `rollDice`, `chooseDeal`, `cardAction`, `takeLoan`, `enterFastTrack`, `chooseDream`, `fastTrackAction`, `endTurn`, `getState`). Discover the engine's "what decision is expected now" signal by reading `getState()` (current player, phase, pending card/deal) — do not assume field names; build the policy against the REAL state shape.
- Bots are **server-authoritative & non-networked**: created by server commands, not by a ws `join`; they have no token. Only a signed-in human (Phase 3) may start a bot game.
- **No deadlocks/infinite loops:** the auto-play loop runs only while the current player is a bot, advances on each successful action, and is bounded by a per-turn action cap; it always reaches `endTurn` or a human turn.
- Bot decision quality: a reasonable heuristic (not optimal, not random) — buys deals it can afford with positive cash flow, takes the small deal / skips when low on cash, sells when an action requires it, repays/borrows minimally to avoid bankruptcy, enters Fast Track when eligible, picks a dream, ends the turn otherwise.
- Pacing: `BOT_DELAY_MS` env (default 700) between bot actions.

## File Structure
- `app-next/lib/ws/botPolicy.ts` — NEW. `nextBotAction(state, botId): { method, args } | null` (pure): inspects the public state and returns the next engine call for the bot, or null when the bot should end its turn / has nothing to do.
- `app-next/lib/ws/botRunner.ts` — NEW. `maybeRunBots(room, broadcast)` — if the current turn is a bot's, schedule and execute its actions (`BOT_DELAY_MS` apart) via `botPolicy`, re-broadcasting after each, until a human's turn or the game ends; bounded by an action cap.
- `app-next/lib/ws/RoomManager.ts` — EDIT. Add `bots?: Set<string>` to `Room`.
- `app-next/lib/ws/gameSocket.ts` — EDIT. Handle two new events: `createBotGame` (`{ count }`) — add the human + N bots and start; `addBot` (lobby) — add one bot. After every action broadcast, call `maybeRunBots(room, ...)`. Mark bot match results with `vsBots` for Phase 4.
- `app-next/client/components/Home.tsx` (in `app-next/client/`) — EDIT. Add "Play vs Bots" with a 1–3 count selector → emits `createBotGame`.
- `app-next/client/components/Lobby.tsx` — EDIT. Add an "Add bot" control → emits `addBot`.
- `app-next/client/lib/socket.ts` — EDIT. Add `createBotGame(count)` / `addBot()` emitters.
- i18n: add keys for the new buttons in `app-next/client/i18n/{th,en}.json`.

---

### Task 1: Bot policy (pure, unit-tested) + auto-play runner + server commands

**Files:** create `app-next/lib/ws/botPolicy.ts`, `app-next/lib/ws/botPolicy.test.ts`, `app-next/lib/ws/botRunner.ts`; edit `app-next/lib/ws/RoomManager.ts`, `app-next/lib/ws/gameSocket.ts`, and the integration test.

**Interfaces:**
- Produces: `nextBotAction(state, botId): { method: keyof BotActions; args: unknown[] } | null`; `maybeRunBots(room, broadcast): void`. Server events `createBotGame`/`addBot`. `Room.bots: Set<string>`.

- [ ] **Step 1: Read the engine state machine.** Read `app-next/engine/Game.ts` `getState()` + the action methods to learn, for the current player: the phase (`ratRace`/`fastTrack`), whether a dice roll is awaited, whether a deal/card decision is pending (and its options), cash on hand, whether Fast Track entry/dream/fastTrack actions are due. Record these REAL field names in your report — the policy depends on them.
- [ ] **Step 2: Write `botPolicy.test.ts` FIRST.** Construct minimal public-state fixtures (per Step 1) for several situations — (a) awaiting roll → expects `rollDice`; (b) affordable positive-cashflow deal pending → `cardAction buy`; (c) unaffordable deal / low cash → skip or small deal; (d) Fast-Track-eligible → `enterFastTrack`; (e) nothing pending → `endTurn` (i.e. returns null so the runner ends the turn) — and assert `nextBotAction` returns the right call. Run red.
- [ ] **Step 3: Implement `botPolicy.ts`.** Pure function mapping state → next action per the heuristic in Global Constraints. No I/O, no engine mutation. Run the test green.
- [ ] **Step 4: `Room.bots` + `botRunner.ts`.** Add `bots?: Set<string>` to `Room`. Implement `maybeRunBots(room, broadcast)`: if `state.currentPlayerId ∈ room.bots` (use the real "current player" field), loop: compute `nextBotAction`; if null → `room.game.endTurn(botId)` and stop; else call `room.game[method](botId, ...args)`; `broadcast(room)`; wait `BOT_DELAY_MS`; cap at e.g. 40 actions/turn (guard). Use `setTimeout` chaining (not a busy loop). Stop when the current player becomes non-bot or the game ends.
- [ ] **Step 5: Wire server events in `gameSocket.ts`.** Add cases: `createBotGame` → ensure the human is joined (verified uid), add `count` bots (`bot:1..N`) via `game.addPlayer('bot:i', 'Bot i')`, record them in `room.bots`, `game.start(humanId)`, broadcast, then `maybeRunBots`. `addBot` → add one bot to the lobby + broadcast. After EVERY action's broadcast (the existing switch), call `maybeRunBots(room, broadcast)` so bot turns follow human turns automatically. Mark the room so Phase-4 `recordMatch` can set `vsBots = room.bots.size > 0`.
- [ ] **Step 6: Integration test.** In `gameSocket.integration.test.ts` (bypass auth as before), connect one client, emit `createBotGame { count: 1 }` (with a test token), and assert: the game starts with 2 players, and after a short wait the bot has taken its turn and control returns to the human (the state's current player cycles). Use `BOT_DELAY_MS=10` via env for speed.
- [ ] **Step 7:** `npm run test` green. Commit (`feat: server-driven bot opponents (policy + auto-play runner + createBotGame/addBot)`).

---

### Task 2: Client UI — Play vs Bots + Add Bot

**Files:** edit `app-next/client/components/Home.tsx`, `app-next/client/components/Lobby.tsx`, `app-next/client/lib/socket.ts`, `app-next/client/i18n/th.json`, `app-next/client/i18n/en.json`.

- [ ] **Step 1: Socket emitters.** In `client/lib/socket.ts`, add `createBotGame(count: number)` (connect to a new room from `POST /api/room`, then emit `createBotGame` with the token + count) and `addBot()` (emit `addBot`). Mirror the existing `createRoom` flow for connection/token handling.
- [ ] **Step 2: Home entry.** In `Home.tsx`, add a "Play vs Bots" button + a 1–3 selector (default 1) that calls `createBotGame(count)` and transitions into the game (same `setRoom` path as create). Use new i18n keys `home.playVsBots`, `home.botCount`.
- [ ] **Step 3: Lobby "Add bot".** In `Lobby.tsx`, add an "Add bot" button (host only) calling `addBot()`. i18n key `lobby.addBot`.
- [ ] **Step 4: i18n.** Add the new keys to `th.json` and `en.json` (Thai + English).
- [ ] **Step 5: Verify.** `npm run build` green; extend the Playwright e2e (or add `e2e/bot.spec.ts`) so a single signed-out-bypassed/real session can start a bot game and observe the bot taking a turn (board advances without a second human). `npm run test` green. Commit (`feat: Play-vs-Bots UI (Home + Lobby) + i18n`).

---

## Self-Review
**1. Coverage:** server bot players + heuristic policy + auto-play runner + entry points (Home/Lobby) + i18n + `vsBots` stat flag. Bots reuse engine public methods only; the human auth gate is respected (bots are server-created).
**2. Placeholder scan:** policy/runner code is concrete except the exact engine state fields, which are deferred to a grounded "read Game.ts getState()" step (must come from real code). The loop has an explicit deadlock guard (action cap + advance-or-stop).
**3. Consistency:** `nextBotAction`/`maybeRunBots`/`Room.bots`/`createBotGame`/`addBot` names are shared across `botPolicy.ts`, `botRunner.ts`, `RoomManager.ts`, `gameSocket.ts`, the tests, and the client emitters. `BOT_DELAY_MS` used in `botRunner.ts` and overridden in tests.

## Roadmap placement
Sequence: 2b (playable) → **2c (this — bot mode)** → 3 (auth gates bot games to signed-in humans) → 4 (Mongo records bot matches with `vsBots`) → 5 (Docker ships everything). Phase 4's `recordMatch`/`buildMatch` will read the `vsBots` flag set here (add it to the match doc).
