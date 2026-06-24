import { describe, it, expect } from 'vitest';
import { Game } from './Game.js';
import { makePlayer } from './test-helpers.js';
import type { Card } from './types.js';

const card = (c: Partial<Card>): Card => c as Card;

const start2 = () => {
  const g = new Game('ROOM');
  g.addPlayer('a', 'Alice');
  g.addPlayer('b', 'Bob');
  g.start('a');
  return g;
};

const pushRE = (p: any, id: string, symbol: string, over: any = {}) =>
  p.assets.realEstates.push({ id, type: 'realEstate', symbol, cost: 100000, mortgage: 80000, downPayment: 20000, cashFlow: 500, ...over });

// ---------------- A1: MLM passive income ----------------
describe('MLM passive income (gap fix #1)', () => {
  it('mlmPayout credits $500 on a win only when the player owns MLM', () => {
    const p = makePlayer();
    p.cash = 0;
    expect(p.mlmPayout(true)).toBe(0); // no MLM yet
    p.hasMlm = true;
    expect(p.mlmPayout(false)).toBe(0);
    expect(p.cash).toBe(0);
    expect(p.mlmPayout(true)).toBe(500);
    expect(p.cash).toBe(500);
  });

  it('buyMlm sets hasMlm and charges the cost', () => {
    const p = makePlayer();
    p.cash = 1000;
    expect(p.buyMlm(card({ type: 'mlm', symbol: 'MLM', cost: 500 }))).toBe(true);
    expect(p.hasMlm).toBe(true);
    expect(p.cash).toBe(500);
  });

  it('rolls an MLM payout when crossing a payday tile (logs mlmPayout)', () => {
    const g = start2();
    const me = g.currentPlayer;
    me.hasMlm = true;
    me.position = 5; // payday tile is 6 (normal board)
    const before = me.cash;
    (g as any).resolveRatRaceLanding(1); // move 5 -> 6, crossing/landing payday
    const logs = (g as any).logs.map((l: any) => l.code);
    expect(logs).toContain('mlmPayout');
    // gained the payday, plus either $0 or $500 from the MLM roll
    const gain = me.cash - before;
    expect([me.cashFlow, me.cashFlow + 500]).toContain(gain);
  });
});

// ---------------- A2: liquidation clears mortgages ----------------
describe('Liquidation discharges mortgages (gap fix #2)', () => {
  it('clears liabilities.realEstates so no ghost mortgage remains', () => {
    const p = makePlayer();
    p.cash = 100000;
    p.buyRealEstate(card({ id: 're1', type: 'realEstate', symbol: '4-PLEX', cost: 100000, mortgage: 80000, downPayment: 20000, cashFlow: 500 }));
    expect(p.liabilities.realEstates.length).toBe(1);
    p.cash = -1; // force the bank-relief branch too
    p.liquidateEverything();
    expect(p.assets.realEstates.length).toBe(0);
    expect(p.liabilities.realEstates.length).toBe(0);
  });
});

// ---------------- A3: market RE sale must match property type ----------------
describe('Market real-estate sale matches property category (gap fix #3)', () => {
  it('a Plex buyer cannot sell a 2Br house, but can sell a plex', () => {
    const p = makePlayer();
    pushRE(p, 're_plex', '4-PLEX');
    pushRE(p, 're_house', '2Br/1Ba');
    const plexBuyer = card({ type: 'realEstate', symbol: 'PLEX', plus: true, value: 10000 });
    expect(p.sellRealEstate(plexBuyer, 're_house')).toBe(false); // wrong category
    expect(p.sellRealEstate(plexBuyer, 're_plex')).toBe(true); // matches plex
  });

  it('a buyer can still sell an un-targeted property type (no regression)', () => {
    const p = makePlayer();
    pushRE(p, 're_units', '24UNITS'); // no dedicated buyer category
    const plexBuyer = card({ type: 'realEstate', symbol: 'PLEX', plus: true, value: 10000 });
    expect(p.sellRealEstate(plexBuyer, 're_units')).toBe(true);
  });

  it('matches the lowercase 3Br/2ba variant to a 3Br/2Ba buyer', () => {
    const p = makePlayer();
    pushRE(p, 're_h', '3Br/2ba');
    const houseBuyer = card({ type: 'realEstate', symbol: '3Br/2Ba', plus: true, value: 5000 });
    expect(p.sellRealEstate(houseBuyer, 're_h')).toBe(true);
  });
});

