import professionsData from '../data/professions.json';
import { Player } from './Player.js';
import { Decks } from './decks.js';
import { RAT_RACE_SIZE, ratRaceTileType, tilesCrossed } from './board.js';
import {
  DREAMS,
  FAST_TRACK_BOARD,
  FAST_TRACK_SIZE,
  FAST_TRACK_CASHFLOW_GOAL
} from '../data/fastTrack.js';
import type {
  Card,
  Profession,
  PublicGameState,
  GamePhaseStatus,
  DeckName,
  Liabilities
} from './types.js';

const PROFESSIONS = professionsData as unknown as Profession[];
const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22'];

const shuffle = <T>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const rollDie = () => Math.floor(Math.random() * 6) + 1;

export interface ActionResult {
  ok: boolean;
  error?: string;
}
const ok = (): ActionResult => ({ ok: true });
const fail = (error: string): ActionResult => ({ ok: false, error });

export class Game {
  roomId: string;
  status: GamePhaseStatus = 'lobby';
  players: Player[] = [];
  private decks = new Decks();

  private currentIndex = 0;
  private diceValues: number[] = [];
  private hasRolled = false;
  private resolved = false; // current player may end the turn
  private pendingCard: Card | null = null;
  private awaitingDealChoice = false;
  private pendingFastTrackTile: ReturnType<() => (typeof FAST_TRACK_BOARD)[number]> | null = null;
  private logs: { ts: number; player: string; color: string; message: string }[] = [];
  private winnerId: string | null = null;

  constructor(roomId: string) {
    this.roomId = roomId;
  }

  // ---------- Lobby ----------

  addPlayer(id: string, username: string): ActionResult {
    if (this.status !== 'lobby') return fail('game_already_started');
    if (this.players.length >= 6) return fail('room_full');
    if (this.players.some((p) => p.username === username)) return fail('name_taken');
    const isHost = this.players.length === 0;
    const color = COLORS[this.players.length % COLORS.length];
    // profession assigned at start; use a placeholder clone now
    const profession = PROFESSIONS[this.players.length % PROFESSIONS.length];
    this.players.push(new Player(id, username, color, isHost, profession));
    return ok();
  }

  reconnect(oldId: string, newId: string): boolean {
    const p = this.players.find((pl) => pl.id === oldId);
    if (!p) return false;
    if (this.currentPlayer?.id === oldId) this.currentIndexById(newId);
    p.id = newId;
    p.connected = true;
    return true;
  }

  private currentIndexById(_id: string) {
    /* index unchanged; id updated in place */
  }

  setConnected(id: string, connected: boolean) {
    const p = this.players.find((pl) => pl.id === id);
    if (p) p.connected = connected;
  }

  removePlayer(id: string): void {
    if (this.status === 'lobby') {
      this.players = this.players.filter((p) => p.id !== id);
      if (this.players.length && !this.players.some((p) => p.isHost)) {
        this.players[0].isHost = true;
      }
    } else {
      this.setConnected(id, false);
    }
  }

  get host(): Player | undefined {
    return this.players.find((p) => p.isHost);
  }

  // ---------- Start ----------

  start(byId: string): ActionResult {
    const host = this.host;
    if (!host || host.id !== byId) return fail('only_host_can_start');
    if (this.players.length < 1) return fail('need_players');
    // assign unique professions + colors fresh
    const profs = shuffle(PROFESSIONS).slice(0, this.players.length);
    this.players.forEach((p, i) => {
      const fresh = new Player(p.id, p.username, COLORS[i % COLORS.length], p.isHost, profs[i]);
      this.players[i] = fresh;
    });
    this.status = 'started';
    this.currentIndex = 0;
    this.beginTurn();
    this.log(this.currentPlayer, 'started the game');
    return ok();
  }

  // ---------- Turn lifecycle ----------

  get currentPlayer(): Player {
    return this.players[this.currentIndex];
  }

  private isCurrent(id: string): boolean {
    return this.currentPlayer?.id === id;
  }

