import type {
  Profession,
  Card,
  Income,
  Expenses,
  Assets,
  Liabilities,
  LedgerEntry,
  PublicPlayer,
  RealEstateAsset,
  StockHolding,
  PreciousMetalHolding
} from './types.js';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/**
 * Coarse real-estate "category" for matching a Market buyer card to an owned
 * property. The card data uses inconsistent symbols (4-PLEX/8-PLEX vs a "PLEX"
 * buyer; "3Br/2Ba" vs "3Br/2ba"), so we normalise. Returns null for property
 * types that have NO dedicated buyer card (apartment UNITS, DUPLEX, …) — those
 * stay sellable by any buyer so they are never stranded (avoids a regression).
 */
export const reCategory = (symbol: string | undefined): string | null => {
  const s = (symbol ?? '').toLowerCase();
  if (s.includes('plex')) return 'plex';
  if (s.includes('2br/1ba')) return '2br/1ba';
  if (s.includes('3br/2ba')) return '3br/2ba';
  return null;
};

const LOAN_EXPENSE_FIELD: Record<string, keyof Expenses> = {
  homeMortgage: 'homeMortgagePayment',
  schoolLoans: 'schoolLoanPayment',
  carLoans: 'carLoanPayment',
  creditCardDebt: 'creditCardPayment'
};

export class Player {
  id: string;
  username: string;
  color: string;
  isHost: boolean;
  connected = true;

  professionName: string;
  income: Income;
  expenses: Expenses;
  assets: Assets;
  liabilities: Liabilities;
  babies: number;

  cash: number;
  ledger: LedgerEntry[] = [];

  position = 0;
  lastPosition = 0;
  phase: 'ratRace' | 'fastTrack' = 'ratRace';

  fastTrackPosition = 0;
  fastTrackIncome = 0;
  fastTrackCashFlowGain = 0;
  ownedInvestments = new Set<string>();
  dreamId: string | null = null;

  skippedTurns = 0;
  extraDiceTurns = 0; // charity bonus: may roll 1 or 2 dice
  hasMlm = false;
  ftCharityDice = false; // Fast Track charity: may roll 1/2/3 dice for the rest of the game
  isBankrupt = false;
  hasWon = false;

  constructor(id: string, username: string, color: string, isHost: boolean, profession: Profession) {
    this.id = id;
    this.username = username;
    this.color = color;
    this.isHost = isHost;

    const p = clone(profession);
    this.professionName = p.profession;
    this.income = { salary: p.income.salary, realEstates: [], businesses: [] };
    this.expenses = p.expenses;
    this.assets = {
      savings: p.assets.savings,
      preciousMetals: [],
      stocks: [],
      realEstates: [],
      businesses: []
    };
    this.liabilities = { ...p.liabilities, realEstates: [] };
    this.babies = p.babies;
    this.cash = p.assets.savings;
  }

  // ---------- Income statement ----------

  get passiveIncome(): number {
    const realEstate = this.assets.realEstates.reduce((s, r) => s + r.cashFlow, 0);
    const business = this.assets.businesses.reduce((s, b) => s + b.cashFlow, 0);
    return realEstate + business;
  }

  get totalIncome(): number {
    return this.income.salary + this.passiveIncome;
  }

  get totalExpenses(): number {
    const e = this.expenses;
    return (
      e.taxes +
      e.homeMortgagePayment +
      e.schoolLoanPayment +
      e.carLoanPayment +
      e.creditCardPayment +
      e.otherExpenses +
      e.bankLoanPayment +
      this.babies * e.perChildExpense
    );
  }

  get cashFlow(): number {
    return this.totalIncome - this.totalExpenses;
  }

  /** Goal of the Rat Race: passive income exceeds total expenses. */
  canExitRatRace(): boolean {
    return this.passiveIncome > this.totalExpenses;
  }

  private record(amount: number, description: string) {
    this.cash += amount;
    this.ledger.unshift({ amount, balance: this.cash, description });
  }

