# Cashflow Beyond v2 — Next.js Rewrite + Google Auth + MongoDB + Self-host — Design Spec

**Date:** 2026-06-23
**Status:** Approved design, pre-implementation
**Branch:** `feat/nextjs-rewrite` (isolated from `main`)
**Scope target:** A new Next.js app (fresh build). The current `cashflow-modern/` (Vite client + Cloudflare Worker/DO) is **replaced**; the repo-root legacy `cashflow-holmes` Express app remains out of scope and untouched.

> **TL;DR (ไทย):** เขียนเกมใหม่บน **Next.js (App Router) + custom Node server** บน branch ใหม่ — บังคับ **login ด้วย Google ผ่าน Firebase Authentication** (Auth อย่างเดียว ไม่ใช้ Firebase DB), เก็บ **โปรไฟล์/สถิติ/ประวัติแมตช์ลง MongoDB (`shared-mongo` ใน Docker)** แบบ **server-authoritative**, realtime ผ่าน **WebSocket** (custom server แปะ `ws`), **3D board เก็บเหมือนเดิม** (reuse R3F components) + **refresh UI รอบๆ เบาๆ ให้ cohesive**, deploy เป็น **Docker + cloudflared tunnel**. Game engine + card data (147 ใบ) ที่ audit แล้ว = **port/copy มาเป็นฐาน** ไม่เขียนกฎใหม่.

---

## 1. Context & Problem

### Current state (to be replaced)
- **Client:** `cashflow-modern/client` — Vite + React + TS + zustand + react-i18next + React Three Fiber (3D board, ~15 files), Tailwind v4. Talks to backend via **native WebSocket** (`/ws?room=CODE`) with a custom `reqId`/`ack` protocol; `playerId` is a localStorage UUID.
- **Backend (live):** `cashflow-modern/worker` — Cloudflare Workers + **Durable Objects** (`GameRoom.ts`, one DO per room code; authoritative game state in DO SQLite). This is the current production backend (`cashflow-beyond` on Cloudflare Workers).
- **Backend (legacy/unused):** `cashflow-modern/server` — Node Express + Socket.IO server (`index.ts` + `rooms.ts`); the client no longer talks to it.
- **Shared game logic:** `cashflow-modern/server/src/engine/*` (Rat Race + Fast Track rules, audited against Cashflow 101 — 7 bugs + 9 divergences already fixed) and `server/src/data/*` + `data/*.json` (147 cards, professions, board layout). Framework-agnostic TS.
- **Identity:** none. Players type a display name and create/join an ephemeral room.

### Goal (confirmed with user)
Rewrite the app fresh in **Next.js**, self-hosted in Docker behind a cloudflared tunnel, adding:
1. **Mandatory Google login** (Firebase Authentication) before play.
2. **Persistent player profile + stats + match history** in **MongoDB** (the existing `shared-mongo` Docker container) — written **server-authoritatively**.
3. **Keep the 3D board**; lightly **refresh the surrounding UI** for cohesion.

### Key technical constraint (made explicit)
Next.js App Router does **not** support long-lived WebSocket servers in route handlers / serverless. The standard pattern for self-hosted realtime is a **custom Node server** (`server.ts` that wraps `next()` and attaches a `ws` server to the same HTTP server for `/ws`). This is fully supported because we self-host in Docker (not Vercel serverless). Durable Objects are Cloudflare-only and cannot be containerized — hence the move to a Node process.

---

