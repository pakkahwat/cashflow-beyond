import { NextResponse } from 'next/server';
import { verifyToken } from '../../../lib/auth/verifyToken';
import { getDb } from '../../../lib/mongo';

/**
 * GET /api/me
 *
 * Returns the authenticated user's profile and aggregate stats.
 * Upserts lastLoginAt + name/photoURL on every call (serves as profile refresh).
 *
 * Response: { profile: { uid, name, photoURL, createdAt, lastLoginAt }, stats: { ... winRate } }
 */
export async function GET(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const user = await verifyToken(token);
  if (!user) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }

  const db = await getDb();
  const usersCol = db.collection('users');

  const now = Date.now();

  // Upsert: set lastLoginAt + name/photoURL on every login; createdAt only on first insert.
  await usersCol.updateOne(
    { _id: user.uid as unknown as any },
    {
      $set: {
        'profile.name': user.name,
        'profile.photoURL': user.picture ?? null,
        'profile.lastLoginAt': now,
      },
      $setOnInsert: {
        'profile.createdAt': now,
        'stats.gamesPlayed': 0,
        'stats.gamesWon': 0,
        'stats.gamesLost': 0,
        'stats.bestPassiveIncome': 0,
      },
    },
    { upsert: true }
  );

  const doc = await usersCol.findOne({ _id: user.uid as unknown as any });

  const profile = {
    uid: user.uid,
    name: doc?.profile?.name ?? user.name,
    photoURL: doc?.profile?.photoURL ?? null,
    createdAt: doc?.profile?.createdAt ?? now,
    lastLoginAt: doc?.profile?.lastLoginAt ?? now,
  };

  const rawStats = doc?.stats ?? {};
  const gamesPlayed: number = rawStats.gamesPlayed ?? 0;
  const gamesWon: number = rawStats.gamesWon ?? 0;
  const gamesLost: number = rawStats.gamesLost ?? 0;
  const bestPassiveIncome: number = rawStats.bestPassiveIncome ?? 0;
  const winRate: number = gamesPlayed > 0 ? gamesWon / gamesPlayed : 0;

  const stats = {
    gamesPlayed,
    gamesWon,
    gamesLost,
    bestPassiveIncome,
    winRate,
  };

  return NextResponse.json({ profile, stats });
}
