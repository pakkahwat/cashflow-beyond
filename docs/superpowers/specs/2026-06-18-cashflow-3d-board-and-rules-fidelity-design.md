# Cashflow — 3D Board + Rules Fidelity — Design Spec

**Date:** 2026-06-18
**Status:** Approved design, pre-implementation
**Scope target:** `cashflow-modern/` (the active stack; the repo-root legacy `cashflow-holmes` app is out of scope and untouched)

> **TL;DR (ไทย):** ทำ 2 อย่างพร้อมกันบนกระดานทำงานจริง (`cashflow-modern`): (1) **อัดกติกาให้ตรง Cashflow 101 ฉบับทางการ** — แก้ bug 7 ข้อ + จุดเพี้ยนชุด "ปลอดภัย" โดยมีเทสต์ Vitest เป็นตัวพิสูจน์ (test-first) และ (2) **รื้อกระดานเป็น 3D จริง** ด้วย React Three Fiber + post-FX โดยงบการเงิน/การ์ด/lobby ยังเป็น DOM overlay เดิม งานที่ต้องรื้อระบบ multiplayer ถูกเลื่อนเป็น Phase 3.

---

## 1. Context & Problem

The active game is `cashflow-modern/`: a TypeScript engine (`server/src/engine`) shared by a Cloudflare Worker + Durable Object backend (`worker/src/GameRoom.ts`, the live backend) and a React + Vite client. The board today is **not real 3D** — `Dice3D.tsx` is a CSS `transform` cube and `RatRaceBoard.tsx`/`FastTrackBoard.tsx` are DOM `<div>`s positioned with trigonometry / CSS grid.

Two goals, both confirmed with the user:

1. **Rules must be solid ("กติกาต้องแน่น")** — audited against the official Cashflow 101 rulebook (Rich Dad "CASHFLOW – Rules of the Game" PDF, cross-checked with US Patent 5,826,878). The audit found **7 confirmed code bugs** and **~22 rule divergences**. The engine currently has **zero automated tests**.
2. **Make it look better with Three.js** — user chose a **full 3D tabletop board** rendered as a real 3D scene, with the financial statement / cards / lobby kept as a DOM HUD overlay.

### Locked decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Visual scope | **Full 3D board** (Three.js scene); panels/cards/lobby stay DOM HUD |
| 3D approach | **Procedural + post-FX** — geometry built in code (R3F + drei), no art assets; bloom / soft shadows / SSAO; perf fallback |
| Rules fidelity source of truth | **Official Cashflow 101** (rulebook + patent) |
| Rules scope | **"Safe" set** — all 7 bugs + non-multiplayer-restructuring divergences; defer the 3 structural multiplayer items to Phase 3 |
| Fast Track Charity edition | **Rulebook** — roll 1/2/3 dice for the rest of the game, no cost |

---

## 2. Goals / Non-Goals

**Goals**
- A Vitest suite that encodes the official rules and proves correctness (not just claims).
- Engine behavior matched to official Cashflow 101 within the "safe" scope.
- A genuine 3D board (Rat Race ring + Fast Track), 3D tokens that animate along the track, 3D dice, lighting + post-processing, with a non-WebGL/perf fallback.
- No regression to save & resume, lobby, reconnect-by-playerId, or i18n.

**Non-Goals (this spec)**
- Phase 3 structural multiplayer fidelity (exit-as-choice, Market-affects-all-owners, dream cost escalation + dream-at-setup). Documented as known simplifications.
- Deleting the dead Node Socket.IO server or the legacy root app (no deletion without explicit user order).
- Adding authentication.
- Designed glTF art assets (procedural only; structure kept model-ready).

---

## 3. Architecture Overview

```
React client (Vite SPA, Zustand)
  ├─ <Board3D> (NEW: react-three-fiber <Canvas>)   ← 3D scene
  │     RatRaceRing3D · FastTrackRing3D · Token3D · Dice3DGL · Lighting · Effects
  └─ DOM HUD overlay (UNCHANGED): StatementPanel, CardModal, LoanPanel,
        Lobby, Home, WinnerOverlay, Toast, LangToggle
        │  native WebSocket + fetch /api/*
        ▼
Cloudflare Worker (worker/src/index.ts) ── serves client/dist as ASSETS
        ▼
GameRoom Durable Object (worker/src/GameRoom.ts)  — 1 DO per room, SQLite save
        │  imports
        ▼
Shared TS engine (server/src/engine/{Game,Player,board,decks}.ts + data/*)  ← rules live here
        ▲
        └─ NEW: Vitest suite (server/src/engine/*.test.ts)
```

