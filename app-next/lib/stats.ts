/**
 * stats.ts — pure match builder + DB writer for server-authoritative game-end stats.
 *
 * buildMatch(roomCode, finalState, startedAt, endedAt)
 *   Pure function — no I/O. Returns matchDoc + per-user stat deltas.
 *
 * recordMatch(deps)
 *   Writes matchDoc (insert) and applies each user delta (upsert) to MongoDB.
 *
 * Engine field notes (verified from Game.ts + Player.ts source):
 *   - game finished:     state.status === 'finished'
 *   - winner:            state.winnerId (string | null)
 *   - escaped rat race:  player.phase === 'fastTrack'
 *   - passive income:    player.passiveIncome (computed, in PublicPlayer)
 *   - turnsPlayed:       NOT tracked by engine — field is omitted everywhere
 */

import type { PublicGameState, PublicPlayer } from '../engine/types';
import type { Collection, Document } from 'mongodb';

// ---- Document shapes ----

export interface MatchPlayerEntry {
  uid: string;
  name: string;
  escapedRatRace: boolean;   // player.phase === 'fastTrack'
  finalPassiveIncome: number; // player.passiveIncome
  turnsPlayed?: never;        // engine does not track this; field intentionally absent
  result: 'win' | 'loss' | 'draw';
}

export interface MatchDoc {
  roomCode: string;
  winnerUid: string | null;
  startedAt: number;
  endedAt: number;
  vsBots: boolean;
  players: MatchPlayerEntry[];
}

export interface UserDelta {
  uid: string;
  inc: {
    gamesPlayed: 1;
    gamesWon?: 1;
    gamesLost?: 1;
  };
  max: {
    bestPassiveIncome: number;
  };
  min: {
    fastestRatRaceTurns?: never; // engine does not expose turn count; intentionally absent
  };
  set: Record<string, never>;
}

export interface BuildMatchResult {
  matchDoc: MatchDoc;
  userDeltas: UserDelta[];
}

// ---- Pure builder ----

export function buildMatch(
  roomCode: string,
  finalState: PublicGameState,
  startedAt: number,
  endedAt: number,
  vsBots = false
): BuildMatchResult {
  const { winnerId, players } = finalState;

  const matchPlayers: MatchPlayerEntry[] = players.map((p: PublicPlayer) => {
    let result: 'win' | 'loss' | 'draw';
    if (winnerId === null) {
      result = 'draw';
    } else {
      result = p.id === winnerId ? 'win' : 'loss';
    }

    return {
      uid: p.id,
      name: p.username,
      escapedRatRace: p.phase === 'fastTrack',
      finalPassiveIncome: p.passiveIncome,
      result
    };
  });

  const matchDoc: MatchDoc = {
    roomCode,
    winnerUid: winnerId,
    startedAt,
    endedAt,
    vsBots,
    players: matchPlayers
  };

  const userDeltas: UserDelta[] = players.map((p: PublicPlayer) => {
    const isWinner = winnerId !== null && p.id === winnerId;
    const isDraw = winnerId === null;

    const inc: UserDelta['inc'] = { gamesPlayed: 1 };
    if (isWinner) {
      inc.gamesWon = 1;
    } else if (isDraw || !isWinner) {
      inc.gamesLost = 1;
    }

    return {
      uid: p.id,
      inc,
      max: { bestPassiveIncome: p.passiveIncome },
      min: {},
      set: {}
    };
  });

  return { matchDoc, userDeltas };
}

// ---- DB writer ----

export interface RecordMatchDeps {
  matchesCol: Collection<Document>;
  usersCol: Collection<Document>;
  roomCode: string;
  finalState: PublicGameState;
  startedAt: number;
  endedAt: number;
  vsBots?: boolean;
}

export async function recordMatch(deps: RecordMatchDeps): Promise<void> {
  const { matchesCol, usersCol, roomCode, finalState, startedAt, endedAt, vsBots = false } = deps;

  const { matchDoc, userDeltas } = buildMatch(roomCode, finalState, startedAt, endedAt, vsBots);

  await matchesCol.insertOne(matchDoc);

  await Promise.all(
    userDeltas.map((delta) => {
      const update: Document = {
        $inc: delta.inc,
        $max: delta.max
      };
      // Only include $min if non-empty
      const minEntries = Object.entries(delta.min).filter(([, v]) => v !== undefined);
      if (minEntries.length > 0) {
        update.$min = Object.fromEntries(minEntries);
      }
      // Only include $set if non-empty
      const setEntries = Object.entries(delta.set).filter(([, v]) => v !== undefined);
      if (setEntries.length > 0) {
        update.$set = Object.fromEntries(setEntries);
      }
      return usersCol.updateOne({ _id: delta.uid as unknown as Document['_id'] }, update, { upsert: true });
    })
  );
}
