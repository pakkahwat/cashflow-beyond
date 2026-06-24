/**
 * recordGameEnd.ts — shared idempotent helper for writing match stats.
 *
 * Called from BOTH the human-action path (gameSocket.ts onMessage) and the
 * bot auto-play path (botRunner.ts step) so that a bot's winning move is
 * recorded just as reliably as a human's winning move.
 *
 * The `recorder` parameter accepts a simple `(room: Room) => Promise<void>`
 * so tests can inject a stub without needing a live Mongo connection.
 */

import type { Room } from './RoomManager.js';
import { getDb } from '../mongo.js';
import { recordMatch } from '../stats.js';

/** Default implementation: pull DB collections from getDb() and call recordMatch. */
async function defaultRecorder(room: Room): Promise<void> {
  const finalState = room.game.getState();
  const startedAt = room.startedAt ?? Date.now();
  const endedAt = Date.now();
  const vsBots = (room.bots?.size ?? 0) > 0;
  const db = await getDb();
  await recordMatch({
    matchesCol: db.collection('matches'),
    usersCol: db.collection('users'),
    roomCode: room.code,
    finalState,
    startedAt,
    endedAt,
    vsBots,
  });
}

export type RoomRecorder = (room: Room) => Promise<void>;

/**
 * If the game in `room` has just finished and hasn't been recorded yet, write
 * the match to MongoDB exactly once. Safe to call from multiple code paths —
 * `room.recorded` is set synchronously before any async I/O so concurrent
 * (sync-ordered) calls from the same event-loop tick cannot double-write.
 */
export function maybeRecordGameEnd(room: Room, recorder: RoomRecorder = defaultRecorder): void {
  if (room.game.getState().status !== 'finished') return;
  if (room.recorded) return;

  // Set the guard synchronously — before any await — so a second call (e.g.
  // from botRunner right after gameSocket) sees it and exits immediately.
  room.recorded = true;

  recorder(room).catch((e) => console.error('recordMatch error:', e));
}