  private beginTurn(): void {
    this.hasRolled = false;
    this.resolved = false;
    this.pendingCard = null;
    this.awaitingDealChoice = false;
    this.pendingFastTrackTile = null;
    this.diceValues = [];

    const p = this.currentPlayer;
    if (p.isBankrupt) {
      this.advanceTurn();
      return;
    }
    if (p.skippedTurns > 0) {
      p.skippedTurns -= 1;
      this.log(p, 'skipped a turn');
      this.advanceTurn();
    }
  }

  private advanceTurn(): void {
    if (this.status === 'finished') return;
    const active = this.players.filter((p) => !p.isBankrupt);
    if (active.length === 0) {
      this.status = 'finished';
      return;
    }
    let guard = 0;
    do {
      this.currentIndex = (this.currentIndex + 1) % this.players.length;
      guard += 1;
    } while (this.currentPlayer.isBankrupt && guard <= this.players.length);
    this.beginTurn();
  }

  endTurn(id: string): ActionResult {
    if (!this.isCurrent(id)) return fail('not_your_turn');
    if (!this.hasRolled) return fail('must_roll_first');
    if (!this.resolved) return fail('resolve_card_first');
    if (this.currentPlayer.needsRescue()) return fail('must_resolve_debt');
    this.advanceTurn();
    return ok();
  }

  // ---------- Rolling ----------

  rollDice(id: string, diceCount = 1): ActionResult {
    if (this.status !== 'started') return fail('game_not_started');
    if (!this.isCurrent(id)) return fail('not_your_turn');
    if (this.hasRolled) return fail('already_rolled');
    const p = this.currentPlayer;

    let count = 1;
    if (p.phase === 'fastTrack') count = 2;
    else if (p.extraDiceTurns > 0) count = diceCount === 2 ? 2 : 1;

    this.diceValues = Array.from({ length: count }, rollDie);
    const steps = this.diceValues.reduce((s, v) => s + v, 0);
    this.hasRolled = true;
    this.log(p, `rolled ${this.diceValues.join(' + ')} = ${steps}`);

    if (p.extraDiceTurns > 0) p.extraDiceTurns -= 1;

    if (p.phase === 'fastTrack') {
      this.resolveFastTrackLanding(steps);
    } else {
      this.resolveRatRaceLanding(steps);
    }
    return ok();
  }

  // ---------- Rat Race landing ----------

  private resolveRatRaceLanding(steps: number): void {
    const p = this.currentPlayer;
    const from = p.position;
    p.move(steps);

    // Pay payday for every payday tile crossed (including a landing).
    tilesCrossed(from, p.position, steps).forEach((pos) => {
      if (ratRaceTileType(pos) === 'payday') {
        const amount = p.payday();
        this.log(p, `received payday $${amount.toLocaleString()}`);
      }
    });

    const tile = ratRaceTileType(p.position);
    switch (tile) {
      case 'payday':
        this.resolved = true;
        break;
      case 'deal':
        this.awaitingDealChoice = true;
        this.log(p, 'landed on a Deal — choose Small or Big');
        break;
      case 'market':
        this.pendingCard = this.decks.draw('market');
        this.log(p, `Market: ${this.pendingCard.heading ?? ''}`);
        this.autoResolveMarket();
        break;
      case 'doodad': {
        const card = this.decks.draw('doodad');
        this.pendingCard = card;
        const result = p.doodad(card);
        if (result === 'skip') this.log(p, `dodged a Doodad: ${card.heading}`);
        else this.log(p, `paid Doodad $${(card.cost ?? 0).toLocaleString()}: ${card.heading}`);
        this.pendingCard = null;
        this.resolved = true;
        break;
      }
      case 'charity':
        this.pendingCard = this.decks.draw('charity');
        this.log(p, 'landed on Charity');
        break;
      case 'downsized': {
        this.pendingCard = this.decks.draw('downsized');
        const amount = p.downsized();
        this.log(p, `Downsized! paid $${amount.toLocaleString()} and lose 2 turns`);
        this.pendingCard = null;
        this.resolved = true;
        break;
      }
      case 'baby': {
        this.pendingCard = this.decks.draw('baby');
        const added = p.baby();
        this.log(p, added ? 'had a new baby 👶' : 'already has 3 babies');
        this.pendingCard = null;
        this.resolved = true;
        break;
      }
      default:
        this.resolved = true;
    }
    this.checkRatRaceExit();
  }

