import { NextResponse } from 'next/server';
import { makeCode } from '../../../lib/roomCode';
import { verifyToken } from '../../../lib/auth/verifyToken';

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const user = await verifyToken(token);
  if (!user) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }
  return NextResponse.json({ roomId: makeCode() });
}
