# Cashflow Beyond v2 — Phase 3: Firebase Google Auth Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Require Google sign-in (Firebase Authentication) before playing, and make the server authoritative about identity — the Node ws server verifies the Firebase ID token and derives `playerId = uid`, name, and photo from the verified token instead of trusting the client.

**Architecture:** Firebase is used for **Authentication only**. The client (under `app-next/client/`, mounted `ssr:false`) initializes the Firebase Web SDK, gates the whole app behind a Google sign-in screen, and attaches a fresh ID token to every `join`. The server verifies the token with `firebase-admin` (initialized with `projectId` only — no service-account key). Token verification is behind an **injectable verifier** so the Phase-2a integration tests run without real Firebase (a test bypass parses `test:<uid>:<name>` tokens). No persistence/Mongo yet (Phase 4).

**Tech Stack:** Firebase Web SDK (`firebase`), `firebase-admin` (Node, token verify), Next 16 / React 19.

**Spec:** `docs/superpowers/specs/2026-06-23-nextjs-firebase-auth-mongo-selfhost-design.md` §4.
**Prior:** Phases 1, 2a, 2b complete (playable game; client at `app-next/client/`, mounted by `app/page.tsx` via `dynamic(ssr:false)`; ws join handled in `app-next/lib/ws/gameSocket.ts`; client transport `app-next/client/lib/socket.ts`).

## Global Constraints
- Branch `feat/nextjs-rewrite`; never touch `main`; work from `/Users/palm/Desktop/projects/cashflow-beyond`.
- Firebase = **Auth only** (no Firestore/RTDB). Server verifies with `firebase-admin` `initializeApp({ projectId })` + `getAuth().verifyIdToken(token)` — **no service-account key**.
- **Identity is server-authoritative:** after verifying the token, the server uses the token's `uid` as `playerId` and the token's `name`/`picture` as the display identity. The client may still send a desired username but the server overrides identity from the verified token.
- **Token verification must be injectable/bypassable for tests.** A bypass mode (env `WS_AUTH_BYPASS=1`, used in tests) treats a token formatted `test:<uid>:<name>` as a verified user — so existing integration tests (and CI) need no real Firebase. Real verification runs when the bypass is off.
- Public client config via `NEXT_PUBLIC_FIREBASE_*` (safe to ship). Server needs only `FIREBASE_PROJECT_ID`.
- Do NOT modify `engine/*` or `data/*`. Keep the game playable.

## File Structure
- `app-next/client/lib/firebase.ts` — NEW. Web SDK init + `signInWithGoogle()`, `signOutUser()`, `onAuthChange(cb)`, `getIdToken()`.
- `app-next/client/components/AuthGate.tsx` — NEW. Shows the Google sign-in screen when signed out; renders children when signed in; exposes the current user via context/zustand.
- `app-next/client/App.tsx` — EDIT. Wrap the existing app tree in `<AuthGate>`.
- `app-next/client/lib/socket.ts` — EDIT. `playerId` = Firebase `uid`; attach a fresh ID token in the `join` payload (`idToken`); username from the Google display name.
- `app-next/lib/auth/verifyToken.ts` — NEW (server). `verifyToken(idToken): Promise<{uid,name,picture}|null>` — bypass mode parses `test:uid:name`; real mode uses `firebase-admin`.
- `app-next/lib/firebaseAdmin.ts` — NEW (server). Lazy `getAuth()` from `firebase-admin` `initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID })`.
- `app-next/lib/ws/gameSocket.ts` — EDIT. In the `join` handler, `await verifyToken(p.idToken)`; reject (`error:'auth_required'`) if null; use verified `uid`/`name`.
- `app-next/lib/ws/gameSocket.integration.test.ts` — EDIT. Run with `WS_AUTH_BYPASS=1`; pass `idToken: 'test:p1:Alice'`.
- `app-next/app/api/room/route.ts` — EDIT. Require a valid `Authorization: Bearer <token>` (verifyToken) to create a room.
- `app-next/.env.local.example` — NEW. The public `NEXT_PUBLIC_FIREBASE_*` keys + `FIREBASE_PROJECT_ID` (the "fill in and play" inputs).

---

### Task 1: Server-side token verification (injectable) + ws/API enforcement

