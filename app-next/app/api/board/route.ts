import { NextResponse } from 'next/server';
import { DREAMS, FAST_TRACK_BOARD } from '../../../data/fastTrack';

export function GET() {
  return NextResponse.json({ dreams: DREAMS, fastTrack: FAST_TRACK_BOARD });
}
