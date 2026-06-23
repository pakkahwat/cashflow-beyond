# Cashflow Beyond v2 — Phase 2b: UI Port (client → Next, playable game) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the game fully playable in the browser on the Next.js app — by porting the existing self-contained React client (3D board, screens, i18n, zustand store) into `app-next/`, wiring it to the Phase-2a WebSocket backbone, and proving two browsers can create/join/start/roll an end-to-end game.

**Architecture:** The existing client (`cashflow-modern/client/src`) is a self-contained React SPA that talks to the server only over WebSocket and defines its own types (it does NOT import the engine). It is copied verbatim into `app-next/client/` to preserve all internal relative imports, then mounted by one Next route via `dynamic(() => import('@/client/App'), { ssr: false })` — which defers all browser/localStorage/WebGL code to the client and sidesteps SSR entirely. Only two source edits are needed (the Vite env var and an i18n SSR guard); the dependency set is upgraded to React-19-compatible versions (React Three Fiber v9 stack).

**Tech Stack:** Next.js 16 (App Router) + React 19, React Three Fiber v9 + drei + postprocessing + three, zustand, i18next/react-i18next, Tailwind v4, Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-06-23-nextjs-firebase-auth-mongo-selfhost-design.md`
**Prior:** Phase 1 (foundation) + Phase 2a (realtime backbone) complete; HEAD `2509076`; 38 tests green; `server.ts` (prod, :8080) + `ws-dev.ts` (dev, :3001) exist.

## Global Constraints

- **Branch:** `feat/nextjs-rewrite`. Never touch `main`. Work from repo root `/Users/palm/Desktop/projects/cashflow-beyond`.
- **All new code under `app-next/`.** Next 16. Do NOT modify `app-next/engine/*`, `app-next/data/*`, or the Phase-2a `app-next/lib/ws/*` / `server.ts` / `ws-dev.ts` (unless a task explicitly says so).
- **Client is copied verbatim** from `cashflow-modern/client/src` into `app-next/client/` — preserve its internal relative imports. The ONLY edits: (1) the Vite env var in `client/lib/socket.ts`; (2) an SSR guard in `client/i18n/index.ts`. Do NOT copy `client/src/main.tsx` or `client/src/styles/tailwind.css` (Tailwind v3 directives — superseded by the scaffold's v4 `globals.css`).
- **No auth / no Mongo in this phase.** `playerId` stays the localStorage UUID from the client's `socket.ts` (Phase 3 swaps it for the Firebase uid). The login gate is Phase 3.
- **WS base URL:** client reads `process.env.NEXT_PUBLIC_WS_URL` (empty → same-origin). Dev = `next dev` (:3000) + `ws-dev` (:3001), so dev needs `NEXT_PUBLIC_WS_URL=ws://localhost:3001`. The prod custom server serves Next + ws on one origin (:8080) → same-origin, no env needed.
- **3D board stays** (the user requires it). The dependency upgrade to R3F v9 must keep the board rendering; a light UI refresh is deferred (Phase 5 polish) — this phase is about parity + playable.

---

## File Structure (Phase 2b)

- `app-next/client/**` — **copied verbatim** from `cashflow-modern/client/src/**` (components, lib, store, i18n, styles, App.tsx), minus `main.tsx` and `styles/tailwind.css`.
- `app-next/client/lib/socket.ts` — **edited**: env var.
- `app-next/client/i18n/index.ts` — **edited**: SSR guard.
- `app-next/app/page.tsx` — **replaced**: `'use client'` + dynamic import of `@/client/App` with `ssr:false`.
- `app-next/app/layout.tsx` — **edited**: title + global CSS already imports `globals.css`.
- `app-next/app/globals.css` — **edited**: keep `@import "tailwindcss";` then append the ported `client/styles/index.css` + `client/styles/board3d.css` (or `@import` them).
- `app-next/.env.development` / `.env.local.example` — **new**: `NEXT_PUBLIC_WS_URL=ws://localhost:3001` for dev.
- `app-next/package.json` — **modified**: React-19 client deps.
- `app-next/e2e/play.spec.ts` + `app-next/playwright.config.ts` — **new** (Task 2): two-client e2e.

---

### Task 1: Port the client into Next and get it building + serving

**Files:** copy `cashflow-modern/client/src/**` → `app-next/client/**`; edit `app-next/client/lib/socket.ts`, `app-next/client/i18n/index.ts`, `app-next/app/page.tsx`, `app-next/app/layout.tsx`, `app-next/app/globals.css`; add `app-next/.env.development`; modify `app-next/package.json`.

**Interfaces:**
- Consumes: the Phase-2a HTTP routes (`/api/board`, `/api/room`) and the ws server (`/ws?room=CODE`).
- Produces: a Next route that renders the game's Home screen; `next build` green; `next dev` + `ws-dev` serve a working Home → create/join flow.

- [ ] **Step 1: Copy the client tree (verbatim), minus Vite-only files**

```bash
cd /Users/palm/Desktop/projects/cashflow-beyond
cp -R cashflow-modern/client/src app-next/client
rm -f app-next/client/main.tsx app-next/client/styles/tailwind.css app-next/client/vite-env.d.ts
```
Expected: `app-next/client/` contains `App.tsx`, `components/`, `lib/`, `store/`, `i18n/`, `styles/` with their original internal relative imports intact.

- [ ] **Step 2: Edit the WS env var in `client/lib/socket.ts`**

Find the line `const httpBase = import.meta.env.VITE_SERVER_URL || '';` and replace with:
```typescript
const httpBase = process.env.NEXT_PUBLIC_WS_URL || '';
```
(The variable is named `httpBase` but is used to derive the ws base; pointing it at `NEXT_PUBLIC_WS_URL` keeps both the `/ws` connection and the `fetch('/api/...')` calls correct — note: `fetch` uses `httpBase` too. Since `/api/board` and `/api/room` are same-origin Next routes, set `NEXT_PUBLIC_WS_URL` to a ws:// URL only affects the ws path; the fetch base becoming a ws URL would break fetch. Therefore: read the file and split the concern — keep `fetch` calls same-origin (use `''` base for fetch) and use `NEXT_PUBLIC_WS_URL` only for the WebSocket base. Implement: `const apiBase = '';` for fetch, `const wsBase = (process.env.NEXT_PUBLIC_WS_URL || (typeof location !== 'undefined' ? location.origin : '')).replace(/^http/, 'ws');`.) Read the current `socket.ts` and apply this split precisely — the existing code already computes `wsBase` from `httpBase`; redefine `wsBase` from `NEXT_PUBLIC_WS_URL` and leave `/api` fetches on the same origin.

- [ ] **Step 3: SSR-guard `client/i18n/index.ts`**

The module runs `document.documentElement.lang = saved;` at import time. Although it is only imported under an `ssr:false` boundary, guard it for safety: wrap the trailing `document.documentElement.lang = saved;` in `if (typeof document !== 'undefined') { ... }`. The existing `localStorage` reads are already guarded with `typeof localStorage !== 'undefined'` — leave them.

- [ ] **Step 4: Install React-19-compatible client dependencies**

```bash
cd app-next && npm install \
  three @react-three/fiber@^9 @react-three/drei@^10 @react-three/postprocessing@^3 \
  zustand i18next react-i18next lucide-react
npm install -D @types/three
```
Expected: install resolves React-19-compatible versions. If a peer-dependency conflict appears, resolve to the versions that satisfy React 19 (R3F v9 requires React 19, which we have). Record the resolved versions in your report. Do NOT use `--force`/`--legacy-peer-deps` unless a genuine, documented peer quirk requires it (note it if so).

- [ ] **Step 5: Wire the Next entry — `app/page.tsx`**

Replace `app-next/app/page.tsx` with:
```tsx
'use client';
import dynamic from 'next/dynamic';

// The whole game is client-only (WebGL, localStorage, WebSocket) — disable SSR.
const App = dynamic(() => import('@/client/App'), { ssr: false });

export default function Page() {
  return <App />;
}
```

- [ ] **Step 6: Global styles + layout**

Read `app-next/client/styles/index.css` and `app-next/client/styles/board3d.css`. In `app-next/app/globals.css`, keep the existing `@import "tailwindcss";` (and any scaffold lines), then append the full contents of `index.css` and `board3d.css` (or `@import "../client/styles/index.css";` etc. — prefer inlining the contents to avoid path/Turbopack CSS-import quirks). In `app-next/app/layout.tsx`, set `metadata.title = 'Cashflow Beyond'` and keep `import './globals.css'`. Ensure `<html lang="th">`.

- [ ] **Step 7: Dev env file**

Create `app-next/.env.development`:
```
# next dev runs the UI; the realtime ws server runs separately (npm run dev:ws on :3001)
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

- [ ] **Step 8: Build green**

Run: `cd app-next && npm run build`
Expected: build succeeds. Fix any R3F v8→v9 / drei API breakages, type errors, or `'use client'` boundary errors that surface (the board components may need `'use client'` at the top if Turbopack treats them as server components — add `'use client'` to `client/App.tsx` and any component file the build flags). Do NOT modify `engine/`/`data/`/`lib/ws/`. If the R3F migration requires non-trivial code changes, make the minimal change to restore the original behavior and note each one in your report.

- [ ] **Step 9: Smoke the dev servers**

Run (two servers): start `npm run dev:ws` (WS_PORT 3001) and `npm run dev` (Next :3000) in the background, then:
```bash
curl -sS -o /dev/null -w "home=%{http_code}\n" http://localhost:3000/
curl -sS -o /dev/null -w "board=%{http_code}\n" http://localhost:3000/api/board
```
Expected: `home=200`, `board=200`. Stop both servers afterward. (Full interactive play is verified in Task 2.)

- [ ] **Step 10: Confirm existing tests still green**

Run: `cd app-next && npm run test`
Expected: the 38 prior tests still pass (plus any client unit tests that came along under `client/**/*.test.ts` — if `vitest.config.ts` does not pick them up, that is fine; if it does and they need a DOM env, either add `environment` per-file or exclude `client/**` from the node-env include — note which you did). Output pristine apart from the known CJS line.

- [ ] **Step 11: Commit**

```bash
cd /Users/palm/Desktop/projects/cashflow-beyond
git add app-next
git commit -m "feat: port React client into Next (app-next/client) — playable build green"
```

---

### Task 2: End-to-end playable verification (two-client Playwright e2e)

**Files:** Create `app-next/playwright.config.ts`, `app-next/e2e/play.spec.ts`; modify `app-next/package.json` (add `@playwright/test`, `test:e2e` script).

**Interfaces:**
- Consumes: the built app served by `npm run start:prod` (Next + ws on one origin, :8080 — same-origin ws, no env needed).
- Produces: a passing two-client e2e proving create → join → start → roll works end-to-end with state sync.

- [ ] **Step 1: Install Playwright**

```bash
cd app-next && npm install -D @playwright/test && npx playwright install chromium
```

- [ ] **Step 2: Playwright config (boots the prod server)**

Create `app-next/playwright.config.ts`:
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:8080' },
  webServer: {
    command: 'npm run build && PORT=8080 npm run start:prod',
    url: 'http://localhost:8080',
    timeout: 180_000,
    reuseExistingServer: false,
  },
});
```

- [ ] **Step 3: Write the two-client e2e**

Create `app-next/e2e/play.spec.ts`. It opens two browser contexts (host + guest), the host creates a room and reads the room code from the Lobby, the guest joins with that code, the host starts the game, and the host rolls the dice; assert the game board/turn UI appears for both. Derive selectors from the actual rendered UI (inspect the running app): the Home screen has a name input and a "create room" button (i18n keys `home.namePlaceholder`, `home.createRoom`, `home.roomCodePlaceholder`, `home.join`); the Lobby shows the room code and a start control; the Game screen shows the board and a roll/dice control. Use role/text/placeholder selectors. Example skeleton (fill selectors against the real DOM):
```typescript
import { test, expect, chromium } from '@playwright/test';

test('two players can create, join, start and roll', async () => {
  const browser = await chromium.launch();
  const host = await browser.newContext();
  const guest = await browser.newContext();
  const h = await host.newPage();
  const g = await guest.newPage();

  await h.goto('/');
  await h.getByPlaceholder(/name/i).fill('Alice');         // adjust to real placeholder
  await h.getByRole('button', { name: /create/i }).click(); // adjust to real label
  // read the room code shown in the lobby:
  const code = (await h.locator('[data-room-code], .room-code, text=/^[A-Z2-9]{5}$/').first().innerText()).trim();
  expect(code).toMatch(/^[A-Z2-9]{5}$/);

  await g.goto('/');
  await g.getByPlaceholder(/name/i).fill('Bob');
  await g.getByPlaceholder(/code/i).fill(code);
  await g.getByRole('button', { name: /join/i }).click();

  // host starts, then rolls
  await h.getByRole('button', { name: /start/i }).click();
  await h.getByRole('button', { name: /roll/i }).click();

  // both see the in-game board / a turn indicator
  await expect(h.locator('canvas, .board, [data-board]').first()).toBeVisible();
  await expect(g.locator('canvas, .board, [data-board]').first()).toBeVisible();

  await browser.close();
});
```
If exact labels differ, inspect the running UI and the i18n `th.json`/`en.json` to use the correct text, and prefer stable selectors. Add `data-*` test hooks to the client components ONLY if no stable selector exists (note any such additions).

- [ ] **Step 4: Add the script and run the e2e**

Add to `app-next/package.json` scripts: `"test:e2e": "playwright test"`. Run:
```bash
cd app-next && npm run test:e2e
```
Expected: the test passes. Fix any runtime issues it exposes (e.g. ws base URL in same-origin prod, a board component that crashes on mount, a missing `'use client'`). Re-run until green. If the game cannot reach the rolling state because the engine needs ≥2 players and a profession/dream selection step, drive those steps too (consult `Lobby.tsx`/`Game.tsx` for the flow) — the test must reach an actual in-game state.

- [ ] **Step 5: Commit**

```bash
cd /Users/palm/Desktop/projects/cashflow-beyond
git add app-next/e2e app-next/playwright.config.ts app-next/package.json app-next/package-lock.json
git commit -m "test: two-client Playwright e2e — create/join/start/roll playable end-to-end"
```

---

## Self-Review

**1. Spec coverage (Phase 2b):** Porting the 3D board + screens + i18n + zustand + WS client transport (spec §7) and proving playability are implemented by Tasks 1–2. The mandatory Google-login gate (§4) is Phase 3; profile/stats (§5) Phase 4; Docker (§8) Phase 5 — out of this plan, not gaps. The "light UI refresh" (§7) is intentionally deferred to the Phase-5 polish pass; this phase targets parity + playable.

**2. Placeholder scan:** No "TBD/handle later". The Playwright selectors are explicitly "derive from the real DOM" because they depend on rendered output the plan cannot freeze — paired with the i18n keys and a concrete skeleton, this is a grounded instruction, not a placeholder. The R3F-migration fixes in Task 1 Step 8 are "make the minimal change + report each" — bounded.

**3. Type/interface consistency:** The client is copied verbatim, so its internal interfaces are unchanged. The only edits (socket env var, i18n guard) do not change exported signatures. `NEXT_PUBLIC_WS_URL` is used in `client/lib/socket.ts` (Step 2) and set in `.env.development` (Step 7) and documented for prod (same-origin). The dynamic import path `@/client/App` matches the copy target `app-next/client/App.tsx`.

## Phase 2b → Phase 3 handoff

After 2b is playable: **Phase 3 — Firebase Google auth gate**: add the Firebase Web SDK + an auth provider + a login gate in front of the app; verify the Firebase ID token in the ws `upgrade`/`join` path and on protected HTTP routes via `firebase-admin` (projectId only); switch `playerId` from the localStorage UUID to the Firebase `uid`; surface the Google display name/photo. Requires the user's Firebase web config (public) + project ID — captured in `.env.example` for the final "fill in and play" deliverable.