  // ---------- Rat Race actions ----------

  payday(): number {
    const amount = this.cashFlow;
    this.record(amount, 'Payday');
    return amount;
  }

  /**
   * MLM passive income. The MLM card says: every payday roll 1 die, on 4–6
   * collect $500. The Game rolls the die (it owns randomness) and passes the
   * win/loss; here we just credit the payout. No-op for players without MLM.
   */
  mlmPayout(win: boolean): number {
    if (!this.hasMlm) return 0;
    const amount = win ? 500 : 0;
    if (amount) this.record(amount, 'MLM income');
    return amount;
  }

  /**
   * Doodads are mandatory; cash may go negative and require a rescue.
   * On Easy difficulty, an unaffordable doodad is capped at 50% of current
   * cash so a single bad draw can't wipe out a thin bankroll.
   */
  doodad(card: Card, difficulty: 'normal' | 'easy' = 'normal'): 'skip' | 'ok' | { capped: true; paid: number } {
    if (card.isConditional && this.babies <= 0) return 'skip';
    let cost = card.cost ?? 0;
    let capped = false;
    if (difficulty === 'easy' && this.cash > 0 && cost > this.cash / 2) {
      cost = Math.round(this.cash / 2);
      capped = true;
    }
    this.record(-cost, card.heading ?? 'Doodad');
    return capped ? { capped: true, paid: cost } : 'ok';
  }

  /** Charity is optional and only allowed when affordable. */
  charity(): boolean {
    const amount = Math.round(0.1 * this.totalIncome);
    if (this.cash < amount) return false;
    this.record(-amount, 'Charity');
    this.extraDiceTurns = 3;
    return true;
  }

  /** Downsized is mandatory: pay total expenses (or half on Easy) and lose turns. */
  downsized(difficulty: 'normal' | 'easy' = 'normal'): number {
    const full = this.totalExpenses;
    const amount = difficulty === 'easy' ? Math.round(full / 2) : full;
    this.record(-amount, 'Downsized');
    this.skippedTurns = difficulty === 'easy' ? 1 : 2;
    this.extraDiceTurns = 0; // Downsized ends the Charity dice bonus
    return amount;
  }

  /** Generic mandatory debit (used for rescues / forced costs). */
  forcePay(amount: number, description: string): void {
    this.record(-amount, description);
  }

  baby(): boolean {
    if (this.babies >= 3) return false;
    this.babies += 1;
    return true;
  }

  // ---------- Buying / selling ----------

  buyRealEstate(card: Card): boolean {
    const down = card.downPayment ?? 0;
    if (this.cash < down) return false;
    const asset: RealEstateAsset = {
      id: card.id,
      type: 'realEstate',
      symbol: card.symbol ?? 'property',
      heading: card.heading,
      cost: card.cost ?? 0,
      mortgage: card.mortgage ?? 0,
      downPayment: down,
      cashFlow: card.cashFlow ?? 0
    };
    this.assets.realEstates.push(asset);
    this.income.realEstates.push(asset);
    this.liabilities.realEstates.push(asset);
    this.record(-down, `Buy ${asset.symbol}`);
    return true;
  }

  buyBusiness(card: Card): boolean {
    const down = card.downPayment ?? card.cost ?? 0;
    if (this.cash < down) return false;
    const asset = {
      id: card.id,
      type: 'business' as const,
      symbol: card.symbol ?? 'business',
      heading: card.heading,
      cost: card.cost ?? 0,
      mortgage: card.mortgage ?? 0,
      downPayment: down,
      cashFlow: card.cashFlow ?? 0
    };
    this.assets.businesses.push(asset);
    this.income.businesses!.push(asset);
    if (asset.mortgage) this.liabilities.realEstates.push(asset as unknown as RealEstateAsset);
    this.record(-down, `Buy ${asset.symbol}`);
    return true;
  }

