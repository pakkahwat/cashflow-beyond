# 3D Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the CSS Rat Race ring + Fast Track grid with a real Three.js scene (procedural geometry, no art assets): 24-tile ring and 32-tile ring, 3D player tokens animated by `position`/`fastTrackPosition`, 3D dice that tumble to the server-provided `diceValues`, soft lighting + post-FX (Bloom on the active tile, Vignette, tone mapping). The DOM HUD (StatementPanel, LoanPanel, CardModal, FastTrackModal, DreamPicker, WinnerOverlay, ProfessionCard, Toast, Lobby, Home, turn banner + turn controls) stays exactly as-is, positioned over the canvas. A quality toggle (`'high' | 'low'`, persisted to localStorage), `prefers-reduced-motion`, and a WebGL-unavailable fallback to the existing CSS boards are all required. Client-only: consumes the existing `PublicGameState` over the current WebSocket; **no** server / wire-protocol change.

**Architecture:** A new `<Board3D>` component is a `@react-three/fiber` `<Canvas>` that renders the ring for the player's current `phase` (Rat Race ring **or** Fast Track ring — only one at a time, matching the current behavior in `Game.tsx`), the player tokens, the 3D dice, lighting and effects. `Game.tsx` chooses between `<Board3D/>` (when `render3d` is on **and** WebGL is available) and the existing `<RatRaceBoard/>`/`<FastTrackBoard/>` (the fallback path). All ring-coordinate and tile-color math lives in a **pure** module `client/src/lib/boardLayout3d.ts`, which is the only thing under unit test (Vitest). R3F visual components are verified manually (`npm run dev`).

**Tech Stack:** React 18.2 + React-DOM 18.2, Vite 4.5, TypeScript 5.4, Zustand 4.5. New 3D deps pinned to the React-18 / Fiber-v8 compatible line (see Global Constraints). Vitest added to the **client** package only, for the pure math module.

## Global Constraints
- **Pin EXACTLY these 3D versions** (verified compatible with React 18.2 / Fiber v8 / three's postprocessing window — do NOT bump to Fiber v9 / drei v10 / postprocessing v3, which need React 19 or fall outside the `postprocessing` core's three range): `three@^0.169.0`, `@react-three/fiber@^8.18.0`, `@react-three/drei@^9.122.0`, `@react-three/postprocessing@^2.19.1`; dev: `@types/three@^0.169.0`.
- Version floors that must hold: React 18.2 / React-DOM 18.2 / Fiber v8 / Vite 4.5 / TS 5.4. `@react-three/fiber@8` peer = `react >=18, three >=0.133`; `drei@9.122` peer = `react ^18, three >=0.137, @react-three/fiber ^8`; `@react-three/postprocessing@2.19.1` peer = `react ^18, three >=0.138, @react-three/fiber >=8`; its `postprocessing` core (6.39.x) requires `three >= 0.157 < 0.178` → `three@0.169.0` sits safely inside. `@types/three@0.169.0` matches the runtime three exactly.
- **Client-only.** No edits to `server/`, `worker/`, or any wire protocol. Board3D reads only the existing `PublicGameState` (`state.players[*].position`, `.fastTrackPosition`, `.phase`, `.color`, `state.diceValues`, `state.hasRolled`, `state.currentPlayerId`).
- **Reuse tile-type data** from `client/src/lib/boardLayout.ts` (`ratTileType`, `tileLabel`, `RatTileType`) and `client/src/lib/types.ts` (`PublicPlayer`, `FastTrackTile`, `Dream`). Do not duplicate tile classification.
- **Do NOT delete** `RatRaceBoard.tsx`, `FastTrackBoard.tsx`, or `Dice3D.tsx` — they remain the CSS fallback path and must stay in the tree.
- **Fallback required:** if WebGL is unavailable OR `render3d === false`, render the existing CSS boards. The Fiber `<Canvas fallback>` prop is the in-Canvas safety net; the WebGL feature-detect in `Game.tsx` is the primary gate.
- **Quality + motion:** `render3d: boolean`, `quality: 'high' | 'low'` in the Zustand store, persisted to `localStorage`. `low` disables post-FX + shadows. Respect `prefers-reduced-motion` (snap tokens/dice instead of animating). Lighter dpr/effects on mobile (narrow viewport).
- **DRY / YAGNI / frequent commits.** Commit after each task. Commit messages in English, imperative, prefix `feat`/`fix`/`chore`/`test` (matches repo, e.g. `Rebuild Cashflow on modern stack…`, `Match Worker name…`).
- Run all `npm` commands from `cashflow-modern/client/` unless stated otherwise.

---

### Task 1: Install 3D dependencies + Vitest, wire client test config

**Files:**
- Modify: `cashflow-modern/client/package.json` (add deps + devDeps + `test` scripts)
- Create: `cashflow-modern/client/vitest.config.ts`

**Interfaces:**
- Produces: a runnable `npm test` (Vitest) in the client package; the four 3D libraries importable from client source.
- Consumes: nothing.

- [ ] **Step 1: Add dependencies to `client/package.json`.** Edit the `dependencies` and `devDependencies` blocks and `scripts` so the file reads exactly:
```json
{
  "name": "cashflow-modern-client",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@react-three/drei": "^9.122.0",
    "@react-three/fiber": "^8.18.0",
    "@react-three/postprocessing": "^2.19.1",
    "cashflow-modern": "file:..",
    "i18next": "^23.11.2",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-i18next": "^13.5.0",
    "three": "^0.169.0",
    "zustand": "^4.5.2"
  },
  "devDependencies": {
    "@types/react": "^18.2.79",
    "@types/react-dom": "^18.2.25",
    "@types/three": "^0.169.0",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.4.5",
    "vite": "^4.5.3",
    "vitest": "^1.6.0"
  }
}
```

> Cross-plan note: the rules-fidelity plan (`2026-06-18-cashflow-rules-fidelity.md`, Task 19) also edits `client/package.json` to drop the now-unused `socket.io-client` dependency. This block already omits it, so the two plans converge in either order. If `socket.io-client` is still present when you run this task, leaving it omitted here (as shown) is correct.

