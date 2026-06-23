// ---------- Profession / Income statement ----------

export interface RealEstateAsset {
  id: string;
  type: 'realEstate';
  symbol: string;
  heading?: string;
  cost: number;
  mortgage: number;
  downPayment: number;
  cashFlow: number;
}

export interface BusinessAsset {
  id: string;
  type: 'business';
  symbol: string;
  heading?: string;
  cost: number;
  mortgage?: number;
  downPayment: number;
  cashFlow: number;
}

export interface StockHolding {
  id: string;
  type: 'stock';
  symbol: string;
  price: number; // average buy price
  count: number;
}

export interface PreciousMetalHolding {
  id: string;
  type: 'goldCoins';
  symbol: string;
  cost: number;
  count: number;
}

export interface Income {
  salary: number;
  realEstates: RealEstateAsset[];
  businesses?: BusinessAsset[];
}

export interface Expenses {
  taxes: number;
  homeMortgagePayment: number;
  schoolLoanPayment: number;
  carLoanPayment: number;
  creditCardPayment: number;
  otherExpenses: number;
  bankLoanPayment: number;
  perChildExpense: number;
}

export interface Assets {
  savings: number;
  preciousMetals: PreciousMetalHolding[];
  stocks: StockHolding[];
  realEstates: RealEstateAsset[];
  businesses: BusinessAsset[];
}

export interface Liabilities {
  homeMortgage: number;
  schoolLoans: number;
  carLoans: number;
  creditCardDebt: number;
  bankLoan: number;
  realEstates: RealEstateAsset[];
}

export interface Profession {
  profession: string;
  income: Income;
  babies: number;
  expenses: Expenses;
  assets: Assets;
  liabilities: Liabilities;
}

// ---------- Cards ----------

export type CardType =
  | 'realEstate'
  | 'business'
  | 'stock'
  | 'goldCoins'
  | 'lottery'
  | 'mlm'
  | 'damage'
  | 'doodad'
  | 'payday'
  | 'charity'
  | 'downsized'
  | 'baby';

export interface Card {
  id: string;
  type: CardType;
  symbol?: string;
  heading?: string;
  description?: string;
  rule?: string;
  subRule?: string[];
  // money
  cost?: number;
  price?: number;
  range?: [number, number];
  mortgage?: number;
  downPayment?: number;
  cashFlow?: number;
  count?: number;
  // lottery
  lottery?: 'money' | 'stock';
  success?: number[];
  failure?: number[];
  outcome?: { success: number; failure: number };
  // doodad
  isConditional?: boolean;
  // market
  value?: number; // % gain for realEstate sale, or fixed if plus
  plus?: boolean;
  applicableToEveryOne?: boolean;
  // derived
  family?: string;
  name?: string;
}

export type DeckName =
  | 'smallDeal'
  | 'bigDeal'
  | 'doodad'
  | 'market'
  | 'payday'
  | 'charity'
  | 'downsized'
  | 'baby';

export type Deck = Record<DeckName, Card[]>;

// ---------- Rat Race board ----------

export type TileType =
  | 'deal'
  | 'payday'
  | 'market'
  | 'doodad'
  | 'charity'
  | 'downsized'
  | 'baby';

// ---------- Fast Track board ----------

export type FastTrackTileKind =
  | 'cashflowDay'
  | 'investment'
  | 'dream'
  | 'charity'
  | 'loss'
  | 'doodad';

export interface FastTrackTile {
  index: number;
  kind: FastTrackTileKind;
  id?: string;
  name?: string;
  nameTh?: string;
  cost?: number;
  downPayment?: number; // L7: pay down payment (instead of full cost) for FT investments
  cashFlow?: number; // monthly cashflow gained when bought (investment)
  amount?: number; // loss amount, or 'half' marker via half flag
  half?: boolean; // loss = half of cash
  full?: boolean; // loss = all of cash (e.g. Divorce)
}

export interface Dream {
  id: string;
  name: string;
  nameTh: string;
  cost: number;
}

// ---------- Public (serialized) state sent to clients ----------

export interface LedgerEntry {
  amount: number;
  balance: number;
  description: string;
}

export interface PublicPlayer {
  id: string;
  username: string;
  color: string;
  isHost: boolean;
  connected: boolean;
  professionName: string;
  // income statement
  salary: number;
  passiveIncome: number;
  totalIncome: number;
  totalExpenses: number;
  cashFlow: number;
  cash: number;
  babies: number;
  income: Income;
  expenses: Expenses;
  assets: Assets;
  liabilities: Liabilities;
  ledger: LedgerEntry[];
  // board state
  position: number;
  phase: 'ratRace' | 'fastTrack';
  fastTrackPosition: number;
  fastTrackIncome: number; // monthly income while on fast track
  fastTrackCashFlowGain: number; // progress toward +50,000 win
  dreamId: string | null;
  // turn helpers
  skippedTurns: number;
  extraDiceTurns: number; // charity: roll 1 or 2 dice for next N turns
  hasMlm: boolean;
  ftCharityDice: boolean;
  isBankrupt: boolean;
  hasWon: boolean;
}

export type GamePhaseStatus = 'lobby' | 'started' | 'finished';

export interface PublicGameState {
  roomId: string;
  status: GamePhaseStatus;
  difficulty: 'normal' | 'easy';
  players: PublicPlayer[];
  currentPlayerId: string | null;
  diceValues: number[];
  hasRolled: boolean;
  pendingCard: Card | null;
  pendingFastTrackTile: FastTrackTile | null;
  awaitingDealChoice: boolean; // landed on a deal tile, choose small/big
  awaitingDreamChoice: string[]; // player ids that must pick a dream
  awaitingFastTrackChoice: string | null; // current player may choose to enter Fast Track
  dreamMarkers: Record<string, number>; // extra-cost markers per dream id
  logs: { ts: number; player: string; color: string; code: string; params: Record<string, unknown> }[];
  winnerId: string | null;
}
