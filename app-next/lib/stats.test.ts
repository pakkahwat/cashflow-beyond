import { describe, it, expect } from 'vitest';
import { buildMatch } from './stats';
import type { PublicGameState } from '../engine/types';

// Minimal fake PublicGameState shaped from the real engine (Game.ts getState()).
// Key fields verified from source:
//   status: 'finished' — game terminal
//   winnerId: string | null — winner player id
//   players[].phase: 'fastTrack' | 'ratRace' — escaped rat race iff phase === 'fastTrack'
//   players[].passiveIncome — computed getter (realEstate + business cashFlow sum)
//   players[].hasWon — true for the winner
//   turnsPlayed — NOT tracked by engine; derived as undefined (omitted from schema)

function makePlayer(
  overrides: Partial<PublicGameState['players'][0]>
): PublicGameState['players'][0] {
  return {
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
      perChildExpense: 0
    },
    assets: { savings: 0, preciousMetals: [], stocks: [], realEstates: [], businesses: [] },
    liabilities: { homeMortgage: 100000, schoolLoans: 50000, carLoans: 20000, creditCardDebt: 10000, bankLoan: 0, realEstates: [] },
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
    hasWon: true,
    ...overrides
  };
}

function makeState(overrides: Partial<PublicGameState> = {}): PublicGameState {
  return {
    roomId: 'ABCDE',
    status: 'finished',
    difficulty: 'normal',
    players: [
      makePlayer({ id: 'uid-alice', username: 'Alice', hasWon: true, phase: 'fastTrack', passiveIncome: 5000 }),
      makePlayer({ id: 'uid-bob', username: 'Bob', hasWon: false, phase: 'ratRace', passiveIncome: 1200, isHost: false })
    ],
    currentPlayerId: 'uid-alice',
    diceValues: [],
    hasRolled: false,
    pendingCard: null,
    pendingFastTrackTile: null,
    awaitingDealChoice: false,
    awaitingDreamChoice: [],
    awaitingFastTrackChoice: null,
    dreamMarkers: {},
    logs: [],
    winnerId: 'uid-alice',
    ...overrides
  } as PublicGameState;
}

describe('buildMatch', () => {
  it('produces a matchDoc with correct roomCode and winnerId', () => {
    const startedAt = Date.now() - 60_000;
    const endedAt = Date.now();
    const state = makeState();

    const { matchDoc } = buildMatch('ABCDE', state, startedAt, endedAt);

    expect(matchDoc.roomCode).toBe('ABCDE');
    expect(matchDoc.winnerUid).toBe('uid-alice');
    expect(matchDoc.startedAt).toBe(startedAt);
    expect(matchDoc.endedAt).toBe(endedAt);
  });

  it('matchDoc.players has one entry per player with correct fields', () => {
    const state = makeState();
    const { matchDoc } = buildMatch('ABCDE', state, 0, 1000);

    expect(matchDoc.players).toHaveLength(2);

    const alice = matchDoc.players.find((p) => p.uid === 'uid-alice')!;
    expect(alice.name).toBe('Alice');
    expect(alice.escapedRatRace).toBe(true); // phase === 'fastTrack'
    expect(alice.finalPassiveIncome).toBe(5000);
    expect(alice.result).toBe('win');

    const bob = matchDoc.players.find((p) => p.uid === 'uid-bob')!;
    expect(bob.name).toBe('Bob');
    expect(bob.escapedRatRace).toBe(false); // phase === 'ratRace'
    expect(bob.finalPassiveIncome).toBe(1200);
    expect(bob.result).toBe('loss');
  });

  it('turnsPlayed is undefined (engine does not track it)', () => {
    const state = makeState();
    const { matchDoc } = buildMatch('ABCDE', state, 0, 1000);
    matchDoc.players.forEach((p) => {
      expect(p.turnsPlayed).toBeUndefined();
    });
  });

  it('produces userDeltas with gamesPlayed +1 for all players', () => {
    const state = makeState();
    const { userDeltas } = buildMatch('ABCDE', state, 0, 1000);

    expect(userDeltas).toHaveLength(2);
    userDeltas.forEach((d) => {
      expect(d.inc.gamesPlayed).toBe(1);
    });
  });

  it('winner delta has gamesWon +1; loser has gamesLost +1', () => {
    const state = makeState();
    const { userDeltas } = buildMatch('ABCDE', state, 0, 1000);

    const aliceDelta = userDeltas.find((d) => d.uid === 'uid-alice')!;
    expect(aliceDelta.inc.gamesWon).toBe(1);
    expect(aliceDelta.inc.gamesLost).toBeUndefined();

    const bobDelta = userDeltas.find((d) => d.uid === 'uid-bob')!;
    expect(bobDelta.inc.gamesLost).toBe(1);
    expect(bobDelta.inc.gamesWon).toBeUndefined();
  });

  it('winner delta has bestPassiveIncome $max and winner has higher income', () => {
    const state = makeState();
    const { userDeltas } = buildMatch('ABCDE', state, 0, 1000);

    const aliceDelta = userDeltas.find((d) => d.uid === 'uid-alice')!;
    expect(aliceDelta.max.bestPassiveIncome).toBe(5000);

    const bobDelta = userDeltas.find((d) => d.uid === 'uid-bob')!;
    expect(bobDelta.max.bestPassiveIncome).toBe(1200);
  });

  it('winner delta sets fastestRatRaceTurns min to undefined (engine does not track turns)', () => {
    const state = makeState();
    const { userDeltas } = buildMatch('ABCDE', state, 0, 1000);

    // turnsPlayed not available — fastestRatRaceTurns must NOT be set
    userDeltas.forEach((d) => {
      expect(d.min.fastestRatRaceTurns).toBeUndefined();
    });
  });

  it('works with a single player game (edge case: all bankrupt but one wins)', () => {
    const state = makeState({
      players: [
        makePlayer({ id: 'uid-solo', username: 'Solo', hasWon: true, phase: 'fastTrack', passiveIncome: 8000 })
      ],
      winnerId: 'uid-solo'
    });
    const { matchDoc, userDeltas } = buildMatch('SOLO1', state, 0, 5000);

    expect(matchDoc.winnerUid).toBe('uid-solo');
    expect(matchDoc.players).toHaveLength(1);
    expect(userDeltas).toHaveLength(1);
    expect(userDeltas[0].inc.gamesWon).toBe(1);
  });

  it('handles null winnerId (all bankrupt draw) — draw does NOT increment gamesLost', () => {
    const state = makeState({ winnerId: null, status: 'finished' });
    const { matchDoc, userDeltas } = buildMatch('ABCDE', state, 0, 1000);

    expect(matchDoc.winnerUid).toBeNull();
    // all players get gamesPlayed +1; draws do NOT get gamesWon or gamesLost
    userDeltas.forEach((d) => {
      expect(d.inc.gamesPlayed).toBe(1);
      expect(d.inc.gamesLost).toBeUndefined();
      expect(d.inc.gamesWon).toBeUndefined();
    });
  });

  it('each draw player has result:"draw" in matchDoc.players', () => {
    const state = makeState({ winnerId: null, status: 'finished' });
    const { matchDoc } = buildMatch('ABCDE', state, 0, 1000);

    matchDoc.players.forEach((p) => {
      expect(p.result).toBe('draw');
    });
  });
});