  buyStocks(card: Card, count: number): boolean {
    const price = card.price ?? 0;
    const total = price * count;
    if (count <= 0 || this.cash < total) return false;
    const existing = this.assets.stocks.find((s) => s.symbol === card.symbol);
    if (existing) {
      const totalCount = existing.count + count;
      existing.price = (existing.price * existing.count + total) / totalCount;
      existing.count = totalCount;
    } else {
      const stock: StockHolding = {
        id: card.id,
        type: 'stock',
        symbol: card.symbol ?? 'STOCK',
        price,
        count
      };
      this.assets.stocks.push(stock);
    }
    this.record(-total, `Buy ${count} ${card.symbol}`);
    return true;
  }

  sellStocks(card: Card, count: number): boolean {
    const stock = this.assets.stocks.find((s) => s.symbol === card.symbol);
    if (!stock || stock.count < count || count <= 0) return false;
    const price = card.price ?? stock.price;
    stock.count -= count;
    this.record(price * count, `Sell ${count} ${card.symbol}`);
    if (stock.count <= 0) {
      this.assets.stocks = this.assets.stocks.filter((s) => s !== stock);
    }
    return true;
  }

  buyGoldCoins(card: Card): boolean {
    const cost = card.cost ?? 0;
    if (this.cash < cost) return false;
    const holding: PreciousMetalHolding = {
      id: card.id,
      type: 'goldCoins',
      symbol: card.symbol ?? 'gold',
      cost: card.cost ?? 0,
      count: card.count ?? 1
    };
    this.assets.preciousMetals.push(holding);
    this.record(-cost, `Buy ${holding.count} gold coins`);
    return true;
  }

  buyMlm(card: Card): boolean {
    const cost = card.cost ?? 0;
    if (this.cash < cost) return false;
    this.record(-cost, `Buy ${card.symbol ?? 'MLM'}`);
    this.hasMlm = true;
    return true;
  }

  /** Real estate market sale: card.value is a % gain (or fixed $ if plus). */
  sellRealEstate(card: Card, id: string): boolean {
    const idx = this.assets.realEstates.findIndex((r) => r.id === id);
    if (idx < 0) return false;
    const re = this.assets.realEstates[idx];
    // A Market buyer is property-type specific: a "Plex Buyer" may only buy a plex,
    // not a 2Br house, so it can't snap up the wrong property at the wrong gain.
    // Only enforced when BOTH symbols map to a known category (un-targeted types
    // stay sellable by any buyer — see reCategory).
    const buyerCat = reCategory(card.symbol);
    const assetCat = reCategory(re.symbol);
    if (buyerCat && assetCat && buyerCat !== assetCat) return false;
    const gain = card.plus ? card.value ?? 0 : (re.cost * (card.value ?? 0)) / 100;
    const proceeds = re.cost + gain - re.mortgage;
    this.assets.realEstates.splice(idx, 1);
    this.income.realEstates = this.income.realEstates.filter((r) => r.id !== id);
    this.liabilities.realEstates = this.liabilities.realEstates.filter((r) => r.id !== id);
    this.record(proceeds, `Sell ${re.symbol}`);
    return true;
  }

  /** Business market sale: card.value is a % gain (or fixed $ if plus), like RE.
   *  Selling discharges the business's mortgage and gives up its cash flow. */
  sellBusiness(card: Card, id: string): boolean {
    const idx = this.assets.businesses.findIndex((b) => b.id === id);
    if (idx < 0) return false;
    const biz = this.assets.businesses[idx];
    const gain = card.plus ? card.value ?? 0 : (biz.cost * (card.value ?? 0)) / 100;
    const proceeds = biz.cost + gain - (biz.mortgage ?? 0);
    this.assets.businesses.splice(idx, 1);
    this.income.businesses = (this.income.businesses ?? []).filter((b) => b.id !== id);
    this.liabilities.realEstates = this.liabilities.realEstates.filter((b) => b.id !== id);
    this.record(proceeds, `Sell ${biz.symbol}`);
    return true;
  }

