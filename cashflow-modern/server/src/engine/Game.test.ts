import { describe, it, expect } from 'vitest';
import { Game } from './Game.js';
import professions from '../data/professions.json';

const start2 = () => {
  const g = new Game('ROOM');
  g.addPlayer('a', 'Alice');
  g.addPlayer('b', 'Bob');
  g.start('a');
  return g;
};

describe('Game.start — starting cash (H1)', () => {
  it('gives each player cashFlow + savings, then zeroes savings', () => {
    const g = start2();
    for (const p of g.players) {
      const prof = (professions as any[]).find((x) => x.profession === p.professionName);
      expect(p.cash).toBe(p.cashFlow + prof.assets.savings);
      expect(p.assets.savings).toBe(0);
    }
  });
});

describe('Rat Race Charity (C1)', () => {
  it('lets the current player donate via cardAction("donate")', () => {
    const g = start2();
    const me = g.currentPlayer;
    me.position = 4; // charity tile
    (g as any).pendingCard = { id: 'c', type: 'charity', heading: 'Charity' };
    (g as any).resolved = false;
    (g as any).hasRolled = true;

    const before = me.cash;
    const res = g.cardAction(me.id, 'donate');
    expect(res.ok).toBe(true);
    expect(me.extraDiceTurns).toBe(3);
    expect(me.cash).toBe(before - Math.round(0.1 * me.totalIncome));
    expect((g as any).pendingCard).toBeNull();
    expect((g as any).resolved).toBe(true);
  });
});

describe('Fast Track Charity rulebook edition (M3)', () => {
  it('grants permanent 1/2/3-dice choice at no cost', () => {
    const g = start2();
    const me = g.currentPlayer;
    me.phase = 'fastTrack';
    me.fastTrackPosition = 4; // a charity tile
    me.cash = 500000;
    const before = me.cash;

    // Simulate landing on charity by invoking the private resolver.
    (g as any).resolveFastTrackLanding(0);
    expect(me.ftCharityDice).toBe(true);
    expect(me.cash).toBe(before); // no cost

    // Now the player may roll 3 dice on the Fast Track.
    (g as any).hasRolled = false;
    const res = g.rollDice(me.id, 3);
    expect(res.ok).toBe(true);
    expect((g as any).diceValues.length).toBe(3);
  });
});

describe('Market damage insufficient (C3)', () => {
  it('forces the full debit (cash goes negative) instead of vanishing', () => {
    const g = start2();
    const me = g.currentPlayer;
    me.assets.realEstates.push({ id: 're', type: 'realEstate', symbol: 'house', cost: 50000, mortgage: 40000, downPayment: 10000, cashFlow: 200 });
    me.cash = 100;
    (g as any).pendingCard = { id: 'd', type: 'damage', heading: 'Storm', cost: 5000 };
    (g as any).autoResolveMarket();
    expect(me.cash).toBe(100 - 5000);
    expect(me.needsRescue()).toBe(true);
  });
});

describe('Loan guards (M8 + L6)', () => {
  it('rejects loans on Fast Track and for bankrupt players', () => {
    const g = start2();
    const me = g.currentPlayer;
    me.phase = 'fastTrack';
    expect(g.takeLoan(me.id, 1000).ok).toBe(false);
    me.phase = 'ratRace';
    me.isBankrupt = true;
    expect(g.takeLoan(me.id, 1000).ok).toBe(false);
    me.isBankrupt = false;
    expect(g.takeLoan(me.id, 1000).ok).toBe(true);
  });
});

describe('Fast Track entry is a choice (M5)', () => {
  it('does not auto-enter; the player enters via enterFastTrack at turn start', () => {
    const g = start2();
    const me = g.currentPlayer;
    me.assets.realEstates.push({ id: 're', type: 'realEstate', symbol: 'x', cost: 1, mortgage: 0, downPayment: 1, cashFlow: 999999 } as any);
    expect(me.canExitRatRace()).toBe(true);
    expect(me.phase).toBe('ratRace'); // NOT auto-entered
    expect((g as any).getState().awaitingFastTrackChoice).toBe(me.id);
    expect(g.enterFastTrack(me.id).ok).toBe(true);
    expect(me.phase).toBe('fastTrack');
  });
});

describe('Dream chosen at setup + cost escalation (M4/L8)', () => {
  it('lets a Rat Race player choose a dream and escalates cost when others land on it', () => {
    const g = start2();
    const [p1, p2] = g.players;
    expect(g.chooseDream(p1.id, 'jet').ok).toBe(true); // allowed during Rat Race
    expect(p1.dreamId).toBe('jet');
    p2.phase = 'fastTrack';
    (g as any).currentIndex = g.players.indexOf(p2);
    p2.fastTrackPosition = 10; // 'jet' dream tile
    (g as any).resolveFastTrackLanding(0);
    expect((g as any).dreamMarkers['jet']).toBe(1);
  });
});

describe('Shared stock sale — other holders may sell on landing (#4)', () => {
  it('lets a non-current holder sell the same stock at the drawn price, but not buy', () => {
    const g = start2();
    const cur = g.currentPlayer;
    const other = g.players.find((p) => p.id !== cur.id)!;
    other.assets.stocks.push({ id: 's', type: 'stock', symbol: 'MYT4U', price: 20, count: 10 });
    const otherCashBefore = other.cash;

    // current player lands on a MYT4U stock card priced at $40
    (g as any).pendingCard = { id: 'sc', type: 'stock', symbol: 'MYT4U', price: 40 };
    (g as any).hasRolled = true;

    // non-current holder sells all 10 @ $40
    const sell = g.cardAction(other.id, 'sellStocks', { count: 10 });
    expect(sell.ok).toBe(true);
    expect(other.cash).toBe(otherCashBefore + 40 * 10);
    expect(other.assets.stocks.find((s) => s.symbol === 'MYT4U')).toBeUndefined();
    // the card stays on the table for the current player to resolve
    expect((g as any).pendingCard).not.toBeNull();

    // a non-current player may NOT buy, and may not sell what they don't hold
    expect(g.cardAction(other.id, 'buyStocks', { count: 1 }).ok).toBe(false);
    expect(g.cardAction(other.id, 'sellStocks', { count: 1 }).ok).toBe(false);
  });
});

describe('Start guards (L2 + L10)', () => {
  it('needs >= 2 players and starts on a valid current player', () => {
    const solo = new Game('R');
    solo.addPlayer('a', 'Solo');
    expect(solo.start('a').ok).toBe(false); // need_players

    const g = start2();
    expect(g.status).toBe('started');
    expect(g.players.some((p) => p.id === g.currentPlayer.id)).toBe(true);
  });
});
