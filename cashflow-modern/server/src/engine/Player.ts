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

  /** Doodads are mandatory; cash may go negative and require a rescue. */
  doodad(card: Card): 'ok' | 'skip' {
    const cost = card.cost ?? 0;
    if (card.isConditional && this.babies <= 0) return 'skip';
    this.record(-cost, card.heading ?? 'Doodad');
    return 'ok';
  }

  /** Charity is optional and only allowed when affordable. */
  charity(): boolean {
    const amount = Math.round(0.1 * this.totalIncome);
    if (this.cash < amount) return false;
    this.record(-amount, 'Charity');
    this.extraDiceTurns = 3;
    return true;
  }

  /** Downsized is mandatory: pay total expenses and lose 2 turns. */
  downsized(): number {
    const amount = this.totalExpenses;
    this.record(-amount, 'Downsized');
    this.skippedTurns = 2;
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
    const gain = card.plus ? card.value ?? 0 : (re.cost * (card.value ?? 0)) / 100;
    const proceeds = re.cost + gain - re.mortgage;
    this.assets.realEstates.splice(idx, 1);
    this.income.realEstates = this.income.realEstates.filter((r) => r.id !== id);
    this.record(proceeds, `Sell ${re.symbol}`);
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
    this.record(Math.round(proceeds), 'Liquidated all assets');
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

  buyFastTrackInvestment(cost: number, cashFlow: number, name: string): boolean {
    if (this.cash < cost) return false;
    this.record(-cost, `Invest: ${name}`);
    this.fastTrackCashFlowGain += cashFlow;
    return true;
  }

  payFastTrackLoss(amount: number, half: boolean, label: string): number {
    const pay = half ? Math.round(this.cash / 2) : amount;
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
