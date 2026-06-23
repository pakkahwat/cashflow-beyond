# Cashflow Beyond v2 — Phase 4: MongoDB Profile/Stats + Profile Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Persist player profile, aggregate stats, and match history to MongoDB (`shared-mongo`), written **server-authoritatively** when a game ends, and show them on a profile screen — so a signed-in player accumulates a track record.

**Architecture:** The Node ws server (which holds the authoritative `Game`) detects when a game reaches its terminal state and writes one `matches` document plus atomic `$inc`/`$set`/`$max`/`$min` updates to the per-uid `users` document. The client reads its own data through `verifyToken`-gated route handlers (`/api/me`, `/api/matches`). All Mongo access is server-side; the client never holds a DB credential. The DB is the existing `shared-mongo` (Docker network `shared-db`) with a dedicated `cashflow_app` user on db `cashflow`.

**Tech Stack:** `mongodb` Node driver, Next route handlers, Phase-3 `verifyToken`.

**Spec:** §5. **Prior:** Phases 1–3 complete (playable + Google auth; ws join verifies token → `uid`; `verifyToken` at `app-next/lib/auth/verifyToken.ts`).

## Global Constraints
- Branch `feat/nextjs-rewrite`; never `main`; work from repo root.
- **DB target = `shared-mongo`** (Docker `shared-db`, internal `shared-mongo:27017`; published 127.0.0.1:27017). DB name `cashflow`. Dedicated **`cashflow_app`** user (role `readWrite` on `cashflow` only) — created during execution, NOT the provision/admin user. Connection via `MONGO_URL` env. The remote `203.113.14.27` is the TEST db (kept commented in env), never written casually.
- **Server-authoritative writes only.** Stats are computed from the engine's final state, never client-reported. Exactly one `matches` write per finished game (idempotency guard).
- Reads via `verifyToken`-gated routes; a user can read only their own `users`/`matches`.
- Do NOT modify `engine/*` or `data/*`. Discover the engine's terminal/winner signal by reading `app-next/engine/Game.ts` `getState()` (look for `status`/`winner`/finished fields) — do not assume field names.

## File Structure
- `app-next/lib/mongo.ts` — NEW. `getDb()` → memoized `MongoClient` from `MONGO_URL`; `users()`/`matches()` collection helpers; `ensureIndexes()`.
- `app-next/lib/stats.ts` — NEW. `buildMatch(roomCode, finalState, startedAt, endedAt)` (pure: engine state → match doc + per-player stat deltas) and `recordMatch(deps)` (writes match + applies user deltas). Pure builder is unit-tested.
- `app-next/lib/ws/RoomManager.ts` — EDIT. Add `recorded?: boolean` and `startedAt?: number` to `Room`.
- `app-next/lib/ws/gameSocket.ts` — EDIT. After each action's `broadcast`, if the game just became terminal and `!room.recorded`, set `room.recorded = true` and fire-and-forget `recordMatch(...)` (errors logged, never crash the game).
- `app-next/app/api/me/route.ts` — NEW. GET: verifyToken → upsert `profile.lastLoginAt`/`createdAt`, return `{ profile, stats }` (stats with derived `winRate`).
- `app-next/app/api/matches/route.ts` — NEW. GET: verifyToken → recent matches for the uid.
- `app-next/client/components/Profile.tsx` — NEW. Fetches `/api/me` + `/api/matches` (Bearer token), renders aggregate stats + recent matches; reachable from Home (a "Profile" button) and a back control.
- `app-next/client/App.tsx` / Home — EDIT. Add a Profile entry point.
- `app-next/.env.local.example` / `.env.development` — EDIT. Add `MONGO_URL` (+ commented test-db line).

---

### Task 1: Mongo client + pure stats builder (unit-tested) + provision DB

**Files:** create `app-next/lib/mongo.ts`, `app-next/lib/stats.ts`, `app-next/lib/stats.test.ts`; add `mongodb` dep; provision the DB user.

