export interface VerifiedUser { uid: string; name: string; picture?: string }

export async function verifyToken(idToken: string | undefined): Promise<VerifiedUser | null> {
  if (!idToken) return null;
  if (process.env.WS_AUTH_BYPASS === '1') {
    const m = /^test:([^:]+):(.+)$/.exec(idToken);
    return m ? { uid: m[1], name: m[2], picture: undefined } : null;
  }
  try {
    const { getAuth } = await import('../firebaseAdmin.js');
    const d = await getAuth().verifyIdToken(idToken);
    return { uid: d.uid, name: d.name || d.email || 'Player', picture: d.picture };
  } catch {
    return null;
  }
}
