# Cashflow Beyond v2 — Phase 1: Foundation (Next.js scaffold + engine/data port) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the new Next.js app in `app-next/` and port the audited game engine + card data into it with its full test suite green — the foundation every later phase builds on.

**Architecture:** Fresh Next.js 15 (App Router, TypeScript, Tailwind v4) scaffolded in a new top-level directory `app-next/`. The framework-agnostic game engine (`engine/`) and content (`data/`) are copied verbatim from the existing `cashflow-modern/server/src` so no game rules are re-authored; correctness is proven by porting the existing Vitest suite (30 tests) and keeping it green. Nothing imports the engine from Next code yet — that wiring is Phase 2.

**Tech Stack:** Next.js 15 (App Router) + React 19, TypeScript, Tailwind v4, Vitest (engine tests), npm.

**Spec:** `docs/superpowers/specs/2026-06-23-nextjs-firebase-auth-mongo-selfhost-design.md`

## Global Constraints

Copied verbatim from the spec; every task implicitly inherits these.

- **Branch:** all work on `feat/nextjs-rewrite` (already created), isolated from `main`.
- **App location:** new top-level dir **`app-next/`**; the old `cashflow-modern/` stack stays untouched until cutover (a later phase).
- **Framework:** Next.js (App Router) + **custom Node server** (`server.ts` = `next()` + `ws`) — the custom server itself is Phase 2; Phase 1 only scaffolds.
- **Engine + card data:** **reused, not re-authored** — `engine/*` ported as the rules base; `cards/professions/board` data copied verbatim. (Override available only on explicit user request.)
- **Runtime floor:** Node 20+ (Next 15 requires Node ≥ 18.18; target Node 20 LTS — the machine has nvm 22.12.0 available).
- **React Three Fiber:** the existing board uses R3F v8 (React 18). Next 15 App Router uses **React 19**, so the board port (Phase 2) must use **R3F v9 + drei v9** (React-19 compatible). Not exercised in Phase 1.
- **Engine `.js` specifiers:** engine files import sibling modules with explicit `.js` specifiers on `.ts` files (NodeNext/bundler style) and import `../data/*.json`. Vitest resolves these via an alias that strips trailing `.js` from relative specifiers. Next-side consumption resolution is a Phase 2 concern.

---

## File Structure (Phase 1)

- `app-next/` — new Next.js project root (created by `create-next-app`).
  - `app/`, `public/`, `next.config.ts`, `tsconfig.json`, `package.json`, `postcss.config.mjs`, `.gitignore`, `eslint.config.mjs` — scaffolded.
  - `engine/` — **copied** from `cashflow-modern/server/src/engine/` (Game.ts, Player.ts, decks.ts, board.ts, types.ts, test-helpers.ts + `*.test.ts`).
  - `data/` — **copied** from `cashflow-modern/server/src/data/` (cards.json, professions.json, fastTrack.ts, cards.test.ts). Kept as a **sibling of `engine/`** so the engine's `../data/...` imports resolve unchanged.
  - `vitest.config.ts` — **new**, mirrors the existing engine Vitest config (the `.js`-stripping alias), include paths pointed at `engine/` + `data/`.

---

### Task 1: Scaffold the Next.js app in `app-next/`

**Files:**
- Create: `app-next/` (entire Next.js project via `create-next-app`)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a buildable Next.js 15 App-Router project rooted at `app-next/` with npm scripts `dev`, `build`, `start`, `lint` and import alias `@/*`.

- [ ] **Step 1: Scaffold with create-next-app (non-interactive)**

Run from the repo root (`/Users/palm/Desktop/projects/cashflow-beyond`):
```bash
npx create-next-app@latest app-next \
  --ts --app --tailwind --eslint --use-npm \
  --no-src-dir --no-turbopack --import-alias "@/*"
```
Expected: creates `app-next/` with `app/page.tsx`, `app/layout.tsx`, `next.config.ts`, `tsconfig.json`, Tailwind v4 wired (`postcss.config.mjs` + `app/globals.css`), and dependencies installed. If a `next`/React major newer than 15/19 is installed, that is acceptable; record the versions in the commit message.

