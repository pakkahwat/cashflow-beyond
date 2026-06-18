// Mirrors the server's serialized state (server/src/engine/types.ts).

export interface Card {
  id: string;
  type: string;
  symbol?: string;
  heading?: string;
  description?: string;
  rule?: string;
  subRule?: string[];
  cost?: number;
  price?: number;
  range?: [number, number];
  mortgage?: number;
  downPayment?: number;
  cashFlow?: number;
  count?: number;
  lottery?: 'money' | 'stock';
  success?: number[];
  failure?: number[];
  outcome?: { success: number; failure: number };
  isConditional?: boolean;
  value?: number;
  plus?: boolean;
  applicableToEveryOne?: boolean;
}

export interface FastTrackTile {
  index: number;
  kind: 'cashflowDay' | 'investment' | 'dream' | 'charity' | 'loss' | 'doodad';
  id?: string;
  name?: string;
  nameTh?: string;
  cost?: number;
  cashFlow?: number;
  amount?: number;
  half?: boolean;
}

export interface Dream {
  id: string;
  name: string;
  nameTh: string;
  cost: number;
}

export interface LedgerEntry {
  amount: number;
  balance: number;
  description: string;
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

export interface PublicPlayer {
  id: string;
  username: string;
  color: string;
  isHost: boolean;
  connected: boolean;
  professionName: string;
  salary: number;
  passiveIncome: number;
  totalIncome: number;
  totalExpenses: number;
  cashFlow: number;
  cash: number;
  babies: number;
  income: { salary: number; realEstates: any[]; businesses?: any[] };
  expenses: Expenses;
  assets: {
    savings: number;
    preciousMetals: any[];
    stocks: any[];
    realEstates: any[];
    businesses: any[];
  };
  liabilities: {
    homeMortgage: number;
    schoolLoans: number;
    carLoans: number;
    creditCardDebt: number;
    bankLoan: number;
    realEstates: any[];
  };
  ledger: LedgerEntry[];
  position: number;
  phase: 'ratRace' | 'fastTrack';
  fastTrackPosition: number;
  fastTrackIncome: number;
  fastTrackCashFlowGain: number;
  dreamId: string | null;
  skippedTurns: number;
  extraDiceTurns: number;
  hasMlm: boolean;
  ftCharityDice: boolean;
  isBankrupt: boolean;
  hasWon: boolean;
}

export interface GameState {
  roomId: string;
  status: 'lobby' | 'started' | 'finished';
  players: PublicPlayer[];
  currentPlayerId: string | null;
  diceValues: number[];
  hasRolled: boolean;
  pendingCard: Card | null;
  pendingFastTrackTile: FastTrackTile | null;
  awaitingDealChoice: boolean;
  awaitingDreamChoice: string[];
  awaitingFastTrackChoice: string | null;
  dreamMarkers?: Record<string, number>;
  logs: { ts: number; player: string; color: string; message: string }[];
  winnerId: string | null;
}
