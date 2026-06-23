// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import AuthGate from './AuthGate';

// Mock the firebase module so tests run without a real Firebase project.
let authChangeCallback: ((u: any) => void) | null = null;

vi.mock('../lib/firebase', () => ({
  onAuthChange: (cb: (u: any) => void) => {
    authChangeCallback = cb;
    // Return an unsubscribe no-op
    return () => { authChangeCallback = null; };
  },
  signInWithGoogle: vi.fn(),
  signOutUser: vi.fn(),
  auth: {},
}));

beforeEach(() => {
  authChangeCallback = null;
});

afterEach(() => {
  cleanup();
});

describe('AuthGate', () => {
  it('shows the sign-in button when the user is signed out', async () => {
    render(<AuthGate><div>APP CONTENT</div></AuthGate>);

    // Simulate Firebase reporting "signed out"
    await act(async () => {
      authChangeCallback?.(null);
    });

    expect(screen.getByText('Sign in with Google')).toBeTruthy();
    expect(screen.queryByText('APP CONTENT')).toBeNull();
  });

  it('renders children when the user is signed in', async () => {
    render(<AuthGate><div>APP CONTENT</div></AuthGate>);

    // Simulate Firebase reporting a signed-in user
    const fakeUser = { uid: 'u1', displayName: 'Alice', email: 'alice@test.com', getIdToken: async () => 'tok' };
    await act(async () => {
      authChangeCallback?.(fakeUser);
    });

    expect(screen.getByText('APP CONTENT')).toBeTruthy();
    expect(screen.queryByText('Sign in with Google')).toBeNull();
  });
});
