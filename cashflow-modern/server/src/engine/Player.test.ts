import { describe, it, expect } from 'vitest';
import { makePlayer } from './test-helpers.js';

describe('Player income statement (baseline)', () => {
  it('computes totalExpenses, cashFlow, and starting cash', () => {
    const p = makePlayer();
    expect(p.totalExpenses).toBe(1500); // 400+300+0+100+100+600+0 + 0*200
    expect(p.totalIncome).toBe(3000); // salary 3000 + passive 0
    expect(p.cashFlow).toBe(1500);
    expect(p.cash).toBe(1000); // CURRENT behavior: cash = savings only (changes in Task 2)
  });
});

describe('Downsized cancels charity (M9)', () => {
  it('resets extraDiceTurns to 0', () => {
    const p = makePlayer();
    p.charity(); // sets extraDiceTurns = 3
    expect(p.extraDiceTurns).toBe(3);
    p.downsized();
    expect(p.extraDiceTurns).toBe(0);
  });
});

describe('Fast Track investment de-dup (C2)', () => {
  it('records ownership and refuses a second buy of the same tile', () => {
    const p = makePlayer();
    p.cash = 1_000_000;
    expect(p.buyFastTrackInvestment(200000, 20000, 'Software', 'software')).toBe(true);
    expect(p.ownedInvestments.has('software')).toBe(true);
    expect(p.buyFastTrackInvestment(200000, 20000, 'Software', 'software')).toBe(false);
    expect(p.fastTrackCashFlowGain).toBe(20000); // only counted once
  });
});

describe('Fast Track investment downPayment (L7)', () => {
  it('uses downPayment instead of full cost when provided', () => {
    const p = makePlayer();
    p.cash = 1_000_000;
    // full cost 200k but down 50k
    expect(p.buyFastTrackInvestment(200000, 20000, 'Software', 'software', 50000)).toBe(true);
    expect(p.cash).toBe(950000); // deducted only 50k
    expect(p.fastTrackCashFlowGain).toBe(20000);
  });
});

describe('Fast Track losses (M1)', () => {
  it('full=true takes all cash; half=true takes half', () => {
    const p = makePlayer();
    p.cash = 80000;
    expect(p.payFastTrackLoss(0, false, 'Divorce', true)).toBe(80000);
    expect(p.cash).toBe(0);
    p.cash = 60000;
    expect(p.payFastTrackLoss(0, true, 'Lawsuit')).toBe(30000);
    expect(p.cash).toBe(30000);
  });
});

describe('Mortgage recorded as liability (C6)', () => {
  it('pushes the bought property into liabilities.realEstates', () => {
    const p = makePlayer();
    p.cash = 100000;
    p.buyRealEstate({ id: 're1', type: 'realEstate', symbol: 'duplex', cost: 60000, mortgage: 48000, downPayment: 12000, cashFlow: 300 } as any);
    expect(p.liabilities.realEstates.length).toBe(1);
    expect(p.liabilities.realEstates[0].mortgage).toBe(48000);
  });
});

describe('Bankruptcy debt relief (H2)', () => {
  it('halves car loan + credit card (and payments), keeps mortgage, before bankrupt', () => {
    const p = makePlayer(); // carLoans 5000, creditCardDebt 3000, homeMortgage 30000
    p.expenses.carLoanPayment = 100;
    p.expenses.creditCardPayment = 100;
    p.cash = -2000; // negative and no assets to sell
    p.liquidateEverything();
    expect(p.liabilities.carLoans).toBe(2500);
    expect(p.liabilities.creditCardDebt).toBe(1500);
    expect(p.expenses.carLoanPayment).toBe(50);
    expect(p.expenses.creditCardPayment).toBe(50);
    expect(p.liabilities.homeMortgage).toBe(30000); // untouched
    expect(p.isBankrupt).toBe(true); // still negative cash → out
  });
});

describe('Loan repayment rules (M7 + L5)', () => {
  it('non-bank debt must be paid in full; bank loan in $1000 units', () => {
    const p = makePlayer(); // carLoans 5000
    p.cash = 100000;
    expect(p.payLoan(2000, 'carLoans')).toBe(false); // partial rejected
    expect(p.payLoan(5000, 'carLoans')).toBe(true); // full ok
    expect(p.liabilities.carLoans).toBe(0);
    expect(p.expenses.carLoanPayment).toBe(0);

    p.takeLoan(3000); // bankLoan 3000
    expect(p.payLoan(500, 'bankLoan')).toBe(false); // not a $1000 unit
    expect(p.payLoan(1000, 'bankLoan')).toBe(true);
    expect(p.liabilities.bankLoan).toBe(2000);
  });
});