- [ ] **Step 2: Verify the production build succeeds**

Run:
```bash
cd app-next && npm run build
```
Expected: build completes with no errors (the default `/` route compiles). This is the Phase-1 smoke test that the scaffold is healthy.

- [ ] **Step 3: Verify the dev server boots, then stop it**

Run:
```bash
cd app-next && (npm run dev & sleep 6 && curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000 ; kill %1)
```
Expected: prints `200` (the default Next welcome page responds), then the dev server is killed.

- [ ] **Step 4: Confirm `.gitignore` excludes build artifacts**

Confirm `app-next/.gitignore` (created by create-next-app) contains `/node_modules`, `/.next`, and `/out`. If `node_modules` is not ignored, add these lines.

- [ ] **Step 5: Commit**

```bash
cd /Users/palm/Desktop/projects/cashflow-beyond
git add app-next
git commit -m "feat: scaffold Next.js 15 app in app-next/ (App Router, TS, Tailwind)"
```

---

### Task 2: Port the game engine + data and get the Vitest suite green

**Files:**
- Create (copied): `app-next/engine/` from `cashflow-modern/server/src/engine/`
- Create (copied): `app-next/data/` from `cashflow-modern/server/src/data/`
- Create: `app-next/vitest.config.ts`
- Modify: `app-next/package.json` (add `vitest` devDependency + `test` script)

**Interfaces:**
- Consumes: the scaffolded `app-next/` from Task 1.
- Produces: `app-next/engine/Game.ts` exporting the `Game` class and `app-next/engine/types.ts` exporting the public types (`Card`, `Profession`, `PublicGameState`, `GamePhaseStatus`, `DeckName`, `Liabilities`, `StockHolding`, …) — the rules surface Phase 2's server consumes. An `npm run test` script that runs the engine suite.

- [ ] **Step 1: Copy the engine and data directories verbatim**

Run from the repo root:
```bash
cp -R cashflow-modern/server/src/engine app-next/engine
cp -R cashflow-modern/server/src/data   app-next/data
```
Expected: `app-next/engine/` contains `Game.ts, Player.ts, decks.ts, board.ts, types.ts, test-helpers.ts, Game.test.ts, Player.test.ts, board.test.ts`; `app-next/data/` contains `cards.json, professions.json, fastTrack.ts, cards.test.ts`. The engine's `../data/...` imports now resolve (data is a sibling of engine).

- [ ] **Step 2: Add the Vitest config (mirrors the existing engine config)**

Create `app-next/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

// The engine uses explicit ".js" import specifiers (NodeNext/bundler style) on
// files that are actually ".ts". Strip the ".js" from relative specifiers so
// Vite resolves them to the ".ts" source during tests.
export default defineConfig({
  resolve: {
    alias: [{ find: /^(\.{1,2}\/.*)\.js$/, replacement: '$1' }]
  },
  test: {
    include: ['engine/**/*.test.ts', 'data/**/*.test.ts'],
    environment: 'node'
  }
});
```

- [ ] **Step 3: Add Vitest and the test script**

Run:
```bash
cd app-next && npm install -D vitest@^1.6.0
```
Then add to `app-next/package.json` `"scripts"` (alongside the existing `dev`/`build`/`start`/`lint`):
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Run the engine suite to verify it fails BEFORE the config is correct is not needed — run to verify it PASSES (this is a port, not new code)**

Run:
```bash
cd app-next && npm run test
```
Expected: **30 tests pass** across `engine/Game.test.ts` (18), `engine/Player.test.ts` (8), `engine/board.test.ts` (3), `data/cards.test.ts` (1). If any test fails to resolve an import, confirm the `vitest.config.ts` alias from Step 2 is present and the `data/` dir is a sibling of `engine/`.

- [ ] **Step 5: Commit**

```bash
cd /Users/palm/Desktop/projects/cashflow-beyond
git add app-next/engine app-next/data app-next/vitest.config.ts app-next/package.json app-next/package-lock.json
git commit -m "feat: port game engine + card data into app-next (30 engine tests green)"
```

---

### Task 3: Confirm engine + Next build coexist (typecheck + build clean)