**Files:** create `app-next/lib/auth/verifyToken.ts`, `app-next/lib/firebaseAdmin.ts`; edit `app-next/lib/ws/gameSocket.ts`, `app-next/lib/ws/gameSocket.integration.test.ts`, `app-next/app/api/room/route.ts`; add `firebase-admin` dep.

**Interfaces:**
- Produces: `verifyToken(idToken: string | undefined): Promise<{ uid: string; name: string; picture?: string } | null>`. The ws `join` rejects with `error: 'auth_required'` when it returns null; otherwise seats the player as `uid` with `name`.

- [ ] **Step 1: Add firebase-admin** — `cd app-next && npm install firebase-admin`.

- [ ] **Step 2: Write the bypass-aware verifier (test FIRST).**
Create `app-next/lib/auth/verifyToken.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { verifyToken } from './verifyToken.js';

describe('verifyToken (bypass mode)', () => {
  beforeEach(() => { process.env.WS_AUTH_BYPASS = '1'; });
  it('parses a test token into a user', async () => {
    expect(await verifyToken('test:abc:Alice')).toEqual({ uid: 'abc', name: 'Alice', picture: undefined });
  });
  it('returns null for a missing or malformed token', async () => {
    expect(await verifyToken(undefined)).toBeNull();
    expect(await verifyToken('garbage')).toBeNull();
  });
});
```
Run it (red), then implement `app-next/lib/auth/verifyToken.ts`:
```typescript
export interface VerifiedUser { uid: string; name: string; picture?: string }

export async function verifyToken(idToken: string | undefined): Promise<VerifiedUser | null> {
  if (!idToken) return null;
  if (process.env.WS_AUTH_BYPASS === '1') {
    const m = /^test:([^:]+):(.+)$/.exec(idToken);
    return m ? { uid: m[1], name: m[2], picture: undefined } : null;
  }
  try {
    const { getAuth } = await import('./firebaseAdmin.js');
    const d = await getAuth().verifyIdToken(idToken);
    return { uid: d.uid, name: d.name || d.email || 'Player', picture: d.picture };
  } catch {
    return null;
  }
}
```
Create `app-next/lib/firebaseAdmin.ts`:
```typescript
import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth as adminGetAuth } from 'firebase-admin/auth';

// Token verification needs only the project id (verifies signature + aud against Google certs).
function ensureApp() {
  if (!getApps().length) {
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
  }
}
export function getAuth() { ensureApp(); return adminGetAuth(); }
// (cert/applicationDefault imported for future use; not needed for verifyIdToken.)
```
Run the test green.

- [ ] **Step 3: Enforce in the ws `join` handler.** In `app-next/lib/ws/gameSocket.ts`, make `onMessage` able to `await` (or handle a promise) for `join`: before `addPlayer`, `const u = await verifyToken(p.idToken); if (!u) return ack(false, { error: 'auth_required' });` then use `u.uid` as the playerId and `u.name` as username (ignore client-claimed identity). Keep the rest of the join logic (resume/reclaim keyed by `u.uid`). Import `verifyToken` from `../auth/verifyToken.js`.

- [ ] **Step 4: Update the integration test.** In `gameSocket.integration.test.ts`, set `process.env.WS_AUTH_BYPASS = '1'` (top of file / beforeAll) and change every `join` payload to include `idToken: 'test:<pid>:<name>'` (e.g. `{ idToken: 'test:p1:Alice', intent: 'create' }`); the asserted `uid`/seat is now `p1`. Run the suite green.

- [ ] **Step 5: Gate `POST /api/room`.** In `app-next/app/api/room/route.ts`, read `Authorization: Bearer <token>`, `await verifyToken(token)`, return `401` if null, else the room code. (Import `verifyToken`.)

- [ ] **Step 6: Full suite green** — `cd app-next && npm run test`. Commit (`feat: server-authoritative Firebase token verification on ws join + /api/room`).

---

### Task 2: Client Firebase SDK + Google sign-in gate + token on join

**Files:** create `app-next/client/lib/firebase.ts`, `app-next/client/components/AuthGate.tsx`; edit `app-next/client/App.tsx`, `app-next/client/lib/socket.ts`; add `firebase` dep; add `app-next/.env.local.example` + `app-next/.env.development` Firebase keys.

