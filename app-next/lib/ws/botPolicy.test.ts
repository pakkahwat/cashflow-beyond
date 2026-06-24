import { describe, it, expect } from 'vitest';
import { nextBotAction, acceptDealOffer } from './botPolicy.js';
import type { PublicGameState, PublicPlayer, Card } from '../../engine/types.js';

// ---------- Fixture builders (mirror the REAL public state shape) ----------

const makePlayer = (over: Partial<PublicPlayer> = {}): PublicPlayer => ({
  id: 'bot:1',
  username: 'Bot 1',
  color: '#000',
  isHost: false,
  connected: true,
  professionName: 'Engineer',
  salary: 5000,
  passiveIncome: 0,
  totalIncome: 5000,
  totalExpenses: 3000,
  cashFlow: 2000,
  cash: 5000,
  babies: 0,
  income: { salary: 5000, realEstates: [], businesses: [] },
  expenses: {
    taxes: 0,
    homeMortgagePayment: 0,
    schoolLoanPayment: 0,
    carLoanPayment: 0,
    creditCardPayment: 0,
    otherExpenses: 0,
    bankLoanPayment: 0,
    perChildExpense: 0
  },
  assets: { savings: 0, preciousMetals: [], stocks: [], realEstates: [], businesses: [] },
  liabilities: {
    homeMortgage: 0,
    schoolLoans: 0,
    carLoans: 0,
    creditCardDebt: 0,
    bankLoan: 0,
    realEstates: []
  },
  ledger: [],
  position: 0,
  phase: 'ratRace',
  fastTrackPosition: 0,
  fastTrackIncome: 0,
  fastTrackCashFlowGain: 0,
  dreamId: null,
  skippedTurns: 0,
  extraDiceTurns: 0,
  hasMlm: false,
  ftCharityDice: false,
  isBankrupt: false,
  hasWon: false,
  ...over
});

const makeState = (over: Partial<PublicGameState> = {}, player?: PublicPlayer): PublicGameState => {
  const p = player ?? makePlayer();
  return {
    roomId: 'R',
    status: 'started',
    difficulty: 'normal',
    players: [p],
    currentPlayerId: p.id,
    diceValues: [],
    hasRolled: false,
    pendingCard: null,
    pendingFastTrackTile: null,
    awaitingDealChoice: false,
    awaitingDreamChoice: [],
    awaitingFastTrackChoice: null,
    pendingOffer: null,
    dreamMarkers: {},
    logs: [],
    winnerId: null,
    ...over
  };
};

const reCard = (over: Partial<Card> = {}): Card => ({
  id: 'c1',
  type: 'realEstate',
  symbol: 'HOUSE',
  cost: 50000,
  downPayment: 5000,
  mortgage: 45000,
  cashFlow: 300,
  ...over
});

describe('acceptDealOffer (P2P deal passed to a bot)', () => {
  it('accepts a positive-cashflow deal it can afford', () => {
    const bot = makePlayer({ cash: 50000 });
    expect(acceptDealOffer(reCard({ cashFlow: 300, downPayment: 5000 }), bot)).toBe(true);
  });
  it('declines a deal it cannot afford (keeps its cash cushion)', () => {
    const bot = makePlayer({ cash: 4000 }); // below LOW_CASH after a 5000 down payment
    expect(acceptDealOffer(reCard({ cashFlow: 300, downPayment: 5000 }), bot)).toBe(false);
  });
  it('declines a non-cashflowing deal even if affordable', () => {
    const bot = makePlayer({ cash: 50000 });
    expect(acceptDealOffer(reCard({ cashFlow: 0, downPayment: 5000 }), bot)).toBe(false);
  });
});

