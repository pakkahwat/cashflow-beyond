import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth as adminGetAuth } from 'firebase-admin/auth';

// Token verification needs only the project id (verifies signature + aud against Google certs).
function ensureApp() {
  if (!getApps().length) {
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
  }
}
export function getAuth() { ensureApp(); return adminGetAuth(); }
