import { NextResponse } from 'next/server';
import { verifyToken } from '../../../lib/auth/verifyToken';
import { getDb } from '../../../lib/mongo';

/**
 * GET /api/matches
 *
 * Returns the authenticated user's recent match history (own data only).
 * Query param: limit (default 20, max 50)
 *
 * Response: { matches: MatchDoc[] }
 */
export async function GET(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const user = await verifyToken(token);
  if (!user) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }

  const url = new URL(request.url);
  const limitParam = parseInt(url.searchParams.get('limit') ?? '20', 10);
  const limit = Math.min(Math.max(1, isNaN(limitParam) ? 20 : limitParam), 50);

  const db = await getDb();
  const matchesCol = db.collection('matches');

  const matchList = await matchesCol
    .find({ 'players.uid': user.uid })
    .sort({ endedAt: -1 })
    .limit(limit)
    .toArray();

  return NextResponse.json({ matches: matchList });
}
