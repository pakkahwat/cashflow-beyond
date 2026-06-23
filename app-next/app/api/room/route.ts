import { NextResponse } from 'next/server';
import { makeCode } from '../../../lib/roomCode';

export function POST() {
  return NextResponse.json({ roomId: makeCode() });
}
