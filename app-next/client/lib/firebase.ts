import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApps()[0] : initializeApp(config);
export const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Resolves once Firebase has finished restoring the persisted session on load.
// Until this settles, `auth.currentUser` is null and any identity/token read would
// fall back to a pre-auth value — callers that need the real uid must await this.
export const authReady: Promise<void> = auth.authStateReady();

export const signInWithGoogle = () => signInWithPopup(auth, provider);
export const signOutUser = () => signOut(auth);
export const onAuthChange = (cb: (u: User | null) => void) =>
  onAuthStateChanged(auth, cb);
export const getIdToken = async (): Promise<string | null> =>
  auth.currentUser ? auth.currentUser.getIdToken() : null;