  sellGold(card: Card, count: number): boolean {
    const holding = this.assets.preciousMetals.find((g) => g.symbol === card.symbol);
    if (!holding || holding.count < count || count <= 0) return false;
    holding.count -= count;
    this.record((card.cost ?? 0) * count, `Sell ${count} gold coins`);
    if (holding.count <= 0) {
      this.assets.preciousMetals = this.assets.preciousMetals.filter((g) => g !== holding);
    }
    return true;
  }

  payDamages(card: Card): 'paid' | 'noRealEstate' | 'insufficient' {
    if (this.assets.realEstates.length === 0) return 'noRealEstate';
    const cost = card.cost ?? 0;
    if (this.cash < cost) return 'insufficient';
    this.record(-cost, card.heading ?? 'Property damage');
    return 'paid';
  }

  // ---------- Loans ----------

  takeLoan(amount: number): boolean {
    if (amount <= 0 || amount % 1000 !== 0) return false;
    this.liabilities.bankLoan += amount;
    this.expenses.bankLoanPayment = this.liabilities.bankLoan / 10;
    this.record(amount, `Bank loan $${amount}`);
    return true;
  }

  payLoan(amount: number, type: keyof Liabilities): boolean {
    if (typeof this.liabilities[type] !== 'number') return false;
    const debt = this.liabilities[type] as number;
    if (amount <= 0 || amount > debt || this.cash < amount) return false;
    if (type === 'bankLoan') {
      if (amount % 1000 !== 0) return false; // bank loans repay in $1,000 units
    } else if (amount !== debt) {
      return false; // non-bank debts must be paid in full
    }
    (this.liabilities[type] as number) -= amount;
    if (type === 'bankLoan') {
      this.expenses.bankLoanPayment = this.liabilities.bankLoan / 10;
    } else if (this.liabilities[type] === 0 && LOAN_EXPENSE_FIELD[type]) {
      this.expenses[LOAN_EXPENSE_FIELD[type]] = 0;
    }
    this.record(-amount, `Pay ${type}`);
    return true;
  }

  // ---------- Bankruptcy ----------

  /** Player is in trouble when cash would go negative even after a payday. */
  needsRescue(): boolean {
    return this.cash < 0;
  }

  liquidateEverything(): void {
    let proceeds = 0;
    this.assets.realEstates.forEach((r) => (proceeds += r.downPayment / 2));
    this.assets.businesses.forEach((b) => (proceeds += b.downPayment / 2));
    this.assets.preciousMetals.forEach((g) => (proceeds += (g.cost * g.count) / 2));
    this.assets.stocks.forEach((s) => (proceeds += (s.price * s.count) / 2));
    this.assets.realEstates = [];
    this.assets.businesses = [];
    this.assets.preciousMetals = [];
    this.assets.stocks = [];
    this.income.realEstates = [];
    this.income.businesses = [];
    // Selling a property/business also discharges its mortgage — don't leave a
    // ghost liability on the balance sheet for assets that no longer exist.
    this.liabilities.realEstates = [];
    this.record(Math.round(proceeds), 'Liquidated all assets');
    if (this.cash < 0) {
      // Debt relief: the bank forgives half of consumer debt (car + credit) and
      // halves their monthly payments. Mortgage and school loans remain.
      this.liabilities.carLoans = Math.round(this.liabilities.carLoans / 2);
      this.liabilities.creditCardDebt = Math.round(this.liabilities.creditCardDebt / 2);
      this.expenses.carLoanPayment = Math.round(this.expenses.carLoanPayment / 2);
      this.expenses.creditCardPayment = Math.round(this.expenses.creditCardPayment / 2);
    }
    if (this.cash < 0) this.isBankrupt = true;
  }

  // ---------- Movement ----------

  move(steps: number): void {
    this.lastPosition = this.position;
    let pos = (this.position + steps) % 24;
    if (pos === 0) pos = 24;
    this.position = pos;
  }