  private autoResolveMarket(): void {
    const p = this.currentPlayer;
    const card = this.pendingCard;
    if (!card) return;
    if (card.type === 'damage') {
      const res = p.payDamages(card);
      if (res === 'noRealEstate') this.log(p, 'has no real estate — damage ignored');
      else if (res === 'paid') this.log(p, `paid damages $${(card.cost ?? 0).toLocaleString()}`);
      this.pendingCard = null;
      this.resolved = true;
      return;
    }
    // goldCoins / realEstate / lottery market cards offer an optional sale —
    // keep the card pending so the player can choose to sell or skip.
    this.resolved = false;
  }

  // ---------- Deal choice ----------

  chooseDeal(id: string, size: 'small' | 'big'): ActionResult {
    if (!this.isCurrent(id)) return fail('not_your_turn');
    if (!this.awaitingDealChoice) return fail('no_deal_choice');
    const deck: DeckName = size === 'small' ? 'smallDeal' : 'bigDeal';
    this.pendingCard = this.decks.draw(deck);
    this.awaitingDealChoice = false;
    this.log(this.currentPlayer, `drew a ${size === 'small' ? 'Small' : 'Big'} Deal: ${this.pendingCard.heading ?? ''}`);
    return ok();
  }

  // ---------- Card actions ----------

  cardAction(id: string, action: string, payload: any = {}): ActionResult {
    if (!this.isCurrent(id)) return fail('not_your_turn');
    const p = this.currentPlayer;
    const card = this.pendingCard;
    if (!card) return fail('no_pending_card');

    switch (action) {
      case 'skip':
        this.log(p, `passed on ${card.heading ?? card.type}`);
        this.pendingCard = null;
        this.resolved = true;
        return ok();

      case 'buyRealEstate': {
        if (card.type !== 'realEstate') return fail('not_real_estate');
        if (!p.buyRealEstate(card)) return fail('insufficient_cash');
        this.log(p, `bought ${card.symbol} (+$${(card.cashFlow ?? 0).toLocaleString()}/mo)`);
        this.pendingCard = null;
        this.resolved = true;
        this.checkRatRaceExit();
        return ok();
      }

      case 'buyBusiness': {
        if (card.type !== 'business') return fail('not_business');
        if (!p.buyBusiness(card)) return fail('insufficient_cash');
        this.log(p, `bought business ${card.symbol} (+$${(card.cashFlow ?? 0).toLocaleString()}/mo)`);
        this.pendingCard = null;
        this.resolved = true;
        this.checkRatRaceExit();
        return ok();
      }

      case 'buyStocks': {
        if (card.type !== 'stock') return fail('not_stock');
        const count = Number(payload.count) || 0;
        if (!p.buyStocks(card, count)) return fail('insufficient_cash');
        this.log(p, `bought ${count} ${card.symbol} @ $${card.price}`);
        this.pendingCard = null;
        this.resolved = true;
        return ok();
      }

      case 'sellStocks': {
        if (card.type !== 'stock') return fail('not_stock');
        const count = Number(payload.count) || 0;
        if (!p.sellStocks(card, count)) return fail('cannot_sell');
        this.log(p, `sold ${count} ${card.symbol} @ $${card.price}`);
        this.pendingCard = null;
        this.resolved = true;
        return ok();
      }

      case 'buyGold': {
        if (card.type !== 'goldCoins') return fail('not_gold');
        if (!p.buyGoldCoins(card)) return fail('insufficient_cash');
        this.log(p, `bought ${card.count} gold coins`);
        this.pendingCard = null;
        this.resolved = true;
        return ok();
      }

      case 'sellGold': {
        const count = Number(payload.count) || 0;
        if (!p.sellGold(card, count)) return fail('cannot_sell');
        this.log(p, `sold ${count} gold coins`);
        this.pendingCard = null;
        this.resolved = true;
        return ok();
      }

      case 'sellRealEstate': {
        if (!p.sellRealEstate(card, String(payload.assetId))) return fail('cannot_sell');
        this.log(p, `sold real estate at market`);
        this.pendingCard = null;
        this.resolved = true;
        this.checkRatRaceExit();
        return ok();
      }

      case 'buyMlm': {
        if (card.type !== 'mlm') return fail('not_mlm');
        if (!p.buyMlm(card)) return fail('insufficient_cash');
        this.log(p, `joined ${card.symbol}`);
        this.pendingCard = null;
        this.resolved = true;
        return ok();
      }

      case 'acceptLottery': {
        if (card.type !== 'lottery') return fail('not_lottery');
        return this.resolveLottery(p, card);
      }

      default:
        return fail('unknown_action');
    }
  }

