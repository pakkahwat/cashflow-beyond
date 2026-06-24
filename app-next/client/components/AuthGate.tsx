'use client';
import { useState, useEffect, createContext, useContext } from 'react';
import type { User } from 'firebase/auth';
import { onAuthChange, signInWithGoogle, signOutUser } from '../lib/firebase';
import { clearSession } from '../lib/socket';

interface AuthContextValue {
  user: User | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({ user: null, signOut: async () => {} });

export const useAuth = () => useContext(AuthContext);

interface Props {
  children: React.ReactNode;
}

export default function AuthGate({ children }: Props) {
  // null = still loading, User = signed in, false = signed out
  const [user, setUser] = useState<User | null | false>(null);

  useEffect(() => {
    // E2E test mode: skip Google sign-in entirely (guarded by the build flag, never
    // set in production), so Playwright can drive real games without OAuth.
    if (process.env.NEXT_PUBLIC_E2E === '1') {
      setUser({ uid: 'e2e', displayName: 'E2E Player' } as unknown as User);
      return;
    }
    const unsub = onAuthChange((u) => setUser(u ?? false));
    return unsub;
  }, []);

  // Still resolving auth state — show nothing to avoid flicker
  if (user === null) return null;

  // Signed out — show login screen
  if (user === false) {
    return (
      <div className="screen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', gap: '1.5rem' }}>
        <div className="logo">CA$HRICH</div>
        <p style={{ opacity: 0.7 }}>Sign in to play</p>
        <button className="btn" onClick={() => signInWithGoogle()}>
          Sign in with Google
        </button>
      </div>
    );
  }

  // Signed in — render the app with auth context. signOut clears the saved game
  // session first so the next account to sign in here doesn't auto-resume this one.
  const signOut = async () => {
    clearSession();
    await signOutUser();
  };

  return (
    <AuthContext.Provider value={{ user, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
