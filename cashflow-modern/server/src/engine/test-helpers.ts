import type { Profession } from './types.js';
import { Player } from './Player.js';

/** Deterministic profession: cashFlow = 3000 - 1500 = 1500; savings 1000. */
export const makeProfession = (overrides: Partial<Profession> = {}): Profession => ({
  profession: 'Tester',
  income: { salary: 3000, realEstates: [], businesses: [] },
  babies: 0,
  expenses: {
    taxes: 400,
    homeMortgagePayment: 300,
    schoolLoanPayment: 0,
    carLoanPayment: 100,
    creditCardPayment: 100,
    otherExpenses: 600,
    bankLoanPayment: 0,
    perChildExpense: 200
  },
  assets: { savings: 1000, preciousMetals: [], stocks: [], realEstates: [], businesses: [] },
  liabilities: { homeMortgage: 30000, schoolLoans: 0, carLoans: 5000, creditCardDebt: 3000, bankLoan: 0, realEstates: [] },
  ...overrides
});

export const makePlayer = (overrides: Partial<Profession> = {}): Player =>
  new Player('p1', 'Tester', '#fff', true, makeProfession(overrides));
