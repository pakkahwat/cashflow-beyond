# Cashflow Rules Fidelity + Test Harness — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `cashflow-modern` game engine faithful to official Cashflow 101 (the "safe" scope) and prove it with an automated test suite — fixing 7 confirmed bugs and the non-multiplayer-restructuring rule divergences.

**Architecture:** All game rules live in the transport-agnostic TypeScript engine at `cashflow-modern/server/src/engine/` (+ `data/`). The Cloudflare Worker (`worker/src/GameRoom.ts`) imports this engine via a `file:..` dependency, so every engine fix ships to players. We add Vitest to the `server` package and work test-first.

**Tech Stack:** TypeScript (ESM, `"type": "module"`, `.js` import specifiers), Vitest, Node 18+.

## Global Constraints

- Engine is **plain TS ESM**: relative imports use explicit `.js` specifiers (e.g. `import { Player } from './Player.js'`) even though the files are `.ts`. New code MUST follow this.
- **Server-authoritative**: all rule logic stays in `server/src/engine`. The Worker and Node server are thin adapters.
- **No breaking wire-protocol change.** Only additive changes are allowed: a new `cardAction` action value `"donate"`, and accepting `rollDice` `diceCount ∈ {1,2,3}`. `GameRoom.onMessage` already forwards `p.action`/`p.payload` for `cardAction` and `Number(p.diceCount)` for `rollDice`, so no Worker edit is needed for these.
- **Backward-compatible persistence.** Any new `Player` field MUST be added to `toState()`, `fromState()`, and `toPublic()`, and MUST default safely when missing from an older saved state (DO storage may hold pre-change saves).
- **TDD loop every task:** write failing test → run (confirm fail) → minimal implementation → run (confirm pass) → commit.
- Commit messages: short imperative prefix style matching recent history (e.g. `fix:`, `feat:`, `test:`, `chore:`). Repo commits in English; keep that.
- Money values are plain numbers (USD). Dice are 1–6 (`Math.floor(Math.random()*6)+1`).

---

### Task 1: Vitest harness + characterization baseline