describe('nextBotAction', () => {
  const BOT = 'bot:1';

  it('returns null when it is not the bot turn', () => {
    const st = makeState({ currentPlayerId: 'human:1' });
    expect(nextBotAction(st, BOT)).toBeNull();
  });

  it('returns null when the game is not started', () => {
    const st = makeState({ status: 'lobby' });
    expect(nextBotAction(st, BOT)).toBeNull();
  });

  it('returns null when the game is finished', () => {
    const st = makeState({ status: 'finished' });
    expect(nextBotAction(st, BOT)).toBeNull();
  });

  // (start) dream choice fires for everyone at game start
  it('(dream at start) picks a dream when the bot still needs one', () => {
    const p = makePlayer({ dreamId: null });
    const st = makeState({ awaitingDreamChoice: [BOT] }, p);
    const a = nextBotAction(st, BOT);
    expect(a?.method).toBe('chooseDream');
    expect(typeof a?.args[0]).toBe('string');
    expect((a!.args[0] as string).length).toBeGreaterThan(0);
  });

  // (a) awaiting roll → rollDice
  it('(a) rolls the dice when a roll is awaited', () => {
    const st = makeState({ hasRolled: false });
    const a = nextBotAction(st, BOT);
    expect(a?.method).toBe('rollDice');
  });

  // Fast-Track eligibility is offered BEFORE the roll → enter it.
  it('(d) enters Fast Track when eligible (before rolling)', () => {
    const p = makePlayer({ passiveIncome: 4000, totalExpenses: 3000 });
    const st = makeState({ awaitingFastTrackChoice: BOT, hasRolled: false }, p);
    const a = nextBotAction(st, BOT);
    expect(a?.method).toBe('enterFastTrack');
  });

  it('(deal choice) picks the big deal when flush, otherwise the small deal', () => {
    const rich = makePlayer({ cash: 100000 });
    const stRich = makeState({ awaitingDealChoice: true, hasRolled: true }, rich);
    expect(nextBotAction(stRich, BOT)).toEqual({ method: 'chooseDeal', args: ['big'] });

    const poor = makePlayer({ cash: 2000 });
    const stPoor = makeState({ awaitingDealChoice: true, hasRolled: true }, poor);
    expect(nextBotAction(stPoor, BOT)).toEqual({ method: 'chooseDeal', args: ['small'] });
  });

  // (b) affordable positive-cashflow real-estate deal → buy
  it('(b) buys an affordable positive-cashflow real-estate deal', () => {
    const p = makePlayer({ cash: 20000 });
    const st = makeState({ pendingCard: reCard({ downPayment: 5000, cashFlow: 300 }), hasRolled: true }, p);
    const a = nextBotAction(st, BOT);
    expect(a?.method).toBe('cardAction');
    expect(a?.args[0]).toBe('buyRealEstate');
  });

  // (c) unaffordable deal → skip
  it('(c) skips a real-estate deal it cannot afford', () => {
    const p = makePlayer({ cash: 1000 });
    const st = makeState({ pendingCard: reCard({ downPayment: 5000, cashFlow: 300 }), hasRolled: true }, p);
    const a = nextBotAction(st, BOT);
    expect(a).toEqual({ method: 'cardAction', args: ['skip'] });
  });

  it('skips a real-estate deal with non-positive cash flow even if affordable', () => {
    const p = makePlayer({ cash: 50000 });
    const st = makeState({ pendingCard: reCard({ downPayment: 5000, cashFlow: 0 }), hasRolled: true }, p);
    expect(nextBotAction(st, BOT)).toEqual({ method: 'cardAction', args: ['skip'] });
  });

  it('buys an affordable positive-cashflow business deal', () => {
    const p = makePlayer({ cash: 20000 });
    const card = reCard({ type: 'business', downPayment: 8000, cashFlow: 500 });
    const st = makeState({ pendingCard: card, hasRolled: true }, p);
    const a = nextBotAction(st, BOT);
    expect(a?.method).toBe('cardAction');
    expect(a?.args[0]).toBe('buyBusiness');
  });

  it('skips stock / gold / mlm / lottery / charity / market cards (does not gamble)', () => {
    const cases: Card['type'][] = ['stock', 'goldCoins', 'mlm', 'lottery', 'charity'];
    for (const type of cases) {
      const st = makeState({ pendingCard: reCard({ type, value: undefined, plus: undefined }), hasRolled: true });
      expect(nextBotAction(st, BOT)).toEqual({ method: 'cardAction', args: ['skip'] });
    }
  });

  // (rescue) needs to resolve negative cash → liquidate
  it('(rescue) liquidates when cash is negative (needs rescue) before ending the turn', () => {
    const p = makePlayer({ cash: -2000, assets: { savings: 0, preciousMetals: [], stocks: [], realEstates: [], businesses: [] } });
    const st = makeState({ hasRolled: true }, p);
    const a = nextBotAction(st, BOT);
    expect(a?.method).toBe('liquidate');
  });

  // Fast Track pending investment tile with positive cashflow & affordable → buy
  it('(fast track) buys an affordable Fast Track investment', () => {
    const p = makePlayer({ phase: 'fastTrack', cash: 100000 });
    const st = makeState(
      {
        hasRolled: true,
        pendingFastTrackTile: { index: 1, kind: 'investment', id: 'software', cost: 200000, downPayment: 50000, cashFlow: 20000 }
      },
      p
    );
    const a = nextBotAction(st, BOT);
    expect(a).toEqual({ method: 'fastTrackAction', args: ['buy'] });
  });

  it('(fast track) skips a Fast Track investment it cannot afford', () => {
    const p = makePlayer({ phase: 'fastTrack', cash: 10000 });
    const st = makeState(
      {
        hasRolled: true,
        pendingFastTrackTile: { index: 1, kind: 'investment', id: 'software', cost: 200000, downPayment: 50000, cashFlow: 20000 }
      },
      p
    );
    expect(nextBotAction(st, BOT)).toEqual({ method: 'fastTrackAction', args: ['skip'] });
  });

  it('(fast track) buys its own dream tile when it can afford it', () => {
    const p = makePlayer({ phase: 'fastTrack', cash: 300000, dreamId: 'orphanage' });
    const st = makeState(
      { hasRolled: true, pendingFastTrackTile: { index: 2, kind: 'dream', id: 'orphanage' } },
      p
    );
    expect(nextBotAction(st, BOT)).toEqual({ method: 'fastTrackAction', args: ['buy'] });
  });

  it("(fast track) skips a dream tile that isn't the bot's own dream", () => {
    const p = makePlayer({ phase: 'fastTrack', cash: 300000, dreamId: 'island' });
    const st = makeState(
      { hasRolled: true, pendingFastTrackTile: { index: 2, kind: 'dream', id: 'orphanage' } },
      p
    );
    expect(nextBotAction(st, BOT)).toEqual({ method: 'fastTrackAction', args: ['skip'] });
  });

  // (e) nothing pending → null (runner ends the turn)
  it('(e) returns null when nothing is pending (rolled, resolved) so the runner ends the turn', () => {
    const st = makeState({ hasRolled: true, pendingCard: null, pendingFastTrackTile: null, awaitingDealChoice: false });
    expect(nextBotAction(st, BOT)).toBeNull();
  });
});