## 2. Locked decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Framework | **Next.js (App Router) + custom Node server** (`server.ts` = `next()` + `ws`) |
| Auth provider | **Firebase Authentication — Google sign-in, mandatory** (a gate before any play) |
| Firebase usage | **Auth only** — no Firestore, no Realtime Database |
| Server token verification | **`firebase-admin`** initialized with **`projectId` only** (no service account key); verifies signature + `aud` + `exp` |
| Identity | `playerId` = Firebase **`uid`**; display name / avatar = Google `displayName` / `photoURL` (no manual name entry) |
| Database | **MongoDB = `shared-mongo`** (Docker network `shared-db`, internal `shared-mongo:27017`) |
| DB user | new dedicated **`cashflow_app`** (role `readWrite` on db `cashflow` only) — per user policy, not the provision/migration user |
| DB target | prod → `shared-mongo`; test → remote `203.113.14.27` kept **commented** in config |
| Write model | **Server-authoritative** — only the server writes to Mongo; clients never write directly |
| Realtime transport | **native WebSocket** with the existing `reqId`/`ack` protocol (port `GameRoom.ts` logic into the Node `ws` server) |
| Room/game state | **in-memory** per-room `Game` instances (active games **not** persisted across server restarts) |
| Game engine + card data | **Reused** — `engine/*` ported as the rules base; `cards/professions/board` JSON copied. (Override available: re-author engine if desired.) |
| Visual scope | **3D board unchanged** (reuse R3F components); **light refresh** of surrounding UI (login, home, profile, HUD, modals) for cohesion — same brand/palette |
| Deploy | **Docker** (multi-stage build) + **cloudflared** service in **docker-compose**, joined to external network `shared-db` |
| Git | work on **`feat/nextjs-rewrite`** branch, isolated from `main` |

**Out of scope (YAGNI):** leaderboard, social features, friends, persisting in-progress games across server restarts, the legacy `cashflow-holmes` app.

---

## 3. Architecture overview

```
                ┌─────────────────── Browser ───────────────────┐
                │ Next.js client (React)                         │
                │  - Firebase Web SDK → Google sign-in → ID token│
                │  - 3D board (R3F, dynamic import, ssr:false)   │
                │  - WS client (reqId/ack), playerId = uid       │
                └───────┬───────────────────────────┬───────────┘
            HTTPS (Next) │                   WSS /ws │  (ID token in handshake)
                ┌────────▼───────────────────────────▼───────────┐
                │ Docker container: Next.js custom server (Node)  │
                │  server.ts = next() handler + ws server         │
                │  ┌─────────────┐  ┌──────────────────────────┐  │
                │  │ App Router  │  │ WS game server           │  │
                │  │  pages      │  │  RoomManager (in-memory) │  │
                │  │  /api/me    │  │  + game engine (ported)  │  │
                │  │  /api/matches│ │  on game-end → write Mongo│  │
                │  └──────┬──────┘  └────────────┬─────────────┘  │
                │   firebase-admin (verify token, projectId only) │
                └─────────┼────────────────────────┼─────────────┘
                          │  (mongodb driver)       │
                ┌─────────▼─────────────────────────▼─────────────┐
                │ shared-mongo (Docker, network shared-db)         │
                │  db `cashflow`: users, matches  (user cashflow_app)│
                └──────────────────────────────────────────────────┘

  Firebase project (Google cloud): Authentication only (Google provider)
  cloudflared (Docker, same compose): tunnel → public hostname → container
```

### Proposed project layout (new app)
The new app lives in a new top-level directory **`app-next/`** on the branch (keeps the old `cashflow-modern/` stack diffable until cutover; the old stack is removed at the end).
```
app-next/                 # new Next.js app root
├─ server.ts              # custom server: next() + ws (/ws) + RoomManager + engine; game-end → Mongo writer
├─ app/
│  ├─ layout.tsx          # AuthProvider, i18n provider, base styles
│  ├─ page.tsx            # login gate + create/join (client)
│  ├─ game/[code]/page.tsx# 3D board, dynamic(() => import, { ssr:false })
│  ├─ profile/page.tsx    # aggregate stats + match history
│  └─ api/
│     ├─ me/route.ts      # GET: verify token → read users doc
│     ├─ matches/route.ts # GET: verify token → recent matches for uid
│     └─ room/route.ts    # POST: create room code (verify token)
├─ lib/
│  ├─ firebase.client.ts  # Firebase Web SDK init (public config)
│  ├─ firebaseAdmin.ts    # admin init { projectId }, verifyIdToken()
│  ├─ mongo.ts            # Mongo client (cashflow_app), getDb()
│  ├─ stats.ts            # server-authoritative stat computation + writes
│  └─ ws/                 # WS protocol handlers (ported from GameRoom.ts)
├─ engine/                # PORTED game engine (Rat Race + Fast Track)
├─ data/                  # COPIED cards.json, professions.json, board layout
├─ components/            # React UI (3D board reused; surrounding UI refreshed)
├─ i18n/                  # th/en + 147 card strings (reused)
├─ Dockerfile
├─ docker-compose.yml     # cashflow-app + cloudflared, network shared-db
└─ .env.example
```