The engine stays transport-agnostic and server-authoritative. All rule fixes are in the engine; the Worker only gains thin mappings for any new action. The 3D work is **client-only** and consumes the existing `PublicGameState` — **no wire-protocol change** for rendering.

---

## 4. Phase 0 — Test Harness (do before touching logic)

**Why first:** "กติกาต้องแน่น" requires proof. We add tests, write the target rules as failing tests, then make them pass in Phase 1.

- Add **Vitest** to the `server` package (`cashflow-modern/server`), which holds the engine and already has a `tsconfig.json`.
  - `server/package.json`: add devDeps `vitest`, script `"test": "vitest run"`, `"test:watch": "vitest"`.
  - Root `cashflow-modern/package.json`: add `"test": "npm --prefix server run test"` and include it in a combined check.
- Tests under `server/src/engine/` (e.g. `Player.test.ts`, `Game.test.ts`, `board.test.ts`, `fastTrack.test.ts`).
- **Coverage targets (characterize + assert official rules):**
  - Financial getters: `passiveIncome`, `totalIncome`, `totalExpenses`, `cashFlow`.
  - Payday paid on **pass-or-land** for every crossed payday tile (`Game.ts:215-221`).
  - Dice: 1 die Rat Race / 2 dice Fast Track.
  - Deal small/big draw + buy/skip; market auto-resolve; doodad mandatory.
  - Charity (Rat Race **and** Fast Track), Downsized, Baby cap 3.
  - Loans: $1,000 multiples, payment = loan/10; payoff zeroes linked expense.
  - **Rat Race exit: strict `>`** (`Player.ts:111`), Fast Track entry bonus **×100** (`Player.ts:354`).
  - Win: `+$50,000` cash-flow gain **or** buy Dream (`Game.ts:559-562`).
  - Liquidation / bankruptcy path.
  - FT losses (Tax Audit / Lawsuit / Divorce).
- **Failing-first tests** authored for every Phase-1 fix (bugs + divergences), so Phase 1 = turn red → green.

**Exit criteria:** Vitest runs; the "current behavior" tests pass; the "official rule" tests for Phase-1 items are present and red.

---

## 5. Phase 1 — Rules Fidelity & Bug Fixes (make tests green)

References are `file:line` from the 2026-06-18 audit (verified by direct read).

### 5.1 Confirmed code bugs

| ID | Fix | Where |
|---|---|---|
| C1 | **Rat Race Charity dead-end.** Add a `donate` action to `cardAction()` that calls `Player.charity()`, clears `pendingCard`, sets `resolved=true`; `skip` stays as decline. | `Game.ts` `cardAction()` switch (~310-399); mirror FT caller `Game.ts:493-497` |
| C2 | **`ownedInvestments` never written.** On FT investment buy, record the tile id and reject re-buying an owned investment. | `Player.buyFastTrackInvestment()` `Player.ts:369-374`; guard in `Game.fastTrackAction` buy `Game.ts:533-541` |
| C3 | **Market `'insufficient'` unhandled.** Handle the `'insufficient'` return: keep card pending and route through rescue/`takeLoan` (cash may go negative) instead of silently clearing. | `Player.payDamages()` `Player.ts:288`; `autoResolveMarket()` `Game.ts:277-283` |
| C4 | **8s optimistic timeout reports success.** Resolve `{ ok:false, error:'timeout' }` (not `ok:true`) and surface a retry/error toast. | `client/src/lib/socket.ts:88-93` |
| C5 | **No WebSocket auto-reconnect.** Reconnect-with-backoff in `onclose`, then re-join with stored room/name (`remember`). | `client/src/lib/socket.ts:75-77, 96` |
| C6 | **Mortgages not recorded as liabilities.** On `buyRealEstate`/`buyBusiness`, push the mortgage into `liabilities.realEstates`. | `Player.buyRealEstate()` `Player.ts:165-182` |
| C7 | **Duplicate card IDs.** Re-id `marketLottery03` (`cards.json:1417 & 1453`) and `marketPlexBuyer16` (`:1689 & 1702`) to unique values. | `server/src/data/cards.json` |

### 5.2 Rule divergences — "safe" set

