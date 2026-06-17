import { GameRoom } from './GameRoom.js';
import { DREAMS, FAST_TRACK_BOARD } from '../../server/src/data/fastTrack.js';

export { GameRoom };

interface Env {
  ASSETS: Fetcher;
  GAME_ROOM: DurableObjectNamespace;
}

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = (): string => {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ROOM_ALPHABET[b % ROOM_ALPHABET.length]).join('');
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors }
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    if (pathname === '/api/board') {
      return json({ dreams: DREAMS, fastTrack: FAST_TRACK_BOARD });
    }

    if (pathname === '/api/room' && request.method === 'POST') {
      return json({ roomId: makeCode() });
    }

    if (pathname === '/ws') {
      const code = (url.searchParams.get('room') || '').toUpperCase();
      if (!code) return new Response('room required', { status: 400 });
      const id = env.GAME_ROOM.idFromName(code);
      const stub = env.GAME_ROOM.get(id);
      return stub.fetch(request);
    }

    // Everything else → static client assets (SPA fallback configured in wrangler.toml)
    return env.ASSETS.fetch(request);
  }
};
