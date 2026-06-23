'use client';
import { useState, useEffect, createContext, useContext } from 'react';
import type { User } from 'firebase/auth';
import { onAuthChange, signInWithGoogle, signOutUser } from '../lib/firebase';

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

  // Signed in — render the app with auth context
  return (
    <AuthContext.Provider value={{ user, signOut: signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
}