---

## 4. Authentication flow (Google login, mandatory)

1. App loads → `AuthProvider` checks Firebase auth state.
2. **Not signed in** → render only the **login gate** ("Sign in with Google", popup flow). No create/join, no game routes accessible (client guard + server-side token checks on every protected action).
3. **Signed in** → client holds the Firebase user + a current **ID token** (refreshed by the SDK). Display name/avatar come from the Google profile.
4. **Create/join room:** client opens the WS to `/ws?room=CODE` and sends the ID token in the connection handshake (query param or the first `join` message). The server calls `verifyIdToken(token)` (firebase-admin, `projectId` only). On success it derives the trusted `{ uid, name, picture }` and seats the player; `playerId = uid`.
5. **Protected HTTP endpoints** (`/api/me`, `/api/matches`, `/api/room`): client sends `Authorization: Bearer <idToken>`; the route handler verifies before reading/acting.
6. **On first sign-in / each sign-in:** server upserts the `users` profile (`createdAt` on insert, `lastLoginAt` on each).

**Firebase project setup (one-time):** create a new project, enable the **Google** sign-in provider, and add **authorized domains** (`localhost` + the cloudflared tunnel hostname). Client needs the public web config (`apiKey`, `authDomain`, `projectId`); server needs only `FIREBASE_PROJECT_ID`.

**Token verification note:** `firebase-admin` `initializeApp({ projectId })` + `getAuth().verifyIdToken(idToken)` verifies the RS256 signature against Google's public certs and checks `aud === projectId` / `iss` / `exp` **without a service account key**. (Revocation checks via `verifyIdToken(token, true)` would require a service account; not needed for this app.)

---

## 5. Data model (MongoDB, db `cashflow`)

### `users` (one document per uid)
```
{
  _id: <uid>,                      // Firebase uid
  profile: { name, email, photoURL, createdAt, lastLoginAt },
  stats: {
    gamesPlayed: <int>,
    ratRaceWins: <int>,            // escaped the Rat Race
    fastTrackWins: <int>,          // won on the Fast Track
    losses: <int>,
    bestPassiveIncome: <int>,      // max passive income reached, any game
    fastestRatRaceTurns: <int|null>// fewest turns to escape Rat Race
    // winRate is derived on read (wins / gamesPlayed)
  }
}
```

### `matches` (one document per finished game)
```
{
  _id: <ObjectId>,
  roomCode: <string>,
  startedAt, endedAt,             // timestamps passed in from caller (no Date.now in pure logic)
  winnerUid: <uid|null>,
  players: [
    {
      uid, name,
      escapedRatRace: <bool>,
      finalPassiveIncome: <int>,
      turnsPlayed: <int>,
      result: 'win' | 'loss'
    }, ...
  ]
}
```

**Write path (server-authoritative, once per game-end):** the WS game server detects the engine's terminal/winner state after an action, computes per-player results, then:
- `insertOne` into `matches`;
- for each player, an atomic `updateOne` on `users` with `$inc` (gamesPlayed, wins/losses) and `$max`/`$min`/`$set` (bestPassiveIncome, fastestRatRaceTurns).

Indexes: `matches` on `{ "players.uid": 1, endedAt: -1 }` for the profile's recent-matches query.

**DB provisioning (one-time):** create `cashflow_app` user with `readWrite` on `cashflow`. Connection string in env: prod `mongodb://cashflow_app:***@shared-mongo:27017/cashflow?authSource=cashflow` (internal Docker network); the remote test DB `203.113.14.27` kept commented for dev.

---

## 6. Server (custom Next server + WS game server)

- **`server.ts`:** create the Next request handler (`next({ dev })`), an `http` server delegating non-`/ws` requests to Next, and a `ws.Server` (or `noServer` + `upgrade` handler) bound to `/ws`.
- **WS protocol:** preserve the existing message shape — client sends `{ reqId, event, payload }`; server replies `{ reqId, ok, error?, roomId? }` and broadcasts `{ event:'state', state }`. Port the event handling (`join` intents create/join/resume, roll, end-turn, card actions, stock selling, bankruptcy, leave) from `worker/src/GameRoom.ts` — it is the most current authoritative glue.
- **`RoomManager`:** in-memory `Map<code, Game>` (adapted from `server/src/rooms.ts`). Active games are not persisted across restarts (acceptable for a self-hosted single instance; a *client* refresh still resumes because the room lives in the server).
- **Engine:** ported `engine/*` used directly. Pure logic stays time-free; timestamps for matches are supplied by the server boundary.
- **Game-end hook:** after each state transition, if the game became terminal and has not yet been recorded, run the Mongo writer exactly once (guard with a per-room `recorded` flag).