**Interfaces:**
- Consumes: `NEXT_PUBLIC_FIREBASE_*` config; the server's `auth_required` contract.
- Produces: a login gate; `socket.ts` join now sends `{ playerId: uid, username: displayName, idToken, intent }`.

- [ ] **Step 1: Add firebase** — `cd app-next && npm install firebase`.

- [ ] **Step 2: Firebase client init.** Create `app-next/client/lib/firebase.ts`:
```typescript
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const app = getApps().length ? getApps()[0] : initializeApp(config);
export const auth = getAuth(app);
const provider = new GoogleAuthProvider();
export const signInWithGoogle = () => signInWithPopup(auth, provider);
export const signOutUser = () => signOut(auth);
export const onAuthChange = (cb: (u: User | null) => void) => onAuthStateChanged(auth, cb);
export const getIdToken = async (): Promise<string | null> => auth.currentUser ? auth.currentUser.getIdToken() : null;
```

- [ ] **Step 3: AuthGate (test FIRST with a mocked auth module).** Create `app-next/client/components/AuthGate.tsx` rendering a "Sign in with Google" screen when `user` is null and `children` when set, subscribing via `onAuthChange`. Write a Vitest+jsdom test that mocks `../lib/firebase` to drive `onAuthChange` and asserts the gate shows the login button when signed out and the children when signed in. (If the project's vitest is node-env only, add a jsdom env directive at the top of the test file: `// @vitest-environment jsdom`.)

- [ ] **Step 4: Wrap the app.** In `app-next/client/App.tsx`, wrap the existing top-level tree with `<AuthGate>...</AuthGate>`. Keep all existing screens unchanged inside it.

- [ ] **Step 5: Use uid + token on join.** In `app-next/client/lib/socket.ts`, set `playerId` to the Firebase `uid` (read from `auth.currentUser?.uid` at connect time; keep the localStorage UUID only as a pre-auth fallback that is never used once signed in), and include `idToken: await getIdToken()` in every `join`/`resume` emit; use the Google `displayName` as `username`. Adjust `createRoom`/`joinRoom`/`resume` to be async-token-aware. Also send the token as a Bearer header on the `POST /api/room` fetch.

- [ ] **Step 6: Env files.** Create `app-next/.env.local.example`:
```
# ---- Firebase (Authentication only) — fill these from your Firebase project's Web App config ----
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
# Server-side token verification (same project id):
FIREBASE_PROJECT_ID=
```
Add the same keys (blank, with the dev `NEXT_PUBLIC_WS_URL`) to `.env.development` comments so dev knows what to set.

- [ ] **Step 7: Build + tests green.** `cd app-next && npm run build && npm run test`. (The e2e from 2b will be updated in a later step/phase to sign in via the auth emulator or a bypass; for now ensure unit/integration green and the build compiles.) Commit (`feat: Firebase Google sign-in gate + uid/token on ws join`).

---

## Self-Review
**1. Spec coverage (§4):** mandatory Google login (Task 2 gate), server-side `firebase-admin` verification with projectId only (Task 1), `playerId = uid` + identity from the verified token (Tasks 1–2), authorized inputs captured in `.env.local.example`. Profile/stats (§5) is Phase 4.
**2. Placeholder scan:** verifier, admin init, firebase client, and env file are complete code. AuthGate's exact JSX is described with a concrete test contract (login-when-signed-out / children-when-signed-in) — bounded, since its styling matches the app's existing screens.
**3. Consistency:** `verifyToken` signature is identical across `verifyToken.ts`, its test, `gameSocket.ts`, and `route.ts`. The `idToken`/`uid` join contract matches between `socket.ts` (client) and `gameSocket.ts` (server). `WS_AUTH_BYPASS` is set in both the verifier and the integration test.

## Phase 3 → Phase 4 handoff
**Phase 4 — MongoDB profile/stats + server-authoritative writes + profile screen:** connect the ws server to `shared-mongo` (new `cashflow_app` user), write `users`/`matches` on game-end (detected from the engine's terminal state), add `/api/me` + `/api/matches` (verifyToken-gated) and a profile screen. Real end-to-end auth (a real Google project) is part of the final "fill in `.env.local` and play" deliverable.