- [ ] **Step 1: Add the driver** — `cd app-next && npm install mongodb`.
- [ ] **Step 2: Read the engine's terminal/winner shape.** Read `app-next/engine/Game.ts` `getState()` and the FastTrack win path; record (in your report) the exact fields that indicate the game is finished and who won, plus each player's `passiveIncome`, whether they escaped the Rat Race, and turn count — `buildMatch` must read REAL fields. Do not invent names.
- [ ] **Step 3: Write `buildMatch` test FIRST.** Create `app-next/lib/stats.test.ts` that feeds a minimal fake final state (shaped per Step 2) into `buildMatch(...)` and asserts the produced `matches` doc (roomCode, winnerUid, per-player {uid,name,escapedRatRace,finalPassiveIncome,turnsPlayed,result}) and the per-user stat deltas (`gamesPlayed:+1`, win/loss increments, `bestPassiveIncome` max, `fastestRatRaceTurns` min). Run red.
- [ ] **Step 4: Implement `app-next/lib/stats.ts`.** `buildMatch(roomCode, finalState, startedAt, endedAt)` → `{ matchDoc, userDeltas: Array<{uid, inc, max, min, set}> }` (pure, no I/O). `recordMatch({ db, ... })` inserts the match and applies each delta via `updateOne({_id:uid}, { $inc, $max, $min, $set }, { upsert: true })`. Run the test green.
- [ ] **Step 5: Implement `app-next/lib/mongo.ts`** — memoized `MongoClient(process.env.MONGO_URL)`, `getDb()` → `cashflow` db, `users()`/`matches()`, `ensureIndexes()` (matches: `{ 'players.uid': 1, endedAt: -1 }`).
- [ ] **Step 6: Provision `cashflow_app` (execution-time infra).** Using an admin connection to `shared-mongo`, create the `cashflow` db's app user: `db.getSiblingDB('cashflow').createUser({ user:'cashflow_app', pwd:<generated>, roles:[{role:'readWrite', db:'cashflow'}] })`. Record the resulting `MONGO_URL` (`mongodb://cashflow_app:<pwd>@shared-mongo:27017/cashflow?authSource=cashflow`) and put it in `app-next/.env.local.example` (with a commented `# TEST: mongodb://...@203.113.14.27:...` line). Do NOT commit a real password — use a placeholder in the example file and report the real URL separately for the user's `.env.local`.
- [ ] **Step 7:** `npm run test` green. Commit (`feat: mongo client + server-authoritative stats builder`).

---

### Task 2: Game-end writer + profile/matches APIs + profile screen

**Files:** edit `app-next/lib/ws/RoomManager.ts`, `app-next/lib/ws/gameSocket.ts`; create `app-next/app/api/me/route.ts`, `app-next/app/api/matches/route.ts`, `app-next/client/components/Profile.tsx`; edit `app-next/client/App.tsx` (+ Home entry point) and env files.

- [ ] **Step 1: Room fields** — add `recorded?: boolean`, `startedAt?: number` to `Room` in `RoomManager.ts`; set `startedAt` when the game starts (in the `startGame` path).
- [ ] **Step 2: Game-end hook** — in `gameSocket.ts`, after the action `switch` + `broadcast`, read the engine state; if it indicates finished (per Phase-4 Task 1 Step 2 fields) and `!room.recorded`: `room.recorded = true; recordMatch(...).catch((e)=>console.error('recordMatch', e));`. Never throw into the game loop.
- [ ] **Step 3: `/api/me`** — GET: `verifyToken(Bearer)`; 401 if null; upsert `users` `{ _id: uid, profile.name, profile.photoURL, profile.createdAt(setOnInsert), profile.lastLoginAt(now) }`; return `{ profile, stats: { ...defaults, winRate } }`.
- [ ] **Step 4: `/api/matches`** — GET: verifyToken; return the uid's recent matches (`find({'players.uid':uid}).sort({endedAt:-1}).limit(20)`).
- [ ] **Step 5: Profile screen** — `Profile.tsx` fetches both (Bearer token via `getIdToken()`), renders aggregate stats + recent matches; reachable from Home and returns back. Match the app's existing visual style.
- [ ] **Step 6: Verify against real shared-mongo** — with `MONGO_URL` set, run a manual or scripted check that finishing a game writes one match + updates the user (note the method in the report). `npm run test` + `npm run build` green. Commit (`feat: game-end stats writer + /api/me, /api/matches + profile screen`).

---

## Self-Review
**1. Spec coverage (§5):** `users` (profile + aggregate) + `matches` (per-game deep stats); server-authoritative single write on game-end; `cashflow_app` user on `shared-mongo`; verifyToken-gated reads; profile screen. Matches the spec's data model.
**2. Placeholder scan:** `mongo.ts`/`stats.ts` get concrete code; `buildMatch`'s exact engine-field reads are deferred to a grounded "read Game.ts" step (Task 1 Step 2) because the field names must come from real code, not a guess.
**3. Consistency:** `recordMatch`/`buildMatch` signatures shared between `stats.ts`, its test, and the `gameSocket.ts` hook. `users`/`matches` shapes match `/api/me` + `/api/matches` reads and the profile screen. `MONGO_URL`/`cashflow_app`/db `cashflow` consistent across `mongo.ts`, provisioning, and env.

## Phase 4 → Phase 5 handoff
**Phase 5 — Docker + cloudflared + final "fill-in-and-play":** multi-stage Dockerfile (build Next → run `tsx server.ts`), `docker-compose.yml` (`cashflow-app` + `cloudflared`, external network `shared-db` to reach `shared-mongo`), consolidated `.env.example` listing every fill-in (Firebase web config, `FIREBASE_PROJECT_ID`, `MONGO_URL`, cloudflared tunnel token, authorized domains), a README with the exact steps, and removal of the old `cashflow-modern/` stack at cutover.