---

## 7. Client (Next.js, App Router)

- **Auth:** `lib/firebase.client.ts` + an `AuthProvider` (React context) exposing `user`, `idToken`, `signIn`, `signOut`. A client guard blocks game routes until signed in.
- **3D board:** reuse the existing R3F component tree, loaded via `dynamic(() => import('...'), { ssr: false })` (canvas is client-only). zustand store and react-i18next reused in client components.
- **Routes:** `/` (login gate + create/join), `/game/[code]` (board + HUD), `/profile` (stats + match history).
- **WS client:** ported `socket.ts` — same `reqId`/`ack` API; `playerId = uid`; attaches the ID token on connect; points at same-origin `/ws`.
- **Profile screen:** calls `GET /api/me` and `GET /api/matches` (Bearer token) → renders aggregate stats (with derived win rate) + recent matches.
- **Visual refresh (light):** new login + profile screens designed clean to match; home / HUD / modals tidied for cohesion. Same brand colors/typography. No change to 3D gameplay visuals.

---

## 8. Deployment (Docker + cloudflared)

- **Dockerfile (multi-stage):** stage 1 installs deps + `next build`; stage 2 runs the custom server (`node server.js`) serving SSR/CSR, `/api`, static assets, and `/ws` on one port (e.g. 8080).
- **docker-compose.yml:** two services —
  - `cashflow-app`: the image above; env `MONGO_URL`, `FIREBASE_PROJECT_ID`, `PORT`, `NEXT_PUBLIC_FIREBASE_*` (public web config), `CLIENT_ORIGIN`; joined to **external network `shared-db`** to reach `shared-mongo:27017`.
  - `cloudflared`: `cloudflare/cloudflared:latest` with the user's tunnel token (matches existing `files-thing-tunnel` / `codepush-broker-tunnel` pattern), routing the public hostname → `cashflow-app:8080`.
- **Networks:** `shared-db` declared `external: true`; app + cloudflared share an internal network for the tunnel→app hop.
- WebSocket works through cloudflared (HTTP/1.1 Upgrade is supported by the tunnel).

---

## 9. Security

- **All writes server-side.** Clients never touch Mongo; there is no client DB credential.
- **Every protected action verifies the Firebase ID token** (WS handshake + HTTP `Authorization`). No verified token → rejected.
- **Stats are authoritative** — derived from the server's game engine, not client-reported, preventing tampering.
- **Secrets** (`MONGO_URL` with `cashflow_app` password, cloudflared tunnel token) live in env / compose secrets, never in the client bundle. Only `NEXT_PUBLIC_FIREBASE_*` (public by design) ship to the browser.
- **Firebase authorized domains** restrict where Google sign-in can complete.

---

## 10. Open items to resolve during planning

1. **New app location:** decided — new top-level dir **`app-next/`** on the branch; the old `cashflow-modern/` stack is removed at cutover (final timing confirmed in the plan).
2. **Engine port mechanics:** copy `engine/*` + `data/*.json` verbatim first (green tests), then adapt imports — keep the Vitest engine tests as the safety net during the move.
3. **Service-account-free admin init** confirmed against the current `firebase-admin` version during implementation (consult current Firebase docs).
4. **Next.js custom-server + WS specifics** validated against current Next.js docs in the planning phase (App Router custom server caveats, production `next start` vs custom `node server.js`).

## 11. Success criteria

- A signed-out visitor sees only the Google login gate; no game route is reachable.
- After Google sign-in, a user can create/join a room and play the full Rat Race + Fast Track game with the existing 3D board, with no rules regressions (engine tests green).
- Finishing a game writes exactly one `matches` document and correctly updates every participant's `users.stats`.
- The profile screen shows accurate aggregate stats + recent matches for the signed-in user only.
- `docker compose up` brings the app online behind the cloudflared tunnel, connected to `shared-mongo`, with WebSocket gameplay working end-to-end.