| ID | Sev | Official → Fix | Where |
|---|---|---|---|
| H1 | High | Start cash = **Monthly Cash Flow + Savings** once, then erase savings. Set `fresh.cash = fresh.cashFlow + fresh.assets.savings; fresh.assets.savings = 0;` | `Game.start()` `Game.ts:110-125`; `Player.ts:76` |
| H2 | High | **Bankruptcy debt-relief step**: after liquidating assets, if still `cash<0`, halve car loans, credit cards, retail debt (+ their payments); keep mortgage + school loan; declare bankrupt only if still `<0`. | `Player.liquidateEverything()` `Player.ts:324-338` |
| M1 | Med | **FT loss amounts**: Divorce = ALL cash (`pay=this.cash`); Lawsuit = ½ cash (currently fixed `$50,000`). Add a `full` flag alongside `half`. | `fastTrack.ts` idx 20 & 31; `Player.payFastTrackLoss()` `Player.ts:376-380` |
| M3 | Med | **FT Charity (rulebook edition)**: set a permanent flag granting the choice of 1/2/3 dice each Fast Track turn for the rest of the game; **no** 10% cost, no 3-turn cap. (Distinct from Rat Race charity, which keeps 10%→2 dice / 3 turns.) | `Game.ts:493-497`; new permanent flag on `Player`; `rollDice` dice-count validation |
| M7 | Med | **Non-bank debts paid in full**: reject partial payment for non-bank liabilities (`amount === balance`). Bank loan keeps $1,000-unit partials (see L5). | `Player.payLoan()` `Player.ts:303-315` |
| M8 | Med | **No bank loans on Fast Track**: reject `takeLoan` when `p.phase==='fastTrack'`. | `Game.takeLoan()` `Game.ts:430-436` |
| M9 | Med | **Downsized cancels Charity**: reset the Rat Race charity dice effect (`extraDiceTurns=0`). | `Player.downsized()` `Player.ts:145-150` |
| L1 | Low | Swap Baby↔Downsized tile positions (Baby→12, Downsized→20). *Note: canonical order is medium-confidence; gameplay-neutral.* | `board.ts:16-17` + client `boardLayout.ts` mirror |
| L2 | Low | Minimum **2 players** to start. | `Game.start()` `Game.ts:113` |
| L5 | Low | Bank-loan repayment in **$1,000 units** (`amount % 1000 === 0`). | `Player.payLoan()` `Player.ts:306` |
| L6 | Low | **Bankrupt players cannot borrow.** | `Game.takeLoan()` |
| L10 | Low | **Randomize first player** instead of `currentIndex=0`. | `Game.start()` `Game.ts:121` |

**Low items intentionally NOT in this phase** (no gameplay-correctness impact at present): **L3** (add Retail Payment/Debt + Business Liability statement lines — only matters if a card touches retail, none currently do), **L7** (charge FT investment Down Payment instead of full cost — internally consistent simplification), **L9** (align Doctor/Truck Driver card dollar values to the two published rulebook examples — optional, see §8). **L4** (mortgage as liability) is folded into **C6**.

### 5.3 Investigate-then-decide

- **M2 (interest/dividends in passive income):** First grep `cards.json` for any card granting recurring interest/dividends. If none exist, the omission has no gameplay effect — document as accepted and skip. If any exist, add `interest`/`dividends` income lines and include them in `passiveIncome` (`Player.ts:81-85`).

### 5.4 New/changed engine surface (for the client & Worker)

- `cardAction` gains action value **`donate`** (C1) — Worker `GameRoom.onMessage` already forwards `cardAction.action`; no new top-level event.
- `rollDice` accepts `diceCount ∈ {1,2,3}` when the player holds the Fast Track charity flag (M3); validate server-side.
- New serialized `Player` fields (e.g. `ftCharityActive: boolean`) must be added to `toState()/fromState()` and `toPublic()` so save/resume and the dice UI keep working.

---

## 6. Phase 2 — 3D Board (React Three Fiber)

Client-only. Consumes existing `PublicGameState`.

### 6.1 Dependencies (add to `client/package.json`)
`three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`. (Dev: `@types/three`.)

### 6.2 New files (under `client/src/components/three/`)
- `Board3D.tsx` — `<Canvas>`, camera, controls, lighting, effects, picks Rat Race vs Fast Track ring(s); the single entry the rest of the app mounts.
- `RatRaceRing3D.tsx` — 24 tiles arranged on a ring (reuse `ratTileType` + the trig from `RatRaceBoard.tsx`, lifted into `boardLayout3d.ts`).
- `FastTrackRing3D.tsx` — 32 tiles as an outer ring / second board.
- `Tile3D.tsx` — extruded rounded box, color by type, label via drei `<Text>` (or `<Html>` for emoji/i18n), highlight when active.
- `Token3D.tsx` — per-player 3D piece (color = `player.color`); animates position along the track via lerp in `useFrame` with a hop on move.
- `Dice3DGL.tsx` — 3D dice that tumble then settle on the rolled face from `diceValues`; replaces the CSS `Dice3D`.
- `Lighting.tsx` — key/fill/ambient + soft shadows + drei `<Environment>`.
- `Effects.tsx` — `<EffectComposer>`: Bloom (active tile glow), SSAO (depth), tone mapping.
- `boardLayout3d.ts` — derive 3D coordinates from the existing tile data.