  private resolveLottery(p: Player, card: Card): ActionResult {
    const cost = card.cost ?? 0;
    if (card.lottery === 'money') {
      if (p.cash < cost) return fail('insufficient_cash');
      p.forcePay(cost, `Lottery ${card.symbol}`);
      const die = rollDie();
      const win = (card.success ?? []).includes(die);
      const payout = win ? card.outcome?.success ?? 0 : card.outcome?.failure ?? 0;
      if (payout > 0) p.forcePay(-payout, 'Lottery payout');
      this.log(p, `rolled ${die} on lottery — ${win ? `won $${payout.toLocaleString()}` : 'lost'}`);
    } else {
      // stock split / reverse-split for everyone holding the symbol
      const die = rollDie();
      const up = (card.success ?? []).includes(die);
      this.players.forEach((pl) => {
        const stock = pl.assets.stocks.find((s) => s.symbol === card.symbol);
        if (stock) stock.count = up ? stock.count * 2 : Math.ceil(stock.count / 2);
      });
      this.log(p, `${card.symbol} ${up ? 'split (×2)' : 'reverse split (÷2)'} on roll ${die}`);
    }
    this.pendingCard = null;
    this.resolved = true;
    return ok();
  }

  // ---------- Loans / rescue ----------

  takeLoan(id: string, amount: number): ActionResult {
    if (!this.isCurrent(id)) return fail('not_your_turn');
    const p = this.currentPlayer;
    if (!p.takeLoan(amount)) return fail('invalid_amount');
    this.log(p, `took a bank loan of $${amount.toLocaleString()}`);
    return ok();
  }

  payLoan(id: string, type: keyof Liabilities, amount: number): ActionResult {
    if (!this.isCurrent(id)) return fail('not_your_turn');
    const p = this.currentPlayer;
    if (!p.payLoan(amount, type)) return fail('cannot_pay');
    this.log(p, `paid down ${String(type)} by $${amount.toLocaleString()}`);
    return ok();
  }

  liquidate(id: string): ActionResult {
    if (!this.isCurrent(id)) return fail('not_your_turn');
    const p = this.currentPlayer;
    p.liquidateEverything();
    this.log(p, p.isBankrupt ? 'went bankrupt 💀' : 'liquidated assets to cover debt');
    if (p.isBankrupt) {
      this.resolved = true;
      this.advanceTurn();
    }
    return ok();
  }

  // ---------- Rat Race exit ----------

  private checkRatRaceExit(): void {
    const p = this.currentPlayer;
    if (p.phase === 'ratRace' && p.canExitRatRace() && !p.needsRescue()) {
      p.enterFastTrack();
      this.log(p, '🎉 escaped the Rat Race and entered the Fast Track!');
    }
  }

  // ---------- Fast Track ----------

  chooseDream(id: string, dreamId: string): ActionResult {
    const p = this.players.find((pl) => pl.id === id);
    if (!p) return fail('no_player');
    if (p.phase !== 'fastTrack') return fail('not_on_fast_track');
    if (!DREAMS.some((d) => d.id === dreamId)) return fail('invalid_dream');
    p.dreamId = dreamId;
    const dream = DREAMS.find((d) => d.id === dreamId)!;
    this.log(p, `chose the dream: ${dream.name}`);
    return ok();
  }

