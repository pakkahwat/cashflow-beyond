// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Drive a fake Firebase auth: currentUser starts null (session not yet restored),
// then a user appears asynchronously — exactly the page-load sequence that caused the
// "can't roll / details blank in bot games" bug (myId stuck on the pre-auth uuid).
let authUser: { uid: string } | null = null;
let authCb: ((u: unknown) => void) | null = null;

vi.mock('./firebase', () => ({
  auth: {
    get currentUser() {
      return authUser;
    },
  },
  getIdToken: async () => (authUser ? 'tok' : null),
  onAuthChange: (cb: (u: unknown) => void) => {
    authCb = cb;
    cb(authUser); // mirror Firebase firing once with the current state on subscribe
    return () => {};
  },
  authReady: Promise.resolve(),
}));

import { onId } from './socket';

beforeEach(() => {
  authUser = null;
  authCb = null;
  localStorage.clear();
});

describe('socket identity sync', () => {
  it('re-emits the real Firebase uid once auth resolves after the pre-auth fallback', () => {
    const ids: string[] = [];
    onId((id) => ids.push(id));

    // Before auth resolves, the id is the localStorage uuid fallback, NOT a uid.
    expect(ids.length).toBeGreaterThan(0);
    expect(ids[0]).not.toBe('firebase-uid-123');

    // Firebase restores the session → auth.currentUser becomes the real user.
    authUser = { uid: 'firebase-uid-123' };
    authCb?.(authUser);

    // The id must now be re-emitted as the Firebase uid so it matches the
    // server-side player and "is it my turn" / "me" resolve correctly.
    expect(ids[ids.length - 1]).toBe('firebase-uid-123');
  });
});