Stand up the test runner and a shared fixture, proving the engine imports cleanly under Vitest (the engine's `.js` specifiers must resolve to `.ts`).

**Files:**
- Modify: `cashflow-modern/server/package.json` (add `vitest` devDep + scripts)
- Create: `cashflow-modern/server/vitest.config.ts`
- Create: `cashflow-modern/server/src/engine/test-helpers.ts`
- Create: `cashflow-modern/server/src/engine/Player.test.ts`
- Modify: `cashflow-modern/package.json` (root: add `test` script)

**Interfaces:**
- Produces: `makeProfession(overrides?: Partial<Profession>): Profession` and `makePlayer(overrides?: Partial<Profession>): Player` from `test-helpers.ts`, used by all later tests.

- [ ] **Step 1: Add Vitest to the server package**

In `cashflow-modern/server/package.json`, add to `devDependencies` and `scripts`:

```jsonc
// scripts:
"test": "vitest run",
"test:watch": "vitest"
// devDependencies (add):
"vitest": "^1.6.0"
```

Then install:

Run: `cd cashflow-modern/server && npm install`
Expected: `vitest` added to `node_modules`, no errors.

- [ ] **Step 2: Create the Vitest config (resolves `.js` specifiers to `.ts`)**

Create `cashflow-modern/server/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

// The engine uses explicit ".js" import specifiers (NodeNext/bundler style) on
// files that are actually ".ts". Strip the ".js" from relative specifiers so
// Vite resolves them to the ".ts" source during tests.
export default defineConfig({
  resolve: {
    alias: [{ find: /^(\.{1,2}\/.*)\.js$/, replacement: '$1' }]
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node'
  }
});
```

- [ ] **Step 3: Create the shared test fixture**

Create `cashflow-modern/server/src/engine/test-helpers.ts`:

```ts
import type { Profession } from './types.js';
import { Player } from './Player.js';

/** Deterministic profession: cashFlow = 3000 - 1500 = 1500; savings 1000. */
export const makeProfession = (overrides: Partial<Profession> = {}): Profession => ({
  profession: 'Tester',
  income: { salary: 3000, realEstates: [], businesses: [] },
  babies: 0,
  expenses: {
    taxes: 400,
    homeMortgagePayment: 300,
    schoolLoanPayment: 0,
    carLoanPayment: 100,
    creditCardPayment: 100,
    otherExpenses: 600,
    bankLoanPayment: 0,
    perChildExpense: 200
  },
  assets: { savings: 1000, preciousMetals: [], stocks: [], realEstates: [], businesses: [] },
  liabilities: { homeMortgage: 30000, schoolLoans: 0, carLoans: 5000, creditCardDebt: 3000, bankLoan: 0, realEstates: [] },
  ...overrides
});

export const makePlayer = (overrides: Partial<Profession> = {}): Player =>
  new Player('p1', 'Tester', '#fff', true, makeProfession(overrides));
```

- [ ] **Step 4: Write a passing characterization test**

Create `cashflow-modern/server/src/engine/Player.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makePlayer } from './test-helpers.js';

describe('Player income statement (baseline)', () => {
  it('computes totalExpenses, cashFlow, and starting cash', () => {
    const p = makePlayer();
    expect(p.totalExpenses).toBe(1500); // 400+300+0+100+100+600+0 + 0*200
    expect(p.totalIncome).toBe(3000); // salary 3000 + passive 0
    expect(p.cashFlow).toBe(1500);
    expect(p.cash).toBe(1000); // CURRENT behavior: cash = savings only (changes in Task 2)
  });
});
```

- [ ] **Step 5: Run tests to verify they pass (imports resolve)**

Run: `cd cashflow-modern/server && npm test`
Expected: PASS, 1 test. If you instead see an import-resolution error for `./types.js`/`./Player.js`, the alias in Step 2 is wrong — fix it before continuing.

- [ ] **Step 6: Wire a root test script**

In `cashflow-modern/package.json` `scripts`, add:

```jsonc
"test": "npm --prefix server run test"
```

Run: `cd cashflow-modern && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add cashflow-modern/server/package.json cashflow-modern/server/package-lock.json cashflow-modern/server/vitest.config.ts cashflow-modern/server/src/engine/test-helpers.ts cashflow-modern/server/src/engine/Player.test.ts cashflow-modern/package.json
git commit -m "test: add Vitest harness + engine fixtures"
```

---

### Task 2: H1 — Starting cash = Monthly Cash Flow + Savings (then erase savings)

Official: at start each player receives **Monthly Cash Flow + Savings** once, then Savings is erased. Current `Game.start()` (`Game.ts:110-125`) leaves cash = savings only.

**Files:**
- Modify: `cashflow-modern/server/src/engine/Game.ts:115-119`
- Test: `cashflow-modern/server/src/engine/Game.test.ts` (create)

**Interfaces:**
- Consumes: `Player.cashFlow` getter, `Player.assets.savings`, `Player.cash` (existing).

- [ ] **Step 1: Write the failing test**

Create `cashflow-modern/server/src/engine/Game.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Game } from './Game.js';
import professions from '../data/professions.json';

const start2 = () => {
  const g = new Game('ROOM');
  g.addPlayer('a', 'Alice');
  g.addPlayer('b', 'Bob');
  g.start('a');
  return g;
};

describe('Game.start — starting cash (H1)', () => {
  it('gives each player cashFlow + savings, then zeroes savings', () => {
    const g = start2();
    for (const p of g.players) {
      const prof = (professions as any[]).find((x) => x.profession === p.professionName);
      expect(p.cash).toBe(p.cashFlow + prof.assets.savings);
      expect(p.assets.savings).toBe(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cashflow-modern/server && npx vitest run src/engine/Game.test.ts`
Expected: FAIL — `cash` equals savings only (not `cashFlow + savings`), and `savings` is non-zero.

- [ ] **Step 3: Implement the fix**

In `Game.ts`, change the `start()` player-rebuild loop (currently lines 116-119):

```ts
    this.players.forEach((p, i) => {
      const fresh = new Player(p.id, p.username, COLORS[i % COLORS.length], p.isHost, profs[i]);
      // Official setup: distribute one Monthly Cash Flow + Savings, then erase Savings.
      fresh.cash = fresh.cashFlow + fresh.assets.savings;
      fresh.assets.savings = 0;
      this.players[i] = fresh;
    });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cashflow-modern/server && npx vitest run src/engine/Game.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cashflow-modern/server/src/engine/Game.ts cashflow-modern/server/src/engine/Game.test.ts
git commit -m "fix: start players with cashFlow + savings, then erase savings (H1)"
```

---

### Task 3: C1 — Rat Race Charity donate action (fix dead-end)

Bug: landing on Rat Race Charity (`Game.ts:247-250`) draws a charity card but never resolves and has no action to apply it, so the player can only `skip`. Add a `donate` action that calls the existing `Player.charity()`.

**Files:**
- Modify: `cashflow-modern/server/src/engine/Game.ts` `cardAction()` switch (after the `skip` case, ~line 315)
- Test: `cashflow-modern/server/src/engine/Game.test.ts`

**Interfaces:**
- Consumes: `Player.charity(): boolean` (cost `round(0.1*totalIncome)`, sets `extraDiceTurns=3`), `Game.cardAction(id, action, payload)`.

- [ ] **Step 1: Write the failing test**

Add to `Game.test.ts`:

```ts
import { ratRaceTileType } from './board.js';

describe('Rat Race Charity (C1)', () => {
  it('lets the current player donate via cardAction("donate")', () => {
    const g = start2();
    const me = g.currentPlayer;
    // Force the engine into "landed on charity with a pending charity card".
    me.position = 4; // charity tile
    (g as any).pendingCard = { id: 'c', type: 'charity', heading: 'Charity' };
    (g as any).resolved = false;
    (g as any).hasRolled = true;

    const before = me.cash;
    const res = g.cardAction(me.id, 'donate');
    expect(res.ok).toBe(true);
    expect(me.extraDiceTurns).toBe(3);
    expect(me.cash).toBe(before - Math.round(0.1 * me.totalIncome));
    expect((g as any).pendingCard).toBeNull();
    expect((g as any).resolved).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cashflow-modern/server && npx vitest run src/engine/Game.test.ts -t "Charity"`
Expected: FAIL — `unknown_action` (no `donate` case).

- [ ] **Step 3: Implement the fix**

In `Game.ts` `cardAction()`, add a case immediately after the `skip` case (after line 315):

```ts
      case 'donate': {
        if (card.type !== 'charity') return fail('not_charity');
        if (!p.charity()) return fail('insufficient_cash');
        this.log(p, 'donated to charity — may roll 1 or 2 dice for 3 turns');
        this.pendingCard = null;
        this.resolved = true;
        return ok();
      }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cashflow-modern/server && npx vitest run src/engine/Game.test.ts -t "Charity"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cashflow-modern/server/src/engine/Game.ts cashflow-modern/server/src/engine/Game.test.ts
git commit -m "fix: add Rat Race charity donate action (C1)"
```

---

### Task 4: M9 — Downsized cancels the Charity dice bonus

Official: Downsized "also ends the affect of Charity." Current `Player.downsized()` (`Player.ts:145-150`) doesn't reset `extraDiceTurns`.

**Files:**
- Modify: `cashflow-modern/server/src/engine/Player.ts:145-150`
- Test: `cashflow-modern/server/src/engine/Player.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `Player.test.ts`:

```ts
import { describe as d2, it as i2, expect as e2 } from 'vitest';

d2('Downsized cancels charity (M9)', () => {
  i2('resets extraDiceTurns to 0', () => {
    const p = makePlayer();
    p.charity(); // sets extraDiceTurns = 3
    e2(p.extraDiceTurns).toBe(3);
    p.downsized();
    e2(p.extraDiceTurns).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cashflow-modern/server && npx vitest run src/engine/Player.test.ts -t "Downsized"`
Expected: FAIL — `extraDiceTurns` is still 3.

- [ ] **Step 3: Implement the fix**

In `Player.ts` `downsized()`:

```ts
  downsized(): number {
    const amount = this.totalExpenses;
    this.record(-amount, 'Downsized');
    this.skippedTurns = 2;
    this.extraDiceTurns = 0; // Downsized ends the Charity dice bonus
    return amount;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cashflow-modern/server && npx vitest run src/engine/Player.test.ts -t "Downsized"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cashflow-modern/server/src/engine/Player.ts cashflow-modern/server/src/engine/Player.test.ts
git commit -m "fix: Downsized cancels the charity dice bonus (M9)"
```

---

### Task 5: C2 — De-duplicate Fast Track investments

Bug: `ownedInvestments` is serialized but never written, so a player can re-buy the same investment tile every lap. Record ownership and reject re-buys.

**Files:**
- Modify: `cashflow-modern/server/src/engine/Player.ts` `buyFastTrackInvestment()` (369-374)
- Modify: `cashflow-modern/server/src/engine/Game.ts` `fastTrackAction()` investment branch (533-541)
- Test: `cashflow-modern/server/src/engine/Player.test.ts`

**Interfaces:**
- Consumes: `Player.ownedInvestments: Set<string>` (exists, line 48).
- Produces: `Player.buyFastTrackInvestment(cost, cashFlow, name, id)` — adds a 4th param `id`.

- [ ] **Step 1: Write the failing test**

Add to `Player.test.ts`:

```ts
import { describe as d5, it as i5, expect as e5 } from 'vitest';

d5('Fast Track investment de-dup (C2)', () => {
  i5('records ownership and refuses a second buy of the same tile', () => {
    const p = makePlayer();
    p.cash = 1_000_000;
    expect(p.buyFastTrackInvestment(200000, 20000, 'Software', 'software')).toBe(true);
    expect(p.ownedInvestments.has('software')).toBe(true);
    expect(p.buyFastTrackInvestment(200000, 20000, 'Software', 'software')).toBe(false);
    expect(p.fastTrackCashFlowGain).toBe(20000); // only counted once
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cashflow-modern/server && npx vitest run src/engine/Player.test.ts -t "de-dup"`
Expected: FAIL — second buy returns `true` and gain doubles to 40000.

- [ ] **Step 3: Implement the fix (Player)**

Replace `Player.buyFastTrackInvestment()`:

```ts
  buyFastTrackInvestment(cost: number, cashFlow: number, name: string, id: string): boolean {
    if (this.ownedInvestments.has(id)) return false;
    if (this.cash < cost) return false;
    this.record(-cost, `Invest: ${name}`);
    this.fastTrackCashFlowGain += cashFlow;
    this.ownedInvestments.add(id);
    return true;
  }
```

- [ ] **Step 4: Update the caller (Game)**

In `Game.ts` `fastTrackAction()` investment branch (533-536), pass the tile id and map the failure to a clearer error:

```ts
    if (tile.kind === 'investment') {
      if (this.currentPlayer.ownedInvestments.has(tile.id ?? '')) return fail('already_owned');
      if (!p.buyFastTrackInvestment(tile.cost ?? 0, tile.cashFlow ?? 0, tile.name ?? 'investment', tile.id ?? '')) {
        return fail('insufficient_cash');
      }
```

(Leave the rest of the branch — log, clear `pendingFastTrackTile`, `resolved = true`, `checkFastTrackWin()` — unchanged.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd cashflow-modern/server && npx vitest run`
Expected: PASS (all).

- [ ] **Step 6: Commit**

```bash
git add cashflow-modern/server/src/engine/Player.ts cashflow-modern/server/src/engine/Game.ts cashflow-modern/server/src/engine/Player.test.ts
git commit -m "fix: de-duplicate Fast Track investments via ownedInvestments (C2)"
```

---

### Task 6: M1 — Fast Track loss amounts (Divorce = all cash, Lawsuit = half)

Official: Tax Audit = ½ cash (already correct), **Divorce = ALL cash**, **Lawsuit = ½ cash**. Current `fastTrack.ts` has Divorce as `half:true` and Lawsuit as fixed `$50,000`.

**Files:**
- Modify: `cashflow-modern/server/src/engine/types.ts` (`FastTrackTile` — add `full?: boolean`)
- Modify: `cashflow-modern/server/src/data/fastTrack.ts:41,52`
- Modify: `cashflow-modern/server/src/engine/Player.ts` `payFastTrackLoss()` (376-380)
- Test: `cashflow-modern/server/src/engine/Player.test.ts`

**Interfaces:**
- Produces: `Player.payFastTrackLoss(amount: number, half: boolean, label: string, full?: boolean): number`.

- [ ] **Step 1: Write the failing test**

Add to `Player.test.ts`:

```ts
import { describe as d6, it as i6, expect as e6 } from 'vitest';

d6('Fast Track losses (M1)', () => {
  i6('full=true takes all cash; half=true takes half', () => {
    const p = makePlayer();
    p.cash = 80000;
    expect(p.payFastTrackLoss(0, false, 'Divorce', true)).toBe(80000);
    expect(p.cash).toBe(0);
    p.cash = 60000;
    expect(p.payFastTrackLoss(0, true, 'Lawsuit')).toBe(30000);
    expect(p.cash).toBe(30000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cashflow-modern/server && npx vitest run src/engine/Player.test.ts -t "Fast Track losses"`
Expected: FAIL — `payFastTrackLoss` has no `full` param (4th arg ignored, returns `amount`=0).

- [ ] **Step 3: Add the `full` field to the type**

In `types.ts` `FastTrackTile` (after `half?: boolean;`, line 174):

```ts
  full?: boolean; // loss = all of cash (e.g. Divorce)
```

- [ ] **Step 4: Implement `payFastTrackLoss`**

Replace in `Player.ts`:

```ts
  payFastTrackLoss(amount: number, half: boolean, label: string, full = false): number {
    const pay = full ? this.cash : half ? Math.round(this.cash / 2) : amount;
    this.record(-pay, label);
    return pay;
  }
```

- [ ] **Step 5: Update the board data and the caller**

In `fastTrack.ts`:
- Line 41 (Lawsuit, idx 20) → make it half cash:

```ts
  { index: 20, kind: 'loss', name: 'Lawsuit — pay half your cash', nameTh: 'ถูกฟ้องร้อง — จ่ายเงินสดครึ่งหนึ่ง', half: true },
```

- Line 52 (Divorce, idx 31) → take all cash:

```ts
  { index: 31, kind: 'loss', name: 'Divorce — pay all your cash', nameTh: 'หย่าร้าง — จ่ายเงินสดทั้งหมด', full: true }
```

In `Game.ts` `resolveFastTrackLanding()` loss case (line 500), forward the `full` flag:

```ts
        const paid = p.payFastTrackLoss(tile.amount ?? 0, !!tile.half, tile.name ?? 'Loss', !!tile.full);
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd cashflow-modern/server && npx vitest run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add cashflow-modern/server/src/engine/types.ts cashflow-modern/server/src/data/fastTrack.ts cashflow-modern/server/src/engine/Player.ts cashflow-modern/server/src/engine/Game.ts cashflow-modern/server/src/engine/Player.test.ts
git commit -m "fix: Fast Track losses — Divorce takes all cash, Lawsuit takes half (M1)"
```

---

### Task 7: M3 — Fast Track Charity = rulebook (roll 1/2/3 dice for the rest of the game, no cost)

Official (rulebook edition, chosen): Fast Track Charity grants the permanent option to roll **1, 2, or 3 dice** each Fast Track turn for the rest of the game, at no cost. Current code reuses the Rat Race `Player.charity()` (10% cost, 2-dice / 3-turn) on the Fast Track tile.

**Files:**
- Modify: `cashflow-modern/server/src/engine/Player.ts` (add `ftCharityDice` field + serialization + `toPublic`)
- Modify: `cashflow-modern/server/src/engine/types.ts` (`PublicPlayer` — add `ftCharityDice`)
- Modify: `cashflow-modern/server/src/engine/Game.ts` `resolveFastTrackLanding()` charity case (493-497) and `rollDice()` dice-count logic (189-191)
- Test: `cashflow-modern/server/src/engine/Game.test.ts`

**Interfaces:**
- Produces: `Player.ftCharityDice: boolean` (default `false`); when true and `phase==='fastTrack'`, `rollDice` accepts `diceCount ∈ {1,2,3}`.

- [ ] **Step 1: Write the failing test**

Add to `Game.test.ts`:

```ts
describe('Fast Track Charity rulebook edition (M3)', () => {
  it('grants permanent 1/2/3-dice choice at no cost', () => {
    const g = start2();
    const me = g.currentPlayer;
    me.phase = 'fastTrack';
    me.fastTrackPosition = 4; // a charity tile
    me.cash = 500000;
    const before = me.cash;

    // Simulate landing on charity by invoking the private resolver.
    (g as any).resolveFastTrackLanding(0);
    expect(me.ftCharityDice).toBe(true);
    expect(me.cash).toBe(before); // no cost

    // Now the player may roll 3 dice on the Fast Track.
    (g as any).hasRolled = false;
    const res = g.rollDice(me.id, 3);
    expect(res.ok).toBe(true);
    expect((g as any).diceValues.length).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cashflow-modern/server && npx vitest run src/engine/Game.test.ts -t "Fast Track Charity"`
Expected: FAIL — `ftCharityDice` undefined; rollDice forces 2 dice on Fast Track.

- [ ] **Step 3: Add the field + serialization (Player.ts)**

In the field block (after line 53 `hasMlm = false;`):

```ts
  ftCharityDice = false; // Fast Track charity: may roll 1/2/3 dice for the rest of the game
```

In `toPublic()` (after `hasMlm: this.hasMlm,`, line 412):

```ts
      ftCharityDice: this.ftCharityDice,
```

In `toState()` (after `hasMlm: this.hasMlm,`, line 444):

```ts
      ftCharityDice: this.ftCharityDice,
```

(`fromState()` uses `Object.assign`, so it picks the field up automatically; missing-in-old-saves becomes `undefined` → treated falsy by the rollDice check below.)

- [ ] **Step 4: Add the field to PublicPlayer (types.ts)**

In `PublicPlayer` (after `hasMlm: boolean;`, line 222):

```ts
  ftCharityDice: boolean;
```

- [ ] **Step 5: Implement the rule (Game.ts)**

Charity case in `resolveFastTrackLanding()` (replace lines 493-497):

```ts
      case 'charity': {
        p.ftCharityDice = true; // permanent: may roll 1/2/3 dice, no cost
        this.log(p, 'donated to charity — may now roll 1, 2, or 3 dice on the Fast Track');
        this.resolved = true;
        break;
      }
```

Dice-count logic in `rollDice()` (replace lines 189-191):

```ts
    let count = 1;
    if (p.phase === 'fastTrack') {
      count = p.ftCharityDice ? Math.min(3, Math.max(1, diceCount || 2)) : 2;
    } else if (p.extraDiceTurns > 0) {
      count = diceCount === 2 ? 2 : 1;
    }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd cashflow-modern/server && npx vitest run`
Expected: PASS.

- [ ] **Step 7: Typecheck the client (PublicPlayer is shared)**

Run: `cd cashflow-modern && npm run typecheck`
Expected: PASS. If the client `PublicPlayer` type is a separate copy in `client/src/lib/types.ts`, add `ftCharityDice: boolean;` there too, then re-run.

- [ ] **Step 8: Commit**

```bash
git add cashflow-modern/server/src/engine/Player.ts cashflow-modern/server/src/engine/types.ts cashflow-modern/server/src/engine/Game.ts cashflow-modern/server/src/engine/Game.test.ts
git commit -m "feat: Fast Track charity grants permanent 1/2/3-dice choice, no cost (M3)"
```

---

### Task 8: C3 — Market damage that exceeds cash must force the debt (rescue), not vanish

Bug: `payDamages` can return `'insufficient'`, but `autoResolveMarket` (`Game.ts:277-283`) only handles `'noRealEstate'`/`'paid'` and clears the card anyway — an unaffordable mandatory damage silently disappears. Force the debit so `needsRescue()` engages.

**Files:**
- Modify: `cashflow-modern/server/src/engine/Game.ts` `autoResolveMarket()` (277-283)
- Test: `cashflow-modern/server/src/engine/Game.test.ts`

**Interfaces:**
- Consumes: `Player.payDamages(card): 'paid'|'noRealEstate'|'insufficient'`, `Player.forcePay(amount, desc)`, `Player.needsRescue()`.

- [ ] **Step 1: Write the failing test**

Add to `Game.test.ts`:

```ts
describe('Market damage insufficient (C3)', () => {
  it('forces the full debit (cash goes negative) instead of vanishing', () => {
    const g = start2();
    const me = g.currentPlayer;
    // Owns real estate so damage applies; cash too low to cover.
    me.assets.realEstates.push({ id: 're', type: 'realEstate', symbol: 'house', cost: 50000, mortgage: 40000, downPayment: 10000, cashFlow: 200 });
    me.cash = 100;
    (g as any).pendingCard = { id: 'd', type: 'damage', heading: 'Storm', cost: 5000 };
    (g as any).autoResolveMarket();
    expect(me.cash).toBe(100 - 5000);
    expect(me.needsRescue()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cashflow-modern/server && npx vitest run src/engine/Game.test.ts -t "Market damage"`
Expected: FAIL — cash stays 100 (the charge vanished).

- [ ] **Step 3: Implement the fix**

In `autoResolveMarket()`, replace the `damage` block (277-283):

```ts
    if (card.type === 'damage') {
      const res = p.payDamages(card);
      if (res === 'noRealEstate') {
        this.log(p, 'has no real estate — damage ignored');
      } else if (res === 'paid') {
        this.log(p, `paid damages $${(card.cost ?? 0).toLocaleString()}`);
      } else {
        // Mandatory damage the player cannot afford: force the debit and let
        // needsRescue() require them to resolve the debt before ending the turn.
        p.forcePay(card.cost ?? 0, card.heading ?? 'Property damage');
        this.log(p, `damages $${(card.cost ?? 0).toLocaleString()} exceed cash — must resolve debt`);
      }
      this.pendingCard = null;
      this.resolved = true;
      return;
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd cashflow-modern/server && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cashflow-modern/server/src/engine/Game.ts cashflow-modern/server/src/engine/Game.test.ts
git commit -m "fix: unaffordable market damage forces debt + rescue (C3)"
```

---

### Task 9: C6 — Record mortgages as liabilities on purchase

Bug: `buyRealEstate`/`buyBusiness` store the mortgage on the asset but never push to `liabilities.realEstates`, so the balance sheet under-reports debt.

**Files:**
- Modify: `cashflow-modern/server/src/engine/Player.ts` `buyRealEstate()` (165-182), `buyBusiness()` (184-201)
- Test: `cashflow-modern/server/src/engine/Player.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `Player.test.ts`:

```ts
import { describe as d9, it as i9, expect as e9 } from 'vitest';

d9('Mortgage recorded as liability (C6)', () => {
  i9('pushes the bought property into liabilities.realEstates', () => {
    const p = makePlayer();
    p.cash = 100000;
    p.buyRealEstate({ id: 're1', type: 'realEstate', symbol: 'duplex', cost: 60000, mortgage: 48000, downPayment: 12000, cashFlow: 300 } as any);
    e9(p.liabilities.realEstates.length).toBe(1);
    e9(p.liabilities.realEstates[0].mortgage).toBe(48000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cashflow-modern/server && npx vitest run src/engine/Player.test.ts -t "Mortgage"`
Expected: FAIL — `liabilities.realEstates` is empty.

- [ ] **Step 3: Implement the fix**

In `buyRealEstate()`, after `this.income.realEstates.push(asset);` (line 179) add:

```ts
    this.liabilities.realEstates.push(asset);
```

In `buyBusiness()`, after `this.income.businesses!.push(asset);` (line 198) add (businesses share the `RealEstateAsset[]` liabilities array shape; `asset` has `mortgage`):

```ts
    if (asset.mortgage) this.liabilities.realEstates.push(asset as unknown as RealEstateAsset);
```

Also, when a property is sold at market in `sellRealEstate()` (262-272), remove it from liabilities too — after the `income.realEstates` filter (line 269) add:

```ts
    this.liabilities.realEstates = this.liabilities.realEstates.filter((r) => r.id !== id);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd cashflow-modern/server && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cashflow-modern/server/src/engine/Player.ts cashflow-modern/server/src/engine/Player.test.ts
git commit -m "fix: record property mortgages as liabilities on buy/sell (C6)"
```

---

### Task 10: H2 — Bankruptcy debt-relief step before declaring a player out

Official: after selling all assets, if still negative, halve **car loans, credit cards** (and their payments); keep mortgage + school loan; declare bankrupt only afterward.

> **Open question (from spec §8):** the rulebook's exact interaction between debt relief and the negative-cash bankruptcy test is medium-confidence. This task halves the consumer debts/payments (balance-sheet relief) before the bankrupt check, per the audit reading. Confirm against a physical rulebook before treating the elimination threshold as final.

**Files:**
- Modify: `cashflow-modern/server/src/engine/Player.ts` `liquidateEverything()` (324-338)
- Test: `cashflow-modern/server/src/engine/Player.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `Player.test.ts`:

```ts
import { describe as d10, it as i10, expect as e10 } from 'vitest';

d10('Bankruptcy debt relief (H2)', () => {
  i10('halves car loan + credit card (and payments), keeps mortgage, before bankrupt', () => {
    const p = makePlayer(); // carLoans 5000, creditCardDebt 3000, homeMortgage 30000
    p.expenses.carLoanPayment = 100;
    p.expenses.creditCardPayment = 100;
    p.cash = -2000; // negative and no assets to sell
    p.liquidateEverything();
    e10(p.liabilities.carLoans).toBe(2500);
    e10(p.liabilities.creditCardDebt).toBe(1500);
    e10(p.expenses.carLoanPayment).toBe(50);
    e10(p.expenses.creditCardPayment).toBe(50);
    e10(p.liabilities.homeMortgage).toBe(30000); // untouched
    e10(p.isBankrupt).toBe(true); // still negative cash → out
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cashflow-modern/server && npx vitest run src/engine/Player.test.ts -t "Bankruptcy"`
Expected: FAIL — debts/payments unchanged; bankrupt set without relief.

- [ ] **Step 3: Implement the fix**

Replace `liquidateEverything()` body's tail (the `this.record(...)` line and the bankrupt check, 336-337) with:

```ts
    this.record(Math.round(proceeds), 'Liquidated all assets');
    if (this.cash < 0) {
      // Debt relief: the bank forgives half of consumer debt (car + credit) and
      // halves their monthly payments. Mortgage and school loans remain.
      this.liabilities.carLoans = Math.round(this.liabilities.carLoans / 2);
      this.liabilities.creditCardDebt = Math.round(this.liabilities.creditCardDebt / 2);
      this.expenses.carLoanPayment = Math.round(this.expenses.carLoanPayment / 2);
      this.expenses.creditCardPayment = Math.round(this.expenses.creditCardPayment / 2);
    }
    if (this.cash < 0) this.isBankrupt = true;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd cashflow-modern/server && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cashflow-modern/server/src/engine/Player.ts cashflow-modern/server/src/engine/Player.test.ts
git commit -m "fix: bankruptcy debt-relief step before declaring out (H2)"
```

---

### Task 11: M7 + L5 — Non-bank debts paid in full; bank loans repaid in $1,000 units

Official: every debt except the bank loan must be paid off in **full**; bank loans repay in **$1,000** units. Current `payLoan` (`Player.ts:303-315`) accepts any partial amount for any liability.

**Files:**
- Modify: `cashflow-modern/server/src/engine/Player.ts` `payLoan()` (303-315)
- Test: `cashflow-modern/server/src/engine/Player.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `Player.test.ts`:

```ts
import { describe as d11, it as i11, expect as e11 } from 'vitest';

d11('Loan repayment rules (M7 + L5)', () => {
  i11('non-bank debt must be paid in full; bank loan in $1000 units', () => {
    const p = makePlayer(); // carLoans 5000
    p.cash = 100000;
    expect(p.payLoan(2000, 'carLoans')).toBe(false); // partial rejected
    expect(p.payLoan(5000, 'carLoans')).toBe(true); // full ok
    expect(p.liabilities.carLoans).toBe(0);
    expect(p.expenses.carLoanPayment).toBe(0);

    p.takeLoan(3000); // bankLoan 3000
    expect(p.payLoan(500, 'bankLoan')).toBe(false); // not a $1000 unit
    expect(p.payLoan(1000, 'bankLoan')).toBe(true);
    expect(p.liabilities.bankLoan).toBe(2000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cashflow-modern/server && npx vitest run src/engine/Player.test.ts -t "Loan repayment"`
Expected: FAIL — partial car payment of 2000 currently returns `true`; $500 bank payment currently returns `true`.

- [ ] **Step 3: Implement the fix**

Replace `payLoan()`:

```ts
  payLoan(amount: number, type: keyof Liabilities): boolean {
    if (typeof this.liabilities[type] !== 'number') return false;
    const debt = this.liabilities[type] as number;
    if (amount <= 0 || amount > debt || this.cash < amount) return false;
    if (type === 'bankLoan') {
      if (amount % 1000 !== 0) return false; // bank loans repay in $1,000 units
    } else if (amount !== debt) {
      return false; // non-bank debts must be paid in full
    }
    (this.liabilities[type] as number) -= amount;
    if (type === 'bankLoan') {
      this.expenses.bankLoanPayment = this.liabilities.bankLoan / 10;
    } else if (this.liabilities[type] === 0 && LOAN_EXPENSE_FIELD[type]) {
      this.expenses[LOAN_EXPENSE_FIELD[type]] = 0;
    }
    this.record(-amount, `Pay ${type}`);
    return true;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd cashflow-modern/server && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cashflow-modern/server/src/engine/Player.ts cashflow-modern/server/src/engine/Player.test.ts
git commit -m "fix: non-bank debts paid in full; bank loans in \$1000 units (M7, L5)"
```

---

### Task 12: M8 + L6 — No bank loans on the Fast Track; bankrupt players cannot borrow

Official: bank borrowing is a Rat Race mechanic; a bankrupt player may not borrow. Current `Game.takeLoan` (`Game.ts:430-436`) guards neither.

**Files:**
- Modify: `cashflow-modern/server/src/engine/Game.ts` `takeLoan()` (430-436)
- Test: `cashflow-modern/server/src/engine/Game.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `Game.test.ts`:

```ts
describe('Loan guards (M8 + L6)', () => {
  it('rejects loans on Fast Track and for bankrupt players', () => {
    const g = start2();
    const me = g.currentPlayer;
    me.phase = 'fastTrack';
    expect(g.takeLoan(me.id, 1000).ok).toBe(false);
    me.phase = 'ratRace';
    me.isBankrupt = true;
    expect(g.takeLoan(me.id, 1000).ok).toBe(false);
    me.isBankrupt = false;
    expect(g.takeLoan(me.id, 1000).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cashflow-modern/server && npx vitest run src/engine/Game.test.ts -t "Loan guards"`
Expected: FAIL — the Fast Track and bankrupt loans currently succeed.

- [ ] **Step 3: Implement the fix**

Replace `Game.takeLoan()`:

```ts
  takeLoan(id: string, amount: number): ActionResult {
    if (!this.isCurrent(id)) return fail('not_your_turn');
    const p = this.currentPlayer;
    if (p.phase === 'fastTrack') return fail('no_loans_on_fast_track');
    if (p.isBankrupt) return fail('bankrupt');
    if (!p.takeLoan(amount)) return fail('invalid_amount');
    this.log(p, `took a bank loan of $${amount.toLocaleString()}`);
    return ok();
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd cashflow-modern/server && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cashflow-modern/server/src/engine/Game.ts cashflow-modern/server/src/engine/Game.test.ts
git commit -m "fix: no bank loans on Fast Track; bankrupt players cannot borrow (M8, L6)"
```

---

### Task 13: L2 + L10 — Require 2 players to start; randomize the first player

Official: 2–6 players; highest roll goes first. Current `start()` allows a solo game and always sets `currentIndex=0`.

**Files:**
- Modify: `cashflow-modern/server/src/engine/Game.ts` `start()` (113, 121)
- Test: `cashflow-modern/server/src/engine/Game.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `Game.test.ts`:

```ts
describe('Start guards (L2 + L10)', () => {
  it('needs >= 2 players and starts on a valid current player', () => {
    const solo = new Game('R');
    solo.addPlayer('a', 'Solo');
    expect(solo.start('a').ok).toBe(false); // need_players

    const g = start2();
    expect(g.status).toBe('started');
    expect(g.players.some((p) => p.id === g.currentPlayer.id)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cashflow-modern/server && npx vitest run src/engine/Game.test.ts -t "Start guards"`
Expected: FAIL — solo start currently returns `ok:true`.

- [ ] **Step 3: Implement the fix**

In `start()`: change the guard (line 113) and the first-player selection (line 121):

```ts
    if (this.players.length < 2) return fail('need_players');
```

```ts
    this.status = 'started';
    this.currentIndex = Math.floor(Math.random() * this.players.length); // highest-roll-goes-first ≈ random
    this.beginTurn();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd cashflow-modern/server && npx vitest run`
Expected: PASS. (Existing `start2()`-based tests already use 2 players.)

- [ ] **Step 5: Commit**

```bash
git add cashflow-modern/server/src/engine/Game.ts cashflow-modern/server/src/engine/Game.test.ts
git commit -m "fix: require 2 players and randomize first player (L2, L10)"
```

---

### Task 14: L1 — Swap Baby and Downsized tile positions

Canonical (fan-sourced, medium-confidence): Baby at slot 12, Downsized at slot 20. Gameplay-neutral, but match the standard layout. Keep server and client board maps in sync.

**Files:**
- Modify: `cashflow-modern/server/src/engine/board.ts:16-17`
- Modify: `cashflow-modern/client/src/lib/boardLayout.ts:18-20`
- Test: `cashflow-modern/server/src/engine/board.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `cashflow-modern/server/src/engine/board.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ratRaceTileType } from './board.js';

describe('Rat Race tile layout (L1)', () => {
  it('Baby is at 12 and Downsized at 20', () => {
    expect(ratRaceTileType(12)).toBe('baby');
    expect(ratRaceTileType(20)).toBe('downsized');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cashflow-modern/server && npx vitest run src/engine/board.test.ts`
Expected: FAIL — currently 12=downsized, 20=baby.

- [ ] **Step 3: Implement the fix (server)**

In `board.ts` swap lines 16-17:

```ts
assign([20], 'downsized');
assign([12], 'baby');
```

- [ ] **Step 4: Mirror in the client board layout**

In `client/src/lib/boardLayout.ts` swap the matching `set(...)` lines (18-20):

```ts
set([20], 'downsized');
set([12], 'baby');
```

- [ ] **Step 5: Run tests + typecheck**

Run: `cd cashflow-modern/server && npx vitest run src/engine/board.test.ts`
Expected: PASS.
Run: `cd cashflow-modern && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add cashflow-modern/server/src/engine/board.ts cashflow-modern/client/src/lib/boardLayout.ts cashflow-modern/server/src/engine/board.test.ts
git commit -m "fix: swap Baby/Downsized to canonical tile positions (L1)"
```

---

### Task 15: C7 — De-duplicate card IDs

Bug: `marketLottery03` and `marketPlexBuyer16` each appear twice in `cards.json`. Re-id the duplicates and add a guard test.

**Files:**
- Modify: `cashflow-modern/server/src/data/cards.json` (the second `marketLottery03` and second `marketPlexBuyer16`)
- Test: `cashflow-modern/server/src/data/cards.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `cashflow-modern/server/src/data/cards.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import cards from './cards.json';

describe('cards.json (C7)', () => {
  it('has no duplicate ids within any deck', () => {
    const dupes: string[] = [];
    for (const [deck, list] of Object.entries(cards as Record<string, { id: string }[]>)) {
      const seen = new Set<string>();
      for (const c of list) {
        if (seen.has(c.id)) dupes.push(`${deck}:${c.id}`);
        seen.add(c.id);
      }
    }
    expect(dupes).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cashflow-modern/server && npx vitest run src/data/cards.test.ts`
Expected: FAIL — reports `market:marketLottery03` and `market:marketPlexBuyer16`.

- [ ] **Step 3: Implement the fix**

In `cards.json`, find the **second** occurrence of each duplicate id and rename it:
- second `"id": "marketLottery03"` → `"id": "marketLottery03b"`
- second `"id": "marketPlexBuyer16"` → `"id": "marketPlexBuyer16b"`

(Use the test's failure plus a search to locate the second occurrence. Card ids are used only for lookup/keys, so a unique suffix is safe.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cashflow-modern/server && npx vitest run src/data/cards.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cashflow-modern/server/src/data/cards.json cashflow-modern/server/src/data/cards.test.ts
git commit -m "fix: de-duplicate card ids in cards.json (C7)"
```

---

### Task 16: M2 — Investigate interest/dividend cards (decide & document)

Official passive income includes interest + dividends. The model omits them. Determine whether any 101 card actually grants recurring income; if not, document the accepted simplification (no code change). If yes, add the income lines.

**Files:**
- Read: `cashflow-modern/server/src/data/cards.json`
- Modify (only if needed): `types.ts`, `Player.ts`
- Modify: this plan / spec note

- [ ] **Step 1: Search the card data**

Run: `cd cashflow-modern/server/src/data && grep -iE 'dividend|interest|per month|/mo|recurring' cards.json | head -50`
Expected: a list (possibly empty) of cards referencing recurring income.

- [ ] **Step 2: Decide**
- If **no** card grants recurring interest/dividends: add a one-line note to the spec's §8 ("Passive income omits interest/dividends — no 101 card grants them; accepted") and **stop** (no code).
- If **some** do: open a follow-up task to add `interest`/`dividends` to `Expenses`/`Income` types and include them in `Player.passiveIncome` — out of scope to implement blindly here; record the exact card ids found.

- [ ] **Step 3: Commit (doc only, if applicable)**

```bash
git add docs/superpowers/specs/2026-06-18-cashflow-3d-board-and-rules-fidelity-design.md
git commit -m "docs: record interest/dividend investigation outcome (M2)"
```

---

### Task 17: C4 — Client `emit()` timeout must report failure, not success

Bug: `socket.ts:88-93` resolves `{ ok:true }` after 8s on no ack — a silent false success. Resolve a real failure instead.

**Files:**
- Modify: `cashflow-modern/client/src/lib/socket.ts:88-93`

- [ ] **Step 1: Implement the fix**

In `emit()`, change the timeout resolution:

```ts
    setTimeout(() => {
      if (pending.has(reqId)) {
        pending.delete(reqId);
        resolve({ ok: false, error: 'timeout' });
      }
    }, 8000);
```

- [ ] **Step 2: Verify by typecheck**

Run: `cd cashflow-modern && npm run typecheck`
Expected: PASS. (Callers already branch on `ack.ok`; a `false` here surfaces the existing error path / toast.)

- [ ] **Step 3: Commit**

```bash
git add cashflow-modern/client/src/lib/socket.ts
git commit -m "fix: client emit() reports timeout as failure, not success (C4)"
```

---

### Task 18: C5 — Client WebSocket auto-reconnect with backoff

Bug: `ws.onclose` (`socket.ts:75-77`) just nulls the socket; recovery needs a manual reload. Reconnect with backoff and re-join the saved room.

**Files:**
- Modify: `cashflow-modern/client/src/lib/socket.ts` (`connect()` close handler + a reconnect routine)

**Interfaces:**
- Consumes: `savedRoom()`, `LS.room`/`LS.name`, `playerId`, `stateCb` (existing module state).

- [ ] **Step 1: Implement reconnect-with-backoff**

In `socket.ts`, replace the `ws.onclose` handler inside `connect()` (lines 75-77) with a reconnect scheduler, and add the helper above `connect`:

```ts
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const scheduleReconnect = () => {
  const roomId = localStorage.getItem(LS.room);
  const name = localStorage.getItem(LS.name) || 'Player';
  if (!roomId || reconnectTimer) return;
  const delay = Math.min(10000, 500 * 2 ** reconnectAttempts);
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    reconnectAttempts += 1;
    try {
      await connect(roomId);
      await emit('join', { intent: 'resume', playerId, username: name });
      reconnectAttempts = 0;
    } catch {
      scheduleReconnect();
    }
  }, delay);
};
```

And the close handler:

```ts
    ws.onclose = () => {
      ws = null;
      scheduleReconnect();
    };
    ws.onopen = () => {
      opened = true;
      reconnectAttempts = 0;
      resolve();
    };
```

(Note: `leaveRoom()` calls `forget()` which removes `LS.room`, so `scheduleReconnect()` becomes a no-op after an intentional leave — correct.)

- [ ] **Step 2: Verify by typecheck**

Run: `cd cashflow-modern && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Manual verification**

Run: `cd cashflow-modern && npm run dev`, open the client, create a room, then kill the worker dev process and restart it. Expected: the client reconnects and the game state reappears without a manual reload. Note the result.

- [ ] **Step 4: Commit**

```bash
git add cashflow-modern/client/src/lib/socket.ts
git commit -m "fix: client auto-reconnects WebSocket with backoff + resume (C5)"
```

---

### Task 19: Cleanup — remove the dead `socket.io-client` dependency

The client uses native WebSocket; `socket.io-client` is unused (verified: not imported anywhere in `client/src`).

**Files:**
- Modify: `cashflow-modern/client/package.json`

- [ ] **Step 1: Confirm it is unused**

Run: `cd cashflow-modern/client && grep -rn "socket.io-client" src` 
Expected: no matches.

- [ ] **Step 2: Remove the dependency**

Remove the `"socket.io-client": "^4.7.5"` line from `client/package.json` `dependencies`, then:

Run: `cd cashflow-modern/client && npm install`
Expected: lockfile updates, no errors.

- [ ] **Step 3: Typecheck + build**

Run: `cd cashflow-modern && npm run typecheck && npm run build`
Expected: PASS (build emits `client/dist`).

- [ ] **Step 4: Commit**

```bash
git add cashflow-modern/client/package.json cashflow-modern/client/package-lock.json
git commit -m "chore: drop unused socket.io-client dependency"
```

> The Node Socket.IO server (`server/src/index.ts`, `rooms.ts`) and the legacy root app are intentionally left in place (no deletion without explicit instruction).

---

### Task 20: Full regression + verification

- [ ] **Step 1: Run the whole suite**

Run: `cd cashflow-modern && npm test`
Expected: PASS, all tasks' tests green.

- [ ] **Step 2: Typecheck client + worker**

Run: `cd cashflow-modern && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Manual smoke test**

Run: `cd cashflow-modern && npm run dev`. Play a short game in two browser tabs: roll, resolve a deal, land on charity and donate, take/pay a loan, and confirm payday on passing. Note any anomaly. (No completion claim until observed.)

- [ ] **Step 4: Commit any test-only fixups**

```bash
git add -A
git commit -m "test: regression pass for rules-fidelity work"
```

---

## Self-Review

**Spec coverage (spec §5):**
- C1 → Task 3 · C2 → Task 5 · C3 → Task 8 · C4 → Task 17 · C5 → Task 18 · C6 → Task 9 · C7 → Task 15 ✓
- H1 → Task 2 · H2 → Task 10 ✓
- M1 → Task 6 · M3 → Task 7 · M7 → Task 11 · M8 → Task 12 · M9 → Task 4 ✓
- M2 → Task 16 (investigate) ✓
- L1 → Task 14 · L2/L10 → Task 13 · L5 → Task 11 · L6 → Task 12 ✓
- Phase 0 test harness → Task 1 ✓
- Cleanup (socket.io-client) → Task 19 ✓
- Deferred M4/M5/M6/L8 → not in this plan (Phase 3), per spec §7 ✓

**Type consistency:**
- New `Player.ftCharityDice: boolean` defined (Task 7) and added to `toPublic`/`toState`/`PublicPlayer` in the same task.
- `buyFastTrackInvestment(cost, cashFlow, name, id)` — new 4th param defined in Task 5 and the only caller (`Game.fastTrackAction`) updated in the same task.
- `payFastTrackLoss(amount, half, label, full=false)` — new 4th param defined in Task 6 and the only caller (`Game.resolveFastTrackLanding`) updated in the same task.
- `FastTrackTile.full?: boolean` added in Task 6 before use.

**Placeholder scan:** no TBD/TODO; every code step shows complete code. Task 16 is an explicit investigation with a documented decision branch (not a placeholder).

**Note:** Tasks are mostly independent and may be reordered, except Task 1 (harness) must run first, and Tasks 5/6/7 each define+update their own interface within the task.