**Files:**
- Modify: `app-next/tsconfig.json` (exclude engine tests from the Next typecheck; keep engine sources typechecked)

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: a repo where `npm run build` (Next) and `npm run test` (engine) both pass — the green baseline Phase 2 starts from.

- [ ] **Step 1: Exclude test files from the Next/TS program**

In `app-next/tsconfig.json`, ensure the `exclude` array contains `"node_modules"` and add `"**/*.test.ts"` (Next's `tsc` should not compile Vitest test files, which reference the `vitest` globals). Leave `include` as create-next-app generated it (it globs `**/*.ts(x)`), so `engine/` and `data/` non-test sources are typechecked.

```jsonc
// app-next/tsconfig.json — "exclude" key
"exclude": ["node_modules", "**/*.test.ts"]
```

- [ ] **Step 2: Run the Next build to confirm the engine sources typecheck under bundler resolution**

Run:
```bash
cd app-next && npm run build
```
Expected: build succeeds. Next's TS uses `moduleResolution: "bundler"`, which resolves the engine's `.js` specifiers to their `.ts` sources. If the build reports unresolved `./X.js` imports, add `extensionAlias` to `next.config.ts` webpack config:
```typescript
// next.config.ts (only if Step 2 build fails on .js specifiers)
import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js'] };
    return config;
  }
};
export default nextConfig;
```
Re-run `npm run build` and confirm it passes.

- [ ] **Step 3: Re-run the engine suite to confirm nothing regressed**

Run:
```bash
cd app-next && npm run test
```
Expected: 30 tests still pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/palm/Desktop/projects/cashflow-beyond
git add app-next/tsconfig.json app-next/next.config.ts
git commit -m "chore: keep engine sources typechecked while excluding tests from Next build"
```

---

## Self-Review

**1. Spec coverage (Phase 1 portion):** The spec's "reuse engine + card data" decision and the `app-next/` location (§2 locked decisions, §3 layout, §10.1–10.2) are implemented by Tasks 1–3. Auth, WS server, Mongo, profile, Docker, and the UI refresh are explicitly **later phases** (see "Next phases" below) — not gaps in this plan.

**2. Placeholder scan:** No "TBD/TODO/handle edge cases". Task 2 Step 4 wording corrected to reflect that a port runs the existing suite to green (no failing-test-first cycle, because no new behavior is authored). The `next.config.ts` block in Task 3 Step 2 is conditional and fully specified.

**3. Type consistency:** The engine's public type names referenced in the Interfaces blocks (`Card`, `Profession`, `PublicGameState`, `GamePhaseStatus`, `DeckName`, `Liabilities`, `StockHolding`) are copied from the actual `engine/types.ts`. The `Game` class export matches `engine/Game.ts`. Vitest version `^1.6.0` matches the existing engine config to avoid config-format drift.

---

## Next phases (to be written as plans after this one is executed and green)

Each is independently testable and depends on the structure this plan creates, so each is authored against real code rather than guesses:

- **Phase 2 — Custom server + realtime + client gameplay:** `server.ts` (`next()` + `ws`), port `GameRoom.ts` message handling + `RoomManager` (in-memory), port the WS client (`socket.ts`), port the 3D board (R3F v9) + screens, i18n. Deliverable: play a full game locally, no auth yet.
- **Phase 3 — Firebase Google auth gate:** Firebase Web SDK sign-in, `AuthProvider`, route guards, `firebase-admin` (projectId-only) token verification on the WS handshake + HTTP endpoints, `playerId = uid`. Deliverable: login required to play.
- **Phase 4 — MongoDB + server-authoritative stats + profile:** `cashflow_app` user on `shared-mongo`, `users`/`matches` collections + indexes, game-end writer, `/api/me` + `/api/matches`, profile screen. Deliverable: stats persist and display.
- **Phase 5 — UI refresh + Docker + cloudflared:** light cohesive UI refresh, multi-stage Dockerfile, docker-compose (`cashflow-app` + `cloudflared`, network `shared-db`), cutover (remove old `cashflow-modern/` stack). Deliverable: deployed behind the tunnel, end-to-end.