  // ---------- Fast Track ----------

  enterFastTrack(): void {
    this.phase = 'fastTrack';
    this.fastTrackPosition = 0;
    this.fastTrackIncome = this.passiveIncome * 100;
    this.fastTrackCashFlowGain = 0;
    this.record(this.passiveIncome * 100, 'Fast Track bonus (passive income ×100)');
  }

  moveFastTrack(steps: number, size: number): void {
    this.fastTrackPosition = (this.fastTrackPosition + steps) % size;
  }

  fastTrackPayday(): number {
    const amount = this.fastTrackIncome + this.fastTrackCashFlowGain;
    this.record(amount, 'Fast Track cashflow day');
    return amount;
  }

  buyFastTrackInvestment(cost: number, cashFlow: number, name: string, id: string, downPayment?: number): boolean {
    const paid = downPayment ?? cost; // L7: use down payment if provided
    if (this.ownedInvestments.has(id)) return false;
    if (this.cash < paid) return false;
    this.record(-paid, `Invest: ${name}`);
    this.fastTrackCashFlowGain += cashFlow;
    this.ownedInvestments.add(id);
    return true;
  }

  payFastTrackLoss(amount: number, half: boolean, label: string, full = false): number {
    const pay = full ? this.cash : half ? Math.round(this.cash / 2) : amount;
    this.record(-pay, label);
    return pay;
  }

  // ---------- Serialization ----------

  toPublic(): PublicPlayer {
    return {
      id: this.id,
      username: this.username,
      color: this.color,
      isHost: this.isHost,
      connected: this.connected,
      professionName: this.professionName,
      salary: this.income.salary,
      passiveIncome: this.passiveIncome,
      totalIncome: this.totalIncome,
      totalExpenses: this.totalExpenses,
      cashFlow: this.cashFlow,
      cash: this.cash,
      babies: this.babies,
      income: this.income,
      expenses: this.expenses,
      assets: this.assets,
      liabilities: this.liabilities,
      ledger: this.ledger,
      position: this.position,
      phase: this.phase,
      fastTrackPosition: this.fastTrackPosition,
      fastTrackIncome: this.fastTrackIncome,
      fastTrackCashFlowGain: this.fastTrackCashFlowGain,
      dreamId: this.dreamId,
      skippedTurns: this.skippedTurns,
      extraDiceTurns: this.extraDiceTurns,
      hasMlm: this.hasMlm,
      ftCharityDice: this.ftCharityDice,
      isBankrupt: this.isBankrupt,
      hasWon: this.hasWon
    };
  }

  /** Full snapshot for persistence (includes private/runtime fields). */
  toState(): Record<string, unknown> {
    return {
      id: this.id,
      username: this.username,
      color: this.color,
      isHost: this.isHost,
      connected: this.connected,
      professionName: this.professionName,
      income: this.income,
      expenses: this.expenses,
      assets: this.assets,
      liabilities: this.liabilities,
      babies: this.babies,
      cash: this.cash,
      ledger: this.ledger,
      position: this.position,
      lastPosition: this.lastPosition,
      phase: this.phase,
      fastTrackPosition: this.fastTrackPosition,
      fastTrackIncome: this.fastTrackIncome,
      fastTrackCashFlowGain: this.fastTrackCashFlowGain,
      ownedInvestments: [...this.ownedInvestments],
      dreamId: this.dreamId,
      skippedTurns: this.skippedTurns,
      extraDiceTurns: this.extraDiceTurns,
      hasMlm: this.hasMlm,
      ftCharityDice: this.ftCharityDice,
      isBankrupt: this.isBankrupt,
      hasWon: this.hasWon
    };
  }

  static fromState(s: any): Player {
    const p: Player = Object.create(Player.prototype);
    Object.assign(p, s);
    p.ownedInvestments = new Set<string>(s.ownedInvestments || []);
    return p;
  }
}
