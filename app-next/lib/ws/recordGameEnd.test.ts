/**
 * Unit tests for maybeRecordGameEnd — no live Mongo required.
 * The recorder is injected as a stub so these tests are pure in-memory.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { maybeRecordGameEnd, type RoomRecorder } from './recordGameEnd.js';
import type { Room } from './RoomManager.js';
import { Game } from '../../engine/Game.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal Room-shaped object backed by a real Game instance. */
function makeRoom(overrides: Partial<Room> = {}): Room {
  const game = new Game('TEST');
  return {
    code: 'TEST',
    game,
    sockets: new Map(),
    startedAt: Date.now() - 5000,
    ...overrides,
  } as unknown as Room;
}

/** Patch getState on the room's game to return status:'finished'. */
function forceFinished(room: Room, winnerId: string | null = 'p1'): void {
  vi.spyOn(room.game, 'getState').mockReturnValue({
    roomId: 'TEST',
    status: 'finished',
    difficulty: 'normal',
    winnerId,
    players: [
      {
        id: 'p1',
        username: 'Alice',
        color: '#e74c3c',
        isHost: true,
        connected: true,
        professionName: 'Engineer',
        salary: 4000,
        passiveIncome: 5000,
        totalIncome: 9000,
        totalExpenses: 3000,
        cashFlow: 6000,
        cash: 20000,
        babies: 0,
        income: { salary: 4000, realEstates: [], businesses: [] },
        expenses: {
          taxes: 1000,
          homeMortgagePayment: 1000,
          schoolLoanPayment: 500,
          carLoanPayment: 200,
          creditCardPayment: 100,
          otherExpenses: 200,
          bankLoanPayment: 0,
          perChildExpense: 0,
        },
        assets: { savings: 0, preciousMetals: [], stocks: [], realEstates: [], businesses: [] },
        liabilities: {
          homeMortgage: 100000,
          schoolLoans: 50000,
          carLoans: 20000,
          creditCardDebt: 10000,
          bankLoan: 0,
          realEstates: [],
        },
        ledger: [],
        position: 5,
        phase: 'fastTrack',
        fastTrackPosition: 3,
        fastTrackIncome: 500000,
        fastTrackCashFlowGain: 50000,
        dreamId: 'dream-1',
        skippedTurns: 0,
        extraDiceTurns: 0,
        hasMlm: false,
        ftCharityDice: false,
        isBankrupt: false,
        hasWon: winnerId === 'p1',
      },
    ],
    currentPlayerId: null,
    diceValues: [],
    hasRolled: false,
    pendingCard: null,
    pendingFastTrackTile: null,
    awaitingDealChoice: false,
    awaitingDreamChoice: [],
    awaitingFastTrackChoice: null,
    dreamMarkers: {},
    logs: [],
  } as ReturnType<typeof room.game.getState>);
}

/** Stub recorder: resolves immediately, records calls. */
function makeStubRecorder(): RoomRecorder {
  return vi.fn((_room: Room): Promise<void> => Promise.resolve());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('maybeRecordGameEnd', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls the recorder exactly once when the game is finished', async () => {
    const room = makeRoom();
    forceFinished(room);
    const recorder = makeStubRecorder();

    maybeRecordGameEnd(room, recorder);

    // room.recorded must be set synchronously
    expect(room.recorded).toBe(true);

    // Give the promise microtask queue time to flush
    await new Promise((r) => setImmediate(r));
    expect(recorder).toHaveBeenCalledTimes(1);
  });

  it('sets room.recorded synchronously before any await', () => {
    const room = makeRoom();
    forceFinished(room);
    const recorder = makeStubRecorder();

    maybeRecordGameEnd(room, recorder);

    // Check synchronously — before awaiting anything
    expect(room.recorded).toBe(true);
  });

  it('does NOT call the recorder a second time (idempotency)', async () => {
    const room = makeRoom();
    forceFinished(room);
    const recorder = makeStubRecorder();

    maybeRecordGameEnd(room, recorder);
    maybeRecordGameEnd(room, recorder); // second call — must be ignored

    await new Promise((r) => setImmediate(r));
    expect(recorder).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the game is not finished', () => {
    const room = makeRoom(); // fresh game → status 'lobby'
    const recorder = makeStubRecorder();

    maybeRecordGameEnd(room, recorder);

    expect(room.recorded).toBeUndefined();
    expect(recorder).not.toHaveBeenCalled();
  });

  it('does nothing when already recorded (room.recorded = true before call)', async () => {
    const room = makeRoom({ recorded: true } as Partial<Room>);
    forceFinished(room);
    const recorder = makeStubRecorder();

    maybeRecordGameEnd(room, recorder);

    await new Promise((r) => setImmediate(r));
    expect(recorder).not.toHaveBeenCalled();
  });

  it('passes the room to the recorder (recorder receives the room object)', async () => {
    const room = makeRoom({ bots: new Set(['bot:1']) } as Partial<Room>);
    forceFinished(room);
    const recorder = makeStubRecorder();

    maybeRecordGameEnd(room, recorder);
    await new Promise((r) => setImmediate(r));

    expect(recorder).toHaveBeenCalledTimes(1);
    // The recorder receives the room; the caller can inspect room.bots for vsBots
    const calledWithRoom = (recorder as ReturnType<typeof vi.fn>).mock.calls[0][0] as Room;
    expect(calledWithRoom.bots?.has('bot:1')).toBe(true);
  });

  it('passes the room without bots when no bots are present', async () => {
    const room = makeRoom(); // no bots
    forceFinished(room);
    const recorder = makeStubRecorder();

    maybeRecordGameEnd(room, recorder);
    await new Promise((r) => setImmediate(r));

    expect(recorder).toHaveBeenCalledTimes(1);
    const calledWithRoom = (recorder as ReturnType<typeof vi.fn>).mock.calls[0][0] as Room;
    expect((calledWithRoom.bots?.size ?? 0) > 0).toBe(false);
  });
});