// ---------------- C: businesses can be sold via a market card ----------------
describe('Business market sale (gap #6)', () => {
  it('sellBusiness pays cost + gain, removes the business and its income/liability', () => {
    const p = makePlayer();
    p.cash = 0;
    const biz = { id: 'b1', type: 'business' as const, symbol: 'PIZZA', cost: 20000, mortgage: 0, downPayment: 20000, cashFlow: 1200 };
    p.assets.businesses.push(biz);
    p.income.businesses!.push(biz);
    const buyer = card({ type: 'business', symbol: 'BIZ', plus: false, value: 100 }); // +100% of cost
    expect(p.sellBusiness(buyer, 'b1')).toBe(true);
    expect(p.cash).toBe(40000); // 20000 cost + 20000 gain - 0 mortgage
    expect(p.assets.businesses.length).toBe(0);
    expect(p.income.businesses!.length).toBe(0);
  });

  it('cardAction("sellBusiness") works for the current player on a business market card', () => {
    const g = start2();
    const me = g.currentPlayer;
    me.assets.businesses.push({ id: 'bz', type: 'business', symbol: 'CAFE', cost: 30000, mortgage: 0, downPayment: 30000, cashFlow: 1500 } as any);
    (g as any).pendingCard = card({ id: 'mk', type: 'business', symbol: 'BIZ', plus: true, value: 50000 });
    (g as any).resolved = false;
    (g as any).hasRolled = true;
    const before = me.cash;
    const res = g.cardAction(me.id, 'sellBusiness', { assetId: 'bz' });
    expect(res.ok).toBe(true);
    expect(me.cash).toBe(before + 80000); // 30000 + 50000 - 0
    expect(me.assets.businesses.length).toBe(0);
  });
});

// ---------------- B1: forced liquidation costs turns ----------------
describe('Forced liquidation costs turns (gap #5)', () => {
  it('a rescued player loses 3 turns (normal)', () => {
    const g = start2();
    const me = g.currentPlayer;
    pushRE(me, 'r', '4-PLEX', { downPayment: 40000 }); // liquidation credits 20000
    me.cash = -1000;
    const res = g.liquidate(me.id);
    expect(res.ok).toBe(true);
    expect(me.isBankrupt).toBe(false);
    expect(me.skippedTurns).toBe(3);
  });

  it('a player who cannot recover goes bankrupt with no turn penalty', () => {
    const g = start2();
    const me = g.currentPlayer;
    me.cash = -10_000_000; // unrecoverable
    g.liquidate(me.id);
    expect(me.isBankrupt).toBe(true);
    expect(me.skippedTurns).toBe(0);
  });
});

// ---------------- D: peer-to-peer deal offer ----------------
describe('Peer-to-peer deal offer (gap #4)', () => {
  const setupOffer = () => {
    const g = start2();
    const a = g.currentPlayer;
    const bId = g.players.find((p) => p.id !== a.id)!.id;
    (g as any).pendingCard = card({ id: 'd', type: 'realEstate', symbol: '2Br/1Ba', downPayment: 5000, cost: 50000, mortgage: 45000, cashFlow: 300 });
    (g as any).resolved = false;
    (g as any).hasRolled = true;
    return { g, a, bId };
  };

  it('offers a buyable deal to another player and sets pendingOffer', () => {
    const { g, a, bId } = setupOffer();
    expect(g.offerDeal(a.id, bId).ok).toBe(true);
    expect(g.getState().pendingOffer).toEqual({ fromId: a.id, toId: bId });
  });

  it('recipient accepts: buys the asset, card clears, offerer can end turn', () => {
    const { g, a, bId } = setupOffer();
    g.offerDeal(a.id, bId);
    const b = g.players.find((p) => p.id === bId)!;
    b.cash = 100000;
    const res = g.respondOffer(bId, true);
    expect(res.ok).toBe(true);
    expect(b.assets.realEstates.length).toBe(1);
    expect(b.cash).toBe(95000); // paid the 5000 down payment
    expect(g.getState().pendingOffer).toBeNull();
    expect((g as any).pendingCard).toBeNull();
    expect((g as any).resolved).toBe(true);
    // offerer (a) did NOT get the asset
    expect(a.assets.realEstates.length).toBe(0);
  });

  it('recipient declines: deal returns to the offering player', () => {
    const { g, a, bId } = setupOffer();
    g.offerDeal(a.id, bId);
    const res = g.respondOffer(bId, false);
    expect(res.ok).toBe(true);
    expect(g.getState().pendingOffer).toBeNull();
    expect((g as any).pendingCard).not.toBeNull(); // back with the offerer
    expect((g as any).resolved).toBe(false);
  });

  it('rejects offering a market-sale card, offering to yourself, and non-recipients responding', () => {
    const { g, a, bId } = setupOffer();
    // market-sale card is not a buyable deal
    (g as any).pendingCard = card({ type: 'realEstate', symbol: 'PLEX', plus: true, value: 1000 });
    expect(g.offerDeal(a.id, bId).ok).toBe(false);
    // can't offer to yourself
    (g as any).pendingCard = card({ type: 'realEstate', downPayment: 5000 });
    expect(g.offerDeal(a.id, a.id).ok).toBe(false);
    // valid offer, but the wrong player tries to respond
    expect(g.offerDeal(a.id, bId).ok).toBe(true);
    expect(g.respondOffer(a.id, true).ok).toBe(false);
  });
});

// ---------------- B2: first player by highest roll ----------------
describe('First player chosen by opening roll (gap #7)', () => {
  it('start picks a valid first player and logs the opening roll', () => {
    const g = start2();
    expect(['a', 'b']).toContain(g.currentPlayer.id);
    const log = (g as any).logs.find((l: any) => l.code === 'firstPlayer');
    expect(log).toBeTruthy();
    expect(log.params.roll).toBeGreaterThanOrEqual(1);
    expect(log.params.roll).toBeLessThanOrEqual(6);
  });
});