### 6.3 Integration
- `Game.tsx` composes `<Board3D/>` as the background layer and renders the existing DOM HUD (StatementPanel, CardModal, LoanPanel, lobby/home, WinnerOverlay, Toast) absolutely positioned on top. **HUD components are reused unchanged** beyond layout/z-index.
- i18n: tile labels keep using `tileLabel`/i18n; 3D text via drei `<Text>` or `<Html>`. Thai stays default.

### 6.4 Performance & fallback (required)
- **Quality toggle** (Zustand): `high` (post-FX + shadows) / `low` (off). Persist in `localStorage`.
- Respect `prefers-reduced-motion` (reduce token/dice animation).
- **WebGL-unavailable fallback:** if no WebGL context, render the existing CSS `RatRaceBoard`/`FastTrackBoard` (kept in the tree as the fallback path — not deleted).
- Mobile: lighter camera + reduced effects.

**Exit criteria:** `npm run dev` shows the 3D board; dice roll animates to the server value; tokens move along the track; HUD works; toggling quality and the CSS fallback both work.

---

## 7. Phase 3 — Deferred (documented known simplifications)
- **M5** Rat Race exit becomes a player choice offered at start of turn (not auto-forced mid-turn).
- **M6** Market events/sales affect **every** owner of the named asset (multiplayer broadcast + per-player prompts).
- **M4 + L8** Dream chosen at setup; landing on another player's Dream escalates its cost by 100% per marker.

Each requires new events/UI and multiplayer restructuring; marked in code with `// KNOWN SIMPLIFICATION (Phase 3): ...`.

---

## 8. Open-Question Defaults (overridable)
- **Voluntary asset-sale recovery 50%** — keep as a documented house rule (rulebook gives no rate).
- **Profession card dollar values** — keep current values (only Doctor/Truck Driver are published). Aligning those two to the rulebook examples (Doctor savings $400, Truck Driver $1,000) is optional/low.
- **Rat Race tile sequence / Pay-Check count (3 vs 4)** — keep 24 / 12-deal / 3-payday standard (no official diagram).
- **Forced-liquidation 3-turn penalty (M10)** — not implemented; medium-confidence, revisit if a physical rulebook confirms.
- **Interest/dividends in passive income (M2)** — INVESTIGATED 2026-06-18: a scan of `cards.json` found no card that grants recurring interest or dividends (the word "interest" appears only in stock-card flavor text about interest *rates* affecting share price, i.e. capital-gain plays). Conclusion: omitting interest/dividend income lines has **no gameplay effect** in the current 101 deck — accepted as-is, no code change. Revisit only if a future card pays recurring income.

---

## 9. Cleanup
- Remove the dead `socket.io-client` dependency from `client/package.json` (client uses native WebSocket).
- **Do not delete** the Node Socket.IO server (`server/src/index.ts`, `rooms.ts`) or the legacy root app without explicit user instruction. Offer removal as a separate opt-in.

---

## 10. Verification (evidence before claiming done)
- `npm run typecheck` — client + worker (+ server tsc) clean.
- `npm run test` — Vitest green (all Phase-0/1 tests).
- `npm run dev` — **manually open the app**, confirm the 3D board renders, dice animate to the rolled value, tokens move, HUD/card flows work, quality toggle + WebGL fallback work. Capture a screenshot.
- No claim of completion before the screen is actually observed.

---

## 11. Risks
- **3D scope is large** (raycasting/picking if interactive, camera, responsive, perf). Mitigate: HUD stays DOM (most interaction lives there); board is mostly display + animation; ship behind a quality toggle with CSS fallback.
- **Board tile order is medium-confidence** — L1 is gameplay-neutral; flag in code.
- **Save/resume compatibility** — new `Player` fields must be added to (de)serialization and tolerate older saved states (default missing fields).
- **Worker is the live backend** — confirm it imports the patched engine (it imports `server/src/engine/*` via `file:..`), so engine fixes ship to players.