  private resolveFastTrackLanding(steps: number): void {
    const p = this.currentPlayer;
    p.moveFastTrack(steps, FAST_TRACK_SIZE);
    const tile = FAST_TRACK_BOARD[p.fastTrackPosition];

    switch (tile.kind) {
      case 'cashflowDay': {
        const amount = p.fastTrackPayday();
        this.log(p, `Fast Track cashflow day: +$${amount.toLocaleString()}`);
        this.resolved = true;
        break;
      }
      case 'charity': {
        const ok2 = p.charity();
        this.log(p, ok2 ? 'donated to charity (extra dice)' : 'could not afford charity');
        this.resolved = true;
        break;
      }
      case 'loss': {
        const paid = p.payFastTrackLoss(tile.amount ?? 0, !!tile.half, tile.name ?? 'Loss');
        this.log(p, `${tile.name} — paid $${paid.toLocaleString()}`);
        this.resolved = true;
        break;
      }
      case 'investment':
        this.pendingFastTrackTile = tile;
        this.log(p, `Investment: ${tile.name} — $${(tile.cost ?? 0).toLocaleString()} for +$${(tile.cashFlow ?? 0).toLocaleString()}/mo`);
        this.resolved = false;
        break;
      case 'dream':
        this.pendingFastTrackTile = tile;
        this.resolved = false;
        break;
      default:
        this.resolved = true;
    }
    this.checkFastTrackWin();
  }

  fastTrackAction(id: string, action: 'buy' | 'skip'): ActionResult {
    if (!this.isCurrent(id)) return fail('not_your_turn');
    const tile = this.pendingFastTrackTile;
    if (!tile) return fail('no_pending_tile');
    const p = this.currentPlayer;

    if (action === 'skip') {
      this.log(p, `passed on ${tile.name ?? tile.kind}`);
      this.pendingFastTrackTile = null;
      this.resolved = true;
      return ok();
    }

    if (tile.kind === 'investment') {
      if (!p.buyFastTrackInvestment(tile.cost ?? 0, tile.cashFlow ?? 0, tile.name ?? 'investment')) {
        return fail('insufficient_cash');
      }
      this.log(p, `invested in ${tile.name} (+$${(tile.cashFlow ?? 0).toLocaleString()}/mo cashflow)`);
      this.pendingFastTrackTile = null;
      this.resolved = true;
      this.checkFastTrackWin();
      return ok();
    }

    if (tile.kind === 'dream') {
      const dream = DREAMS.find((d) => d.id === tile.id);
      if (!dream) return fail('invalid_dream');
      if (p.dreamId !== dream.id) return fail('not_your_dream');
      if (p.cash < dream.cost) return fail('insufficient_cash');
      p.forcePay(dream.cost, `Bought dream: ${dream.name}`);
      this.win(p, `bought their dream: ${dream.name}`);
      this.pendingFastTrackTile = null;
      this.resolved = true;
      return ok();
    }

    return fail('unknown_action');
  }

  private checkFastTrackWin(): void {
    const p = this.currentPlayer;
    if (p.phase === 'fastTrack' && p.fastTrackCashFlowGain >= FAST_TRACK_CASHFLOW_GOAL) {
      this.win(p, `reached +$${FAST_TRACK_CASHFLOW_GOAL.toLocaleString()}/mo cash flow`);
    }
  }

  private win(p: Player, reason: string): void {
    p.hasWon = true;
    this.winnerId = p.id;
    this.status = 'finished';
    this.log(p, `🏆 WON the game — ${reason}`);
  }

  // ---------- Logging / state ----------

  private log(p: Player | undefined, message: string): void {
    this.logs.unshift({
      ts: Date.now(),
      player: p?.username ?? 'system',
      color: p?.color ?? '#888',
      message
    });
    if (this.logs.length > 100) this.logs.pop();
  }

  getState(): PublicGameState {
    const awaitingDreamChoice = this.players
      .filter((p) => p.phase === 'fastTrack' && !p.dreamId && !p.isBankrupt)
      .map((p) => p.id);
    return {
      roomId: this.roomId,
      status: this.status,
      players: this.players.map((p) => p.toPublic()),
      currentPlayerId: this.players.length ? this.currentPlayer.id : null,
      diceValues: this.diceValues,
      hasRolled: this.hasRolled,
      pendingCard: this.pendingCard,
      pendingFastTrackTile: this.pendingFastTrackTile,
      awaitingDealChoice: this.awaitingDealChoice,
      awaitingDreamChoice,
      logs: this.logs,
      winnerId: this.winnerId
    };
  }
}