- [ ] **Step 2: Create `client/vitest.config.ts`** (mirrors the server's "vitest run" approach; pure-Node environment, no jsdom needed because we only test pure math):
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
```

- [ ] **Step 3: Install.** Run:
```bash
cd /Users/palm/Desktop/projects/cashflow-beyond/cashflow-modern/client && npm install
```
Expected: install succeeds; no peer-dependency ERESOLVE errors (Fiber v8 + drei v9 + postprocessing v2 all resolve against React 18.2 / three 0.169). If npm prints peer warnings only (not errors), that is acceptable.

- [ ] **Step 4: Sanity-check Vitest is wired.** Run:
```bash
cd /Users/palm/Desktop/projects/cashflow-beyond/cashflow-modern/client && npm test
```
Expected: Vitest runs and reports `No test files found, exiting with code 0` (or similar) — confirms the runner is installed and configured. (Tests arrive in Task 2.)

- [ ] **Step 5: Commit.**
```bash
cd /Users/palm/Desktop/projects/cashflow-beyond/cashflow-modern && git add client/package.json client/package-lock.json client/vitest.config.ts && git commit -m "chore: add three/fiber/drei/postprocessing + vitest to client"
```

---

### Task 2: Pure ring-geometry + tile-color module (TDD)

**Files:**
- Create: `cashflow-modern/client/src/lib/boardLayout3d.ts`
- Test: `cashflow-modern/client/src/lib/boardLayout3d.test.ts`

**Interfaces (these signatures are CONSUMED verbatim by Tasks 5–9 — keep names identical):**
- Produces:
  - `interface RingPoint { x: number; z: number; angle: number }`
  - `function ringPositions(count: number, radius: number): RingPoint[]` — `count` points evenly spaced on a circle in the XZ plane (Y is up in three.js). Point `i` (0-based) is at `angle = -Math.PI / 2 + i * (2 * Math.PI / count)` (start at the top/north, matching the CSS board's `-90°` start), `x = radius * Math.cos(angle)`, `z = radius * Math.sin(angle)`. The returned `x`,`z` are the **tile centers**.
  - `const RAT_TILE_COLOR: Record<RatTileType, string>` — hex color per Rat Race tile type, derived from the existing CSS border/background palette in `styles/index.css`.
  - `const FT_TILE_COLOR: Record<FastTrackTile['kind'], string>` — hex color per Fast Track tile kind.
  - `function ratTileColor(position: number): string` — `RAT_TILE_COLOR[ratTileType(position)]`.
  - `function tokenSlotOffset(index: number, total: number, spread: number): { dx: number; dz: number }` — fans `total` tokens that share a tile so they don't overlap; pure, deterministic. For `total <= 1` returns `{dx:0,dz:0}`. Otherwise spreads them on a small arc: `a = (index - (total - 1) / 2) * spread`, `dx = a`, `dz = 0`.
- Consumes: `ratTileType`, `RatTileType` from `./boardLayout`; `FastTrackTile` from `./types`.

- [ ] **Step 1: Write the failing test `client/src/lib/boardLayout3d.test.ts`:**
```ts
import { describe, it, expect } from 'vitest';
import {
  ringPositions,
  ratTileColor,
  RAT_TILE_COLOR,
  FT_TILE_COLOR,
  tokenSlotOffset
} from './boardLayout3d';

describe('ringPositions', () => {
  it('returns one point per count', () => {
    expect(ringPositions(24, 10)).toHaveLength(24);
    expect(ringPositions(32, 12)).toHaveLength(32);
  });

  it('starts at the top (north) of the circle', () => {
    const p = ringPositions(4, 10)[0];
    // angle -90deg -> cos=0, sin=-1  => x≈0, z≈-10
    expect(p.x).toBeCloseTo(0, 5);
    expect(p.z).toBeCloseTo(-10, 5);
    expect(p.angle).toBeCloseTo(-Math.PI / 2, 5);
  });

  it('spaces points evenly around the full circle', () => {
    const pts = ringPositions(4, 5);
    // every point sits on the circle of given radius
    for (const pt of pts) {
      expect(Math.hypot(pt.x, pt.z)).toBeCloseTo(5, 5);
    }
    // quarter index lands at east (x≈5, z≈0)
    expect(pts[1].x).toBeCloseTo(5, 5);
    expect(pts[1].z).toBeCloseTo(0, 5);
  });
});

describe('tile colors', () => {
  it('maps every Rat Race tile type to a hex color', () => {
    for (const c of Object.values(RAT_TILE_COLOR)) {
      expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('maps every Fast Track kind to a hex color', () => {
    for (const c of Object.values(FT_TILE_COLOR)) {
      expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('ratTileColor uses the tile type at a position', () => {
    // position 6 is a payday tile (see boardLayout.ts)
    expect(ratTileColor(6)).toBe(RAT_TILE_COLOR.payday);
    // position 1 is a deal tile
    expect(ratTileColor(1)).toBe(RAT_TILE_COLOR.deal);
  });
});

describe('tokenSlotOffset', () => {
  it('is centered for a single token', () => {
    expect(tokenSlotOffset(0, 1, 0.4)).toEqual({ dx: 0, dz: 0 });
  });

  it('fans multiple tokens symmetrically around zero', () => {
    const a = tokenSlotOffset(0, 2, 0.4);
    const b = tokenSlotOffset(1, 2, 0.4);
    expect(a.dx).toBeCloseTo(-0.2, 5);
    expect(b.dx).toBeCloseTo(0.2, 5);
    expect(a.dx + b.dx).toBeCloseTo(0, 5);
  });
});
```

- [ ] **Step 2: Run the test — expect RED.**
```bash
cd /Users/palm/Desktop/projects/cashflow-beyond/cashflow-modern/client && npm test
```
Expected: failure — `Failed to resolve import "./boardLayout3d"` (module does not exist yet).

- [ ] **Step 3: Implement `client/src/lib/boardLayout3d.ts`:**
```ts
// Pure math for the 3D board: ring coordinates (XZ plane, Y up) + tile colors.
// Colors mirror the CSS palette in styles/index.css so 3D matches the DOM fallback.
import { ratTileType, type RatTileType } from './boardLayout';
import type { FastTrackTile } from './types';

export interface RingPoint {
  x: number;
  z: number;
  angle: number;
}

/** `count` tile centers evenly spaced on a circle of `radius`, starting at the top (north). */
export function ringPositions(count: number, radius: number): RingPoint[] {
  const step = (2 * Math.PI) / count;
  const start = -Math.PI / 2; // top of the circle, matches the CSS board's -90deg start
  const points: RingPoint[] = [];
  for (let i = 0; i < count; i++) {
    const angle = start + i * step;
    points.push({ x: radius * Math.cos(angle), z: radius * Math.sin(angle), angle });
  }
  return points;
}

export const RAT_TILE_COLOR: Record<RatTileType, string> = {
  deal: '#2f6ff0',
  payday: '#2ecc71',
  market: '#8e44ad',
  doodad: '#c0653b',
  charity: '#d63384',
  downsized: '#e74c3c',
  baby: '#16a3b8',
  start: '#f1c40f'
};

export const FT_TILE_COLOR: Record<FastTrackTile['kind'], string> = {
  cashflowDay: '#f1c40f',
  investment: '#2f6ff0',
  dream: '#caa33a',
  charity: '#d63384',
  loss: '#e74c3c',
  doodad: '#c0653b'
};

export function ratTileColor(position: number): string {
  return RAT_TILE_COLOR[ratTileType(position)];
}

/** Fan tokens that share a tile along a small arc so they don't overlap. */
export function tokenSlotOffset(
  index: number,
  total: number,
  spread: number
): { dx: number; dz: number } {
  if (total <= 1) return { dx: 0, dz: 0 };
  const a = (index - (total - 1) / 2) * spread;
  return { dx: a, dz: 0 };
}
```

- [ ] **Step 4: Run the test — expect GREEN.**
```bash
cd /Users/palm/Desktop/projects/cashflow-beyond/cashflow-modern/client && npm test
```
Expected: all tests in `boardLayout3d.test.ts` pass.

- [ ] **Step 5: Typecheck.**
```bash
cd /Users/palm/Desktop/projects/cashflow-beyond/cashflow-modern/client && npm run typecheck
```
Expected: clean (test files are excluded by the app `tsconfig` `include`, and the new module is type-correct).

- [ ] **Step 6: Commit.**
```bash
cd /Users/palm/Desktop/projects/cashflow-beyond/cashflow-modern && git add client/src/lib/boardLayout3d.ts client/src/lib/boardLayout3d.test.ts && git commit -m "test: pure 3D ring coordinates + tile colors (boardLayout3d)"
```

---

### Task 3: Store flags for render mode + quality (persisted)

**Files:**
- Modify: `cashflow-modern/client/src/store/gameStore.ts`
- Create: `cashflow-modern/client/src/lib/webgl.ts`

**Interfaces:**
- Produces:
  - `function hasWebGL(): boolean` (in `webgl.ts`) — feature-detects a WebGL/WebGL2 context.
  - Store additions: `render3d: boolean`, `quality: 'high' | 'low'`, `setRender3d(v: boolean): void`, `setQuality(q: 'high' | 'low'): void`. Both flags initialized from `localStorage`, written back on change.
- Consumes: existing `useGame` store.

- [ ] **Step 1: Create `client/src/lib/webgl.ts`:**
```ts
/** True if the browser can create a WebGL context (gates the 3D board). */
export function hasWebGL(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    );
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Add the flags to `client/src/store/gameStore.ts`.** Add `Quality` type, extend `Store`, read initial values from `localStorage`, and write them back in the setters. Replace the import block + `Store` interface + `create` call:
```ts
import { create } from 'zustand';
import { onState, onId, fetchBoard, resume, savedRoom } from '../lib/socket';
import type { GameState, Dream, FastTrackTile } from '../lib/types';

type Screen = 'home' | 'lobby' | 'game';
type Quality = 'high' | 'low';

const readRender3d = (): boolean => {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem('cf_render3d') !== '0'; // default ON
};
const readQuality = (): Quality => {
  if (typeof localStorage === 'undefined') return 'high';
  return localStorage.getItem('cf_quality') === 'low' ? 'low' : 'high';
};

interface Store {
  screen: Screen;
  myId: string;
  roomId: string | null;
  state: GameState | null;
  dreams: Dream[];
  fastTrack: FastTrackTile[];
  error: string | null;
  resuming: boolean;
  render3d: boolean;
  quality: Quality;
  setScreen: (s: Screen) => void;
  setRoom: (id: string) => void;
  setError: (e: string | null) => void;
  setRender3d: (v: boolean) => void;
  setQuality: (q: Quality) => void;
  reset: () => void;
}

export const useGame = create<Store>((set) => ({
  screen: 'home',
  myId: '',
  roomId: null,
  state: null,
  dreams: [],
  fastTrack: [],
  error: null,
  resuming: !!savedRoom(),
  render3d: readRender3d(),
  quality: readQuality(),
  setScreen: (screen) => set({ screen }),
  setRoom: (roomId) => set({ roomId }),
  setError: (error) => set({ error }),
  setRender3d: (render3d) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('cf_render3d', render3d ? '1' : '0');
    set({ render3d });
  },
  setQuality: (quality) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('cf_quality', quality);
    set({ quality });
  },
  reset: () => set({ screen: 'home', roomId: null, state: null, error: null })
}));

onId((id) => useGame.setState({ myId: id }));

onState((state: GameState) => {
  let next: Screen = 'lobby';
  if (state.status !== 'lobby') next = 'game';
  useGame.setState({ state, screen: next, roomId: state.roomId, resuming: false });
});

fetchBoard()
  .then(({ dreams, fastTrack }) => useGame.setState({ dreams, fastTrack }))
  .catch(() => {});

resume()
  .then((ack) => {
    if (!ack || !ack.ok) useGame.setState({ resuming: false });
  })
  .catch(() => useGame.setState({ resuming: false }));

export const myPlayer = (s: Store) => s.state?.players.find((p) => p.id === s.myId) ?? null;
```

- [ ] **Step 3: Typecheck.**
```bash
cd /Users/palm/Desktop/projects/cashflow-beyond/cashflow-modern/client && npm run typecheck
```
Expected: clean.

- [ ] **Step 4: Commit.**
```bash
cd /Users/palm/Desktop/projects/cashflow-beyond/cashflow-modern && git add client/src/store/gameStore.ts client/src/lib/webgl.ts && git commit -m "feat: render3d + quality store flags (persisted) and WebGL detect"
```

---

### Task 4: Lighting component

**Files:**
- Create: `cashflow-modern/client/src/components/three/Lighting.tsx`

**Interfaces:**
- Produces: `function Lighting(props: { quality: 'high' | 'low' }): JSX.Element` — key/fill/ambient lights + drei `<Environment>`; shadows only on `high`.
- Consumes: `@react-three/drei` `Environment`. (`quality` value type matches Task 3.)

- [ ] **Step 1: Create `client/src/components/three/Lighting.tsx`:**
```tsx
import { Environment } from '@react-three/drei';

export interface LightingProps {
  quality: 'high' | 'low';
}

/** Key / fill / ambient + a soft preset environment. Shadows only on high quality. */
export default function Lighting({ quality }: LightingProps) {
  const high = quality === 'high';
  return (
    <>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#8aa0ff', '#0b0f1d', 0.5]} />
      <directionalLight
        position={[6, 12, 6]}
        intensity={high ? 1.4 : 1.1}
        castShadow={high}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
      />
      <directionalLight position={[-8, 5, -6]} intensity={0.45} color="#5b6bff" />
      <Environment preset="city" />
    </>
  );
}
```
Note: `Environment preset="city"` loads a small bundled HDR from drei's asset CDN; it works offline-degraded (falls back to no env map) and only affects reflections/ambient, not correctness.

- [ ] **Step 2: Typecheck.**
```bash
cd /Users/palm/Desktop/projects/cashflow-beyond/cashflow-modern/client && npm run typecheck
```
Expected: clean.

- [ ] **Step 3: Commit.**
```bash
cd /Users/palm/Desktop/projects/cashflow-beyond/cashflow-modern && git add client/src/components/three/Lighting.tsx && git commit -m "feat: 3D scene lighting + environment"
```

---

### Task 5: Effects (post-processing) component

**Files:**
- Create: `cashflow-modern/client/src/components/three/Effects.tsx`

**Interfaces:**
- Produces: `function Effects(props: { enabled: boolean }): JSX.Element | null` — returns `null` when `enabled === false` (low quality / reduced motion); otherwise an `<EffectComposer>` with `Bloom`, `Vignette`, `ToneMapping`.
- Consumes: `@react-three/postprocessing` (`EffectComposer`, `Bloom`, `Vignette`, `ToneMapping` — all confirmed exported at v2.19.1).

- [ ] **Step 1: Create `client/src/components/three/Effects.tsx`** (stable verified subset — Bloom + Vignette + ToneMapping; N8AO is a separate optional step in Task 12):
```tsx
import { EffectComposer, Bloom, Vignette, ToneMapping } from '@react-three/postprocessing';

export interface EffectsProps {
  enabled: boolean;
}

/** Post-FX pass. Bloom makes the active-tile glow pop; Vignette + tone mapping add depth.
 *  Returns null on low quality / reduced motion so the scene renders raw. */
export default function Effects({ enabled }: EffectsProps) {
  if (!enabled) return null;
  return (
    <EffectComposer multisampling={4}>
      <Bloom
        intensity={0.9}
        luminanceThreshold={0.55}
        luminanceSmoothing={0.2}
        mipmapBlur
      />
      <Vignette eskil={false} offset={0.25} darkness={0.7} />
      <ToneMapping />
    </EffectComposer>
  );
}
```
Note: `Bloom` and `Vignette` are `wrapEffect`-wrapped at v2.19.1, so their props are the underlying `postprocessing` effect options (`intensity`/`luminanceThreshold`/`luminanceSmoothing`/`mipmapBlur` for Bloom; `eskil`/`offset`/`darkness` for Vignette). `ToneMapping` with no props applies the default (ACES filmic) tone mapping pass. **Double-tone-mapping caveat:** Task 10's `<Canvas gl={{ toneMapping: ACESFilmicToneMapping }}>` also tone-maps (needed for the LOW path, which has no composer). During manual verify (Task 11 Step 8), compare HIGH vs LOW brightness — if HIGH looks noticeably darker/washed, remove exactly ONE: either drop `<ToneMapping/>` here, or set the Canvas `gl.toneMapping` to `THREE.NoToneMapping`. Verify before deciding; do not touch the version pins.

- [ ] **Step 2: Typecheck.**
```bash
cd /Users/palm/Desktop/projects/cashflow-beyond/cashflow-modern/client && npm run typecheck
```
Expected: clean. (If `@types/three`/postprocessing prop typings reject `mipmapBlur` or `luminanceSmoothing`, drop only the offending prop — Bloom still works with `intensity` + `luminanceThreshold` alone. Do NOT change the version pins.)

- [ ] **Step 3: Commit.**
```bash
cd /Users/palm/Desktop/projects/cashflow-beyond/cashflow-modern && git add client/src/components/three/Effects.tsx && git commit -m "feat: post-processing pass (bloom + vignette + tonemapping)"
```

---

### Task 6: Tile3D component

**Files:**
- Create: `cashflow-modern/client/src/components/three/Tile3D.tsx`

**Interfaces:**
- Produces: `function Tile3D(props: Tile3DProps): JSX.Element` where
```ts
interface Tile3DProps {
  position: [number, number, number]; // tile center in world space (XZ plane, y = base)
  rotationY: number;                   // face the tile toward the ring center
  color: string;                       // hex from boardLayout3d
  icon: string;                        // emoji
  label: string;                       // localized short label
  active: boolean;                     // raise + emissive glow when a token is on it
  quality: 'high' | 'low';
}
```
- Consumes: drei `RoundedBox` (extruded rounded box, confirmed export), drei `Html` (for emoji + i18n label so Thai renders without an SDF font). `active` drives `emissiveIntensity` (Bloom in Task 5 picks up the glow).

- [ ] **Step 1: Create `client/src/components/three/Tile3D.tsx`:**
```tsx
import { RoundedBox, Html } from '@react-three/drei';

export interface Tile3DProps {
  position: [number, number, number];
  rotationY: number;
  color: string;
  icon: string;
  label: string;
  active: boolean;
  quality: 'high' | 'low';
}

const TILE_W = 1.6;
const TILE_H = 0.35;
const TILE_D = 1.15;

export default function Tile3D({
  position,
  rotationY,
  color,
  icon,
  label,
  active,
  quality
}: Tile3DProps) {
  const [x, y, z] = position;
  const lift = active ? 0.35 : 0;
  return (
    <group position={[x, y + lift, z]} rotation={[0, rotationY, 0]}>
      <RoundedBox
        args={[TILE_W, TILE_H, TILE_D]}
        radius={0.08}
        smoothness={4}
        castShadow={quality === 'high'}
        receiveShadow={quality === 'high'}
      >
        <meshStandardMaterial
          color={color}
          roughness={0.55}
          metalness={0.15}
          emissive={active ? color : '#000000'}
          emissiveIntensity={active ? 0.9 : 0}
        />
      </RoundedBox>
      <Html
        position={[0, TILE_H / 2 + 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        transform
        occlude
        distanceFactor={6}
        style={{ pointerEvents: 'none', textAlign: 'center', userSelect: 'none' }}
      >
        <div style={{ fontSize: 22, lineHeight: 1 }}>{icon}</div>
        <div style={{ fontSize: 9, color: '#e8ecf8', fontWeight: 600, marginTop: 2 }}>
          {label}
        </div>
      </Html>
    </group>
  );
}
```
Note: drei `<Html transform occlude>` projects a DOM node into the scene so existing Kanit/Thai fonts render correctly (avoids shipping an SDF font for `<Text>`). `pointerEvents:'none'` keeps tiles non-interactive (interaction lives in the DOM HUD per spec §11).

- [ ] **Step 2: Typecheck.**
```bash
cd /Users/palm/Desktop/projects/cashflow-beyond/cashflow-modern/client && npm run typecheck
```
Expected: clean.

- [ ] **Step 3: Commit.**
```bash
cd /Users/palm/Desktop/projects/cashflow-beyond/cashflow-modern && git add client/src/components/three/Tile3D.tsx && git commit -m "feat: Tile3D rounded-box tile with emissive active state"
```

---

### Task 7: Token3D component (animated piece)

**Files:**
- Create: `cashflow-modern/client/src/components/three/Token3D.tsx`

**Interfaces:**
- Produces: `function Token3D(props: Token3DProps): JSX.Element` where
```ts
interface Token3DProps {
  target: [number, number, number]; // world position the token should move to
  color: string;                     // player.color
  current: boolean;                  // the player whose turn it is (extra glow)
  reducedMotion: boolean;            // snap instead of animate
}
```
- Consumes: `@react-three/fiber` `useFrame` (confirmed) for lerp-toward-target + a sine hop; `THREE.Group` ref. When `reducedMotion`, sets position directly (no hop).

- [ ] **Step 1: Create `client/src/components/three/Token3D.tsx`:**
```tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface Token3DProps {
  target: [number, number, number];
  color: string;
  current: boolean;
  reducedMotion: boolean;
}

const BASE_Y = 0.45; // sits on top of the tiles

export default function Token3D({ target, color, current, reducedMotion }: Token3DProps) {
  const ref = useRef<THREE.Group>(null!);
  const t = useRef(0);
  const inited = useRef(false);

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    const [tx, , tz] = target;
    // First frame (or reduced motion): snap to the target, no animation.
    if (!inited.current || reducedMotion) {
      g.position.set(tx, BASE_Y, tz);
      inited.current = true;
      return;
    }
    const dist = Math.hypot(tx - g.position.x, tz - g.position.z);
    // lerp horizontally toward the target
    g.position.x = THREE.MathUtils.lerp(g.position.x, tx, Math.min(1, delta * 6));
    g.position.z = THREE.MathUtils.lerp(g.position.z, tz, Math.min(1, delta * 6));
    // hop while travelling, settle to BASE_Y when arrived
    if (dist > 0.05) {
      t.current += delta * 8;
      g.position.y = BASE_Y + Math.abs(Math.sin(t.current)) * 0.4;
    } else {
      t.current = 0;
      g.position.y = THREE.MathUtils.lerp(g.position.y, BASE_Y, Math.min(1, delta * 8));
    }
  });

  return (
    <group ref={ref}>
      <mesh castShadow position={[0, 0, 0]}>
        <cylinderGeometry args={[0.22, 0.3, 0.18, 24]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh castShadow position={[0, 0.32, 0]}>
        <sphereGeometry args={[0.26, 24, 24]} />
        <meshStandardMaterial
          color={color}
          roughness={0.3}
          metalness={0.35}
          emissive={current ? color : '#000000'}
          emissiveIntensity={current ? 0.6 : 0}
        />
      </mesh>
    </group>
  );
}
```
Note: a pawn = cylinder base + sphere head; the current player's head gets emissive so Bloom highlights whose turn it is. The group has **no declarative `position` prop** — position is driven entirely in `useFrame` (snapped on the first frame via the `inited` ref, then lerped). Binding `position={target}` declaratively would fight the per-frame mutation and re-snap the token on every store update (every server broadcast), killing the hop animation.

- [ ] **Step 2: Typecheck.**
```bash
cd /Users/palm/Desktop/projects/cashflow-beyond/cashflow-modern/client && npm run typecheck
```
Expected: clean.

- [ ] **Step 3: Commit.**
```bash
cd /Users/palm/Desktop/projects/cashflow-beyond/cashflow-modern && git add client/src/components/three/Token3D.tsx && git commit -m "feat: Token3D animated player piece with hop + active glow"
```

---

### Task 8: Dice3DGL component (3D tumbling dice)

**Files:**
- Create: `cashflow-modern/client/src/components/three/Dice3DGL.tsx`

**Interfaces:**
- Produces: `function Dice3DGL(props: Dice3DGLProps): JSX.Element` where
```ts
interface Dice3DGLProps {
  position: [number, number, number];
  value: number | null;   // 1..6 from state.diceValues; null = not yet rolled
  trigger: string;         // changes when a new roll happens (re-tumble)
  reducedMotion: boolean;
}
```
- Consumes: `useFrame` (animate rotation toward the resting orientation for `value`); the resting-face Euler map mirrors the existing `Dice3D.tsx` `REST` table semantics (front=1, back=6, right=3, left=4, top=2, bottom=5; opposites sum to 7) so a known orientation shows the right pip face.

- [ ] **Step 1: Create `client/src/components/three/Dice3DGL.tsx`:**
```tsx
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface Dice3DGLProps {
  position: [number, number, number];
  value: number | null;
  trigger: string;
  reducedMotion: boolean;
}

// Euler (radians) that brings each value's face up/forward.
// Mirrors Dice3D.tsx faces: front=1, back=6, right=3, left=4, top=2, bottom=5.
const REST: Record<number, [number, number, number]> = {
  1: [0, 0, 0],
  2: [-Math.PI / 2, 0, 0],
  3: [0, -Math.PI / 2, 0],
  4: [0, Math.PI / 2, 0],
  5: [Math.PI / 2, 0, 0],
  6: [0, Math.PI, 0]
};

// Pip layout (3x3, indices 0..8) for each face value.
const PIP: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

function Pips({ value }: { value: number }) {
  const cells = PIP[value] ?? [];
  return (
    <>
      {cells.map((c) => {
        const col = c % 3;
        const row = Math.floor(c / 3);
        const px = (col - 1) * 0.22;
        const py = (1 - row) * 0.22;
        return (
          <mesh key={c} position={[px, py, 0.301]}>
            <circleGeometry args={[0.05, 16]} />
            <meshStandardMaterial color="#111111" />
          </mesh>
        );
      })}
    </>
  );
}

export default function Dice3DGL({ position, value, trigger, reducedMotion }: Dice3DGLProps) {
  const ref = useRef<THREE.Group>(null!);
  const spin = useRef(0); // remaining extra spins (seconds budget)

  useEffect(() => {
    if (value == null) return;
    spin.current = reducedMotion ? 0 : 0.9; // ~0.9s of tumble before settling
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    const v = value ?? 1;
    const [rx, ry, rz] = REST[v];
    if (spin.current > 0) {
      spin.current -= delta;
      g.rotation.x += delta * 12;
      g.rotation.y += delta * 9;
      g.rotation.z += delta * 7;
    } else {
      g.rotation.x = THREE.MathUtils.lerp(g.rotation.x % (Math.PI * 2), rx, Math.min(1, delta * 10));
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y % (Math.PI * 2), ry, Math.min(1, delta * 10));
      g.rotation.z = THREE.MathUtils.lerp(g.rotation.z % (Math.PI * 2), rz, Math.min(1, delta * 10));
    }
  });

  return (
    <group ref={ref} position={position}>
      <mesh castShadow>
        <boxGeometry args={[0.6, 0.6, 0.6]} />
        <meshStandardMaterial color="#f4f6ff" roughness={0.35} metalness={0.1} />
      </mesh>
      {/* show the front face's pips; on settle this face is value v */}
      {value != null && <Pips value={value} />}
    </group>
  );
}
```
Note: this is a deliberately simple approximation — a single pip plane on the front face that always shows the rolled `value`, with a tumble before settling to the `REST` orientation. It is faithful to the requirement "tumble then settle on the rolled face from `diceValues`" without a full 6-face textured cube.

- [ ] **Step 2: Typecheck.**
```bash
cd /Users/palm/Desktop/projects/cashflow-beyond/cashflow-modern/client && npm run typecheck
```
Expected: clean.

- [ ] **Step 3: Commit.**
```bash
cd /Users/palm/Desktop/projects/cashflow-beyond/cashflow-modern && git add client/src/components/three/Dice3DGL.tsx && git commit -m "feat: Dice3DGL tumbling 3D dice that settle to the rolled value"
```

---

### Task 9: RatRaceRing3D + FastTrackRing3D (tile + token layout)

**Files:**
- Create: `cashflow-modern/client/src/components/three/RatRaceRing3D.tsx`
- Create: `cashflow-modern/client/src/components/three/FastTrackRing3D.tsx`

**Interfaces:**
- Produces:
```ts
// RatRaceRing3D
interface RatRaceRing3DProps {
  players: PublicPlayer[];
  currentId: string | null;
  quality: 'high' | 'low';
  reducedMotion: boolean;
}
// FastTrackRing3D
interface FastTrackRing3DProps {
  players: PublicPlayer[];
  currentId: string | null;
  tiles: FastTrackTile[];
  dreams: Dream[];
  quality: 'high' | 'low';
  reducedMotion: boolean;
}
```
- Consumes: `ringPositions`, `ratTileColor`, `RAT_TILE_COLOR`, `FT_TILE_COLOR`, `tokenSlotOffset` (Task 2); `Tile3D` (Task 6); `Token3D` (Task 7); `ratTileType`, `tileLabel` from `boardLayout`; `PublicPlayer`, `FastTrackTile`, `Dream` from `types`. Constants: `RAT_RADIUS = 6.2`, `FT_RADIUS = 7.6`.

- [ ] **Step 1: Create `client/src/components/three/RatRaceRing3D.tsx`:**
```tsx
import { useTranslation } from 'react-i18next';
import { ratTileType, tileLabel } from '../../lib/boardLayout';
import { ringPositions, ratTileColor, tokenSlotOffset } from '../../lib/boardLayout3d';
import type { PublicPlayer } from '../../lib/types';
import Tile3D from './Tile3D';
import Token3D from './Token3D';

export interface RatRaceRing3DProps {
  players: PublicPlayer[];
  currentId: string | null;
  quality: 'high' | 'low';
  reducedMotion: boolean;
}

const TILE_COUNT = 24;
const RAT_RADIUS = 6.2;

export default function RatRaceRing3D({
  players,
  currentId,
  quality,
  reducedMotion
}: RatRaceRing3DProps) {
  const { i18n } = useTranslation();
  const lng = i18n.language?.startsWith('th') ? 'th' : 'en';
  const ring = ringPositions(TILE_COUNT, RAT_RADIUS);

  const ratPlayers = players.filter((p) => p.phase === 'ratRace' && !p.isBankrupt);
  const tokensByPos: Record<number, PublicPlayer[]> = {};
  ratPlayers.forEach((p) => {
    const pos = p.position === 0 ? 24 : p.position;
    (tokensByPos[pos] ||= []).push(p);
  });

  return (
    <group>
      {/* board disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow={quality === 'high'}>
        <circleGeometry args={[RAT_RADIUS + 1.4, 64]} />
        <meshStandardMaterial color="#15203c" roughness={0.9} metalness={0.05} />
      </mesh>

      {ring.map((pt, idx) => {
        const position = idx + 1; // 1..24
        const type = ratTileType(position);
        const label = tileLabel[type];
        const tokens = tokensByPos[position] || [];
        const isActiveTile = tokens.some((tk) => tk.id === currentId);
        // face the tile inward (toward center): rotate by the point's angle
        const rotationY = -pt.angle + Math.PI / 2;
        return (
          <Tile3D
            key={idx}
            position={[pt.x, 0.18, pt.z]}
            rotationY={rotationY}
            color={ratTileColor(position)}
            icon={label.icon}
            label={label[lng]}
            active={isActiveTile}
            quality={quality}
          />
        );
      })}

      {ring.map((pt, idx) => {
        const position = idx + 1;
        const tokens = tokensByPos[position] || [];
        return tokens.map((p, i) => {
          const { dx, dz } = tokenSlotOffset(i, tokens.length, 0.45);
          return (
            <Token3D
              key={p.id}
              target={[pt.x + dx, 0.45, pt.z + dz]}
              color={p.color}
              current={p.id === currentId}
              reducedMotion={reducedMotion}
            />
          );
        });
      })}
    </group>
  );
}
```

- [ ] **Step 2: Create `client/src/components/three/FastTrackRing3D.tsx`:**
```tsx
import { useTranslation } from 'react-i18next';
import { ringPositions, FT_TILE_COLOR, tokenSlotOffset } from '../../lib/boardLayout3d';
import type { PublicPlayer, FastTrackTile, Dream } from '../../lib/types';
import Tile3D from './Tile3D';
import Token3D from './Token3D';

export interface FastTrackRing3DProps {
  players: PublicPlayer[];
  currentId: string | null;
  tiles: FastTrackTile[];
  dreams: Dream[];
  quality: 'high' | 'low';
  reducedMotion: boolean;
}

const FT_RADIUS = 7.6;

const KIND_ICON: Record<FastTrackTile['kind'], string> = {
  cashflowDay: '💰',
  investment: '🏢',
  dream: '⭐',
  charity: '❤️',
  loss: '⚠️',
  doodad: '🛍️'
};

export default function FastTrackRing3D({
  players,
  currentId,
  tiles,
  dreams,
  quality,
  reducedMotion
}: FastTrackRing3DProps) {
  const { i18n } = useTranslation();
  const lng = i18n.language?.startsWith('th') ? 'th' : 'en';
  const ring = ringPositions(tiles.length || 32, FT_RADIUS);

  const ftPlayers = players.filter((p) => p.phase === 'fastTrack' && !p.isBankrupt);
  const tokensByCell: Record<number, PublicPlayer[]> = {};
  ftPlayers.forEach((p) => {
    (tokensByCell[p.fastTrackPosition] ||= []).push(p);
  });

  const dreamName = (id?: string) => {
    const d = dreams.find((x) => x.id === id);
    return d ? (lng === 'th' ? d.nameTh : d.name) : '⭐';
  };

  const tileLabelFor = (tile: FastTrackTile): string => {
    switch (tile.kind) {
      case 'dream':
        return dreamName(tile.id);
      case 'investment':
      case 'loss':
        return (lng === 'th' ? tile.nameTh || tile.name : tile.name) ?? '';
      case 'cashflowDay':
        return lng === 'th' ? 'วันรับเงิน' : 'Cashflow';
      case 'charity':
        return lng === 'th' ? 'การกุศล' : 'Charity';
      default:
        return '';
    }
  };

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow={quality === 'high'}>
        <circleGeometry args={[FT_RADIUS + 1.6, 64]} />
        <meshStandardMaterial color="#181f3a" roughness={0.9} metalness={0.05} />
      </mesh>

      {ring.map((pt, idx) => {
        const tile = tiles[idx];
        if (!tile) return null;
        const tokens = tokensByCell[idx] || [];
        const isActiveTile = tokens.some((tk) => tk.id === currentId);
        const rotationY = -pt.angle + Math.PI / 2;
        return (
          <Tile3D
            key={idx}
            position={[pt.x, 0.18, pt.z]}
            rotationY={rotationY}
            color={FT_TILE_COLOR[tile.kind]}
            icon={KIND_ICON[tile.kind]}
            label={tileLabelFor(tile)}
            active={isActiveTile}
            quality={quality}
          />
        );
      })}

      {ring.map((pt, idx) => {
        const tokens = tokensByCell[idx] || [];
        return tokens.map((p, i) => {
          const { dx, dz } = tokenSlotOffset(i, tokens.length, 0.45);
          return (
            <Token3D
              key={p.id}
              target={[pt.x + dx, 0.45, pt.z + dz]}
              color={p.color}
              current={p.id === currentId}
              reducedMotion={reducedMotion}
            />
          );
        });
      })}
    </group>
  );
}
```

- [ ] **Step 3: Typecheck.**
```bash
cd /Users/palm/Desktop/projects/cashflow-beyond/cashflow-modern/client && npm run typecheck
```
Expected: clean.

- [ ] **Step 4: Commit.**
```bash
cd /Users/palm/Desktop/projects/cashflow-beyond/cashflow-modern && git add client/src/components/three/RatRaceRing3D.tsx client/src/components/three/FastTrackRing3D.tsx && git commit -m "feat: RatRace + FastTrack 3D rings with tiles and tokens"
```

---

### Task 10: Board3D (Canvas entry) + dice placement

**Files:**
- Create: `cashflow-modern/client/src/components/three/Board3D.tsx`

**Interfaces:**
- Produces: `function Board3D(props: Board3DProps): JSX.Element` where
```ts
interface Board3DProps {
  state: GameState;          // from the store
  myId: string;
  dreams: Dream[];
  fastTrack: FastTrackTile[];
  quality: 'high' | 'low';
}
```
- Consumes: `@react-three/fiber` `Canvas`; drei `OrbitControls`, `ContactShadows` (confirmed exports); `Lighting` (Task 4), `Effects` (Task 5), `RatRaceRing3D`/`FastTrackRing3D` (Task 9), `Dice3DGL` (Task 8). Decides Rat Race vs Fast Track by the local player's `phase` (mirrors `Game.tsx`: `me?.phase === 'fastTrack'`). The turn banner is NOT inside the canvas — it stays DOM (Task 11).

- [ ] **Step 1: Create `client/src/components/three/Board3D.tsx`:**
```tsx
import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import Lighting from './Lighting';
import Effects from './Effects';
import RatRaceRing3D from './RatRaceRing3D';
import FastTrackRing3D from './FastTrackRing3D';
import Dice3DGL from './Dice3DGL';
import RatRaceBoard from '../RatRaceBoard';
import type { GameState, Dream, FastTrackTile } from '../../lib/types';

export interface Board3DProps {
  state: GameState;
  myId: string;
  dreams: Dream[];
  fastTrack: FastTrackTile[];
  quality: 'high' | 'low';
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function Board3D({ state, myId, dreams, fastTrack, quality }: Board3DProps) {
  const reducedMotion = useMemo(prefersReducedMotion, []);
  const me = state.players.find((p) => p.id === myId) ?? null;
  const isFastTrack = me?.phase === 'fastTrack';
  const highFx = quality === 'high' && !reducedMotion;

  const diceCount = isFastTrack ? 2 : 1;
  const diceValue = (i: number): number | null =>
    state.hasRolled ? state.diceValues[i] ?? null : null;

  return (
    <div className="board3d-canvas">
      <Canvas
        shadows={quality === 'high'}
        dpr={quality === 'high' ? [1, 2] : [1, 1.25]}
        camera={{ position: [0, 11, 11], fov: 42, near: 0.1, far: 100 }}
        gl={{ antialias: quality === 'high', toneMapping: THREE.ACESFilmicToneMapping }}
        fallback={<RatRaceBoard players={state.players} currentId={state.currentPlayerId} center={null} />}
      >
        <color attach="background" args={['#0b0f1d']} />
        <fog attach="fog" args={['#0b0f1d', 18, 40]} />
        <Lighting quality={quality} />

        {isFastTrack ? (
          <FastTrackRing3D
            players={state.players}
            currentId={state.currentPlayerId}
            tiles={fastTrack}
            dreams={dreams}
            quality={quality}
            reducedMotion={reducedMotion}
          />
        ) : (
          <RatRaceRing3D
            players={state.players}
            currentId={state.currentPlayerId}
            quality={quality}
            reducedMotion={reducedMotion}
          />
        )}

        {/* dice in the middle of the ring */}
        {Array.from({ length: diceCount }).map((_, i) => (
          <Dice3DGL
            key={i}
            position={[(i - (diceCount - 1) / 2) * 1.1, 0.6, 0]}
            value={diceValue(i)}
            trigger={`${state.diceValues.join(',')}|${state.currentPlayerId}|${state.hasRolled}|${i}`}
            reducedMotion={reducedMotion}
          />
        ))}

        {quality === 'high' && (
          <ContactShadows position={[0, 0, 0]} opacity={0.55} scale={22} blur={2.2} far={6} resolution={512} color="#000000" />
        )}

        <OrbitControls
          makeDefault
          enablePan={false}
          minPolarAngle={0.25}
          maxPolarAngle={Math.PI / 2.3}
          minDistance={9}
          maxDistance={20}
          target={[0, 0, 0]}
        />
        <Effects enabled={highFx} />
      </Canvas>
    </div>
  );
}
```
Note: the `<Canvas fallback>` renders the CSS RatRaceBoard if the GL context fails to initialize even after the WebGL gate (defense in depth). `center={null}` is valid — RatRaceBoard's `center` is a `ReactNode`.

- [ ] **Step 2: Typecheck.**
```bash
cd /Users/palm/Desktop/projects/cashflow-beyond/cashflow-modern/client && npm run typecheck
```
Expected: clean.

- [ ] **Step 3: Commit.**
```bash
cd /Users/palm/Desktop/projects/cashflow-beyond/cashflow-modern && git add client/src/components/three/Board3D.tsx && git commit -m "feat: Board3D canvas entry (camera, controls, rings, dice, fx)"
```

---

### Task 11: Integrate into Game.tsx + canvas/overlay CSS + quality toggle UI

**Files:**
- Modify: `cashflow-modern/client/src/components/Game.tsx`
- Modify: `cashflow-modern/client/src/styles/index.css`

**Interfaces:**
- Consumes: `Board3D` (Task 10); `hasWebGL` (Task 3); store `render3d`/`quality`/`setRender3d`/`setQuality` (Task 3). Produces no new exports — wires the existing screen.
- Decision rule: render `<Board3D/>` when `render3d && hasWebGL()`. Otherwise render the existing `<RatRaceBoard/>`/`<FastTrackBoard/>`. The turn banner + dice stay DOM in BOTH paths via the existing `boardCenter` for the CSS path; in the 3D path the dice are in-scene, so `boardCenter` is reduced to just the turn banner overlaid on the canvas.

- [ ] **Step 1: Edit the imports + top of `Game.tsx`.** Replace the import block (lines 1–16) with:
```tsx
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { emit } from '../lib/socket';
import { useGame, myPlayer } from '../store/gameStore';
import RatRaceBoard from './RatRaceBoard';
import FastTrackBoard from './FastTrackBoard';
import Board3D from './three/Board3D';
import StatementPanel from './StatementPanel';
import LoanPanel from './LoanPanel';
import CardModal from './CardModal';
import FastTrackModal from './FastTrackModal';
import DreamPicker from './DreamPicker';
import WinnerOverlay from './WinnerOverlay';
import ProfessionCard from './ProfessionCard';
import Dice3D from './Dice3D';
import { hasWebGL } from '../lib/webgl';
import { money, signed } from '../lib/format';
import { FAST_TRACK_GOAL } from '../lib/constants';
```

- [ ] **Step 2: Add store reads + a `use3d` memo** right after the existing `setError` line (after current line 25). Insert:
```tsx
  const render3d = useGame((s) => s.render3d);
  const quality = useGame((s) => s.quality);
  const setRender3d = useGame((s) => s.setRender3d);
  const setQuality = useGame((s) => s.setQuality);
  const webglOk = useMemo(() => hasWebGL(), []);
  const use3d = render3d && webglOk;
```

- [ ] **Step 3: Split `boardCenter` into a banner + dice, so the 3D path can show only the banner.** Replace the existing `boardCenter` block (current lines 54–71) with:
```tsx
  // --- turn banner (DOM in both 2D and 3D paths) ---
  const turnBanner = (
    <div className="turn-banner" style={{ borderColor: current?.color }}>
      <span className="dot" style={{ background: current?.color }} />
      {isMyTurn ? t('game.yourTurn') : t('game.turnOf', { name: current?.username })}
    </div>
  );

  // --- CSS-board center: banner + CSS dice (used only in the 2D fallback) ---
  const boardCenter = (
    <div className="center-stack">
      {turnBanner}
      <div className="dice-area">
        {Array.from({ length: me?.phase === 'fastTrack' ? 2 : 1 }).map((_, i) => (
          <Dice3D
            key={i}
            value={state.hasRolled ? state.diceValues[i] ?? null : null}
            trigger={`${state.diceValues.join(',')}|${state.currentPlayerId}|${state.hasRolled}|${i}`}
          />
        ))}
      </div>
    </div>
  );
```

- [ ] **Step 4: Swap the board render block.** Replace the existing board conditional (current lines 176–186, the `me?.phase === 'fastTrack' ? <FastTrackBoard.../> : <RatRaceBoard.../>` block) with:
```tsx
        {use3d ? (
          <div className="board3d-wrap">
            <Board3D
              state={state}
              myId={myId}
              dreams={dreams}
              fastTrack={fastTrack}
              quality={quality}
            />
            <div className="board3d-banner">{turnBanner}</div>
          </div>
        ) : me?.phase === 'fastTrack' ? (
          <FastTrackBoard
            players={state.players}
            currentId={state.currentPlayerId}
            tiles={fastTrack}
            dreams={dreams}
            center={boardCenter}
          />
        ) : (
          <RatRaceBoard players={state.players} currentId={state.currentPlayerId} center={boardCenter} />
        )}
```

- [ ] **Step 5: Add a quality/3D toggle to the board topbar.** In the `.board-topbar` div (current lines 169–175), add a control group after the `room-pill` span:
```tsx
          <span className="room-pill">{state.roomId}</span>
          <div className="view-toggles">
            <button
              className={`view-btn ${use3d ? 'active' : ''}`}
              disabled={!webglOk}
              onClick={() => setRender3d(!render3d)}
              title={webglOk ? '' : 'WebGL unavailable'}
            >
              {use3d ? '3D' : '2D'}
            </button>
            {use3d && (
              <button
                className={`view-btn ${quality === 'high' ? 'active' : ''}`}
                onClick={() => setQuality(quality === 'high' ? 'low' : 'high')}
              >
                {quality === 'high' ? t('game.qualityHigh') ?? 'High' : t('game.qualityLow') ?? 'Low'}
              </button>
            )}
          </div>
```

- [ ] **Step 6: Add the canvas/overlay CSS** to the END of `client/src/styles/index.css` (matches existing naming, sits over the board area):
```css
/* ============ 3D board canvas + overlay ============ */
.board3d-wrap {
  position: relative;
  width: 100%;
  max-width: min(74vh, 720px);
  margin: 0 auto;
  aspect-ratio: 1 / 1;
}
.board3d-canvas {
  position: absolute;
  inset: 0;
  border-radius: var(--radius);
  overflow: hidden;
  background: radial-gradient(circle at 50% 38%, #1b2747 0%, #0d1630 70%);
  border: 1px solid var(--line);
  box-shadow: 0 36px 70px rgba(0, 0, 0, 0.6);
}
.board3d-canvas canvas { display: block; }
.board3d-banner {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 4;
  pointer-events: none;
  min-width: 220px;
}
.board3d-banner .turn-banner { background: rgba(20, 28, 56, 0.82); backdrop-filter: blur(4px); }

.view-toggles { display: flex; gap: 6px; }
.view-btn {
  background: var(--panel);
  border: 1px solid var(--line);
  color: var(--muted);
  border-radius: 999px;
  padding: 6px 14px;
  font-family: var(--font);
  font-weight: 600;
  cursor: pointer;
}
.view-btn.active { background: var(--primary); color: #fff; border-color: transparent; }
.view-btn:disabled { opacity: 0.4; cursor: not-allowed; }

@media (max-width: 900px) {
  .board3d-wrap { max-width: 96vw; }
}
```

- [ ] **Step 7: Typecheck + build.**
```bash
cd /Users/palm/Desktop/projects/cashflow-beyond/cashflow-modern/client && npm run typecheck && npm run build
```
Expected: typecheck clean; `vite build` succeeds (the 3D libs bundle without error). If the build warns about chunk size for three, that is acceptable (no failure).

- [ ] **Step 8: MANUAL VERIFY — 3D board renders and animates.** Run the dev server and play a game (open two browser tabs / windows, create + join a room, start with ≥2 players):
```bash
cd /Users/palm/Desktop/projects/cashflow-beyond/cashflow-modern/client && npm run dev
```
Open `http://localhost:5173`. Confirm, observing the real screen:
  1. The 3D Rat Race ring renders (24 tiles in a circle, colored by type), tokens visible, turn banner overlaid at top.
  2. Roll the dice → the 3D dice tumble and settle showing the server's `diceValues`; the moving token hops along the ring to its new `position`.
  3. The active tile glows (Bloom) and the current player's token head glows.
  4. The DOM HUD (StatementPanel, LoanPanel, CardModal, logs, turn controls) all still work and sit over/around the canvas.
  5. Toggle High↔Low → post-FX + shadows turn off on Low (frame rate improves); reload → the toggle state persists.
  6. Toggle 3D↔2D → falls back to the CSS `RatRaceBoard` with the CSS dice; reload persists.
  7. Drive a player into Fast Track (or temporarily set a player's `phase` to `fastTrack` in a debug build) → the Fast Track ring renders. (If hard to reach in play, verify by code-reading the `isFastTrack` branch + at least confirm the Rat Race path; note this in the commit.)

  Capture a screenshot of the 3D board.

- [ ] **Step 9: MANUAL VERIFY — WebGL fallback.** In the browser devtools, simulate no WebGL (e.g. disable WebGL via a flag, or temporarily edit `hasWebGL` to `return false`), reload → the existing CSS board renders, the 3D/2D toggle is disabled with the "WebGL unavailable" tooltip, the game remains fully playable. Revert any temporary edit.

- [ ] **Step 10: Commit.**
```bash
cd /Users/palm/Desktop/projects/cashflow-beyond/cashflow-modern && git add client/src/components/Game.tsx client/src/styles/index.css && git commit -m "feat: mount Board3D in Game with 2D/quality toggle + WebGL fallback"
```

---

### Task 12: (Optional, separately-verified) N8AO ambient occlusion

> Only do this task AFTER Task 11 ships and is verified. N8AO's prop interface at `@react-three/postprocessing@2.19.1` was NOT directly verified during planning (the effect IS exported per the package `index.tsx`, but its props were not read). Treat this as experimental: add it, run it, and if it errors or tanks frame rate, REVERT this task entirely — the stable subset (Bloom + Vignette + ToneMapping + ContactShadows) is the shipped baseline.

**Files:**
- Modify: `cashflow-modern/client/src/components/three/Effects.tsx`

- [ ] **Step 1: Confirm the N8AO API first.** Read the installed source to get the exact props:
```bash
cd /Users/palm/Desktop/projects/cashflow-beyond/cashflow-modern/client && cat node_modules/@react-three/postprocessing/dist/index.d.ts | grep -A20 -i "N8AO"
```
Expected: a `N8AOProps` / `N8AO` declaration listing real props (commonly `aoRadius`, `intensity`, `distanceFalloff`, `quality`). Use ONLY props that appear there.

- [ ] **Step 2: Add N8AO to the composer** using only the verified props from Step 1 (example — adjust to the actual declaration):
```tsx
import { EffectComposer, Bloom, Vignette, ToneMapping, N8AO } from '@react-three/postprocessing';

// ...inside the <EffectComposer>, as the FIRST child (AO renders before color effects):
<N8AO aoRadius={2} intensity={2} distanceFalloff={1} quality="medium" />
```

- [ ] **Step 3: Typecheck + manual verify.**
```bash
cd /Users/palm/Desktop/projects/cashflow-beyond/cashflow-modern/client && npm run typecheck && npm run dev
```
Expected: typecheck clean; in the browser the tile contact crevices darken subtly with no console errors and acceptable frame rate. If ANY of those fail → `git checkout client/src/components/three/Effects.tsx` and stop (skip this task).

- [ ] **Step 4: Commit (only if verified).**
```bash
cd /Users/palm/Desktop/projects/cashflow-beyond/cashflow-modern && git add client/src/components/three/Effects.tsx && git commit -m "feat: optional N8AO ambient occlusion in post-FX"
```

---

## Self-Review

### Spec §6 coverage checklist
- §6.1 Dependencies (`three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, dev `@types/three`) → **Task 1** (exact pinned versions).
- §6.2 `Board3D.tsx` → **Task 10**.
- §6.2 `RatRaceRing3D.tsx` → **Task 9**.
- §6.2 `FastTrackRing3D.tsx` → **Task 9**.
- §6.2 `Tile3D.tsx` (extruded rounded box, color by type, label, active highlight) → **Task 6** (`RoundedBox` + emissive active + `Html` label).
- §6.2 `Token3D.tsx` (per-player color, lerp in `useFrame`, hop on move) → **Task 7**.
- §6.2 `Dice3DGL.tsx` (tumble then settle on `diceValues`) → **Task 8**.
- §6.2 `Lighting.tsx` (key/fill/ambient + soft shadows + `Environment`) → **Task 4**.
- §6.2 `Effects.tsx` (`EffectComposer`: Bloom + tone mapping; SSAO optional) → **Task 5** (Bloom + Vignette + ToneMapping); SSAO/N8AO → **Task 12** (optional, flagged).
- §6.2 `boardLayout3d.ts` (derive 3D coords from tile data) → **Task 2** (pure, unit-tested).
- §6.3 Integration: `Game.tsx` composes Board3D as background + DOM HUD over it; HUD reused unchanged → **Task 11**.
- §6.3 i18n: tile labels via `tileLabel`/i18n; 3D text via drei `<Html>` (Thai-safe) → **Task 6** (uses `tileLabel`/`useTranslation`), **Task 9**.
- §6.4 Quality toggle (high/low, persist localStorage) → **Task 3** (store) + **Task 11** (UI + `Effects enabled`/shadows gating).
- §6.4 `prefers-reduced-motion` → **Task 10** (`prefersReducedMotion`) threaded into **Tasks 7/8** (snap, no hop/tumble).
- §6.4 WebGL-unavailable fallback to CSS boards (kept in tree) → **Task 3** (`hasWebGL`), **Task 11** (gate), **Task 10** (`<Canvas fallback>`). `RatRaceBoard`/`FastTrackBoard`/`Dice3D` are NOT deleted.
- §6.4 Mobile lighter camera + effects → **Task 10** (`dpr`/`antialias` by quality) + **Task 11** (responsive CSS). (Quality can be set to `low` on mobile by the user; auto-detect is not required by the spec.)
- §6 Exit criteria (dev shows board, dice→server value, tokens move, HUD, toggle + fallback) → **Task 11 Steps 8–9** manual verification.
- Locked decisions: full 3D board procedural, DOM HUD unchanged, client-only consuming `PublicGameState`, no wire-protocol change → honored across Tasks 9–11 (Board3D reads only `state.*` fields; no `emit`/socket changes; turn banner stays DOM, not passed into the canvas as `center`).
- Testing reality: Vitest in CLIENT only for `boardLayout3d.ts` (failing→passing) → **Tasks 1–2**; R3F components manual-verify + commit → **Tasks 4–12**.

### Type-consistency check (names line up across tasks)
- `quality: 'high' | 'low'` — defined in store (Task 3) and used identically as a prop in `Lighting`/`Tile3D`/`RatRaceRing3D`/`FastTrackRing3D`/`Board3D` (Tasks 4, 6, 9, 10).
- `boardLayout3d` exports `ringPositions(count, radius): RingPoint[]`, `RingPoint {x,z,angle}`, `ratTileColor(position): string`, `RAT_TILE_COLOR`, `FT_TILE_COLOR`, `tokenSlotOffset(index,total,spread): {dx,dz}` (Task 2) — consumed with the SAME names/signatures in Tasks 9.
- `Tile3DProps` (`position`, `rotationY`, `color`, `icon`, `label`, `active`, `quality`) defined in Task 6 — used verbatim by both rings in Task 9.
- `Token3DProps` (`target`, `color`, `current`, `reducedMotion`) defined in Task 7 — used verbatim by both rings in Task 9.
- `Dice3DGLProps` (`position`, `value`, `trigger`, `reducedMotion`) defined in Task 8 — used verbatim in Board3D Task 10.
- `Board3DProps` (`state`, `myId`, `dreams`, `fastTrack`, `quality`) defined in Task 10 — used verbatim in Game.tsx Task 11.
- `EffectsProps` (`enabled`) Task 5 — Board3D passes `enabled={highFx}` Task 10.
- `LightingProps` (`quality`) Task 4 — Board3D passes `quality={quality}` Task 10.
- `hasWebGL()` Task 3 — called in Game.tsx Task 11.
- Store: `render3d`/`quality`/`setRender3d`/`setQuality` Task 3 — read/used in Game.tsx Task 11.
- `RatRaceRing3DProps` / `FastTrackRing3DProps` Task 9 — instantiated with matching props in Board3D Task 10.

### Verified-API note (so nothing fragile is asserted)
- VERIFIED at the pinned versions: `Canvas` props (`shadows`, `dpr`, `camera`, `gl`, `fallback`), `useFrame`; drei `OrbitControls` (`makeDefault`, `enablePan`, polar/distance limits, `target`), `RoundedBox` (`args`,`radius`,`smoothness`), `Html` (`transform`,`occlude`,`distanceFactor`), `Environment` (`preset`), `ContactShadows` (`opacity`,`scale`,`blur`,`far`,`resolution`,`color`); postprocessing `EffectComposer` (`multisampling`), `Bloom`, `Vignette`, `ToneMapping` (all exported at v2.19.1; Bloom/Vignette are `wrapEffect`-wrapped → props = underlying effect options).
- NOT directly verified: `N8AO`/`SSAO` prop interfaces → confined to **Task 12** as optional with a read-the-`.d.ts`-first step and a revert path. If `mipmapBlur`/`luminanceSmoothing` typings reject in Task 5, drop only that prop (noted inline).

### Placeholder scan
- No `TBD`, no "add appropriate X", no "handle edge cases", no "similar to above", no "write tests for the above". Every code step contains complete, runnable code with exact imports, props, and run commands. The only intentionally-optional work (N8AO) is isolated in Task 12 with an explicit verify-or-revert gate.
