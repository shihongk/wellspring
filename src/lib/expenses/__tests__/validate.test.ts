import { describe, it, expect } from 'vitest';
import { validateBalanceContinuity } from '@/lib/expenses/validate';
import type { ExpenseTransaction } from '@/types';

function makeTx(overrides: Partial<ExpenseTransaction> & { id: string }): ExpenseTransaction {
  return {
    date: '2026-03-01',
    postDate: '2026-03-01',
    description: 'TXN',
    amount: 10,
    direction: 'debit',
    balance: 100,
    account: 'UOB One',
    category: 'Other',
    sourceFile: 'test.pdf',
    ...overrides,
  };
}

describe('validateBalanceContinuity', () => {
  it('returns no issues for a clean sequence', () => {
    const txs = [
      makeTx({ id: 'a', date: '2026-03-01', direction: 'debit', amount: 10, balance: 990 }),
      makeTx({ id: 'b', date: '2026-03-02', direction: 'debit', amount: 5, balance: 985 }),
      makeTx({ id: 'c', date: '2026-03-03', direction: 'credit', amount: 100, balance: 1085 }),
    ];

    expect(validateBalanceContinuity(txs)).toEqual([]);
  });

  it('flags a dropped-digit balance mid-sequence with the correct expected value', () => {
    const txs = [
      makeTx({ id: 'a', date: '2026-03-01', direction: 'debit', amount: 10, balance: 1000 }),
      // classic OCR bug: 982.39 misread as 82.39 (leading digit dropped)
      makeTx({ id: 'b', date: '2026-03-02', direction: 'debit', amount: 17.61, balance: 82.39 }),
    ];

    const issues = validateBalanceContinuity(txs);

    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('b');
    expect(issues[0].prevId).toBe('a');
    expect(issues[0].expectedBalance).toBeCloseTo(982.39, 5);
    expect(issues[0].actualBalance).toBe(82.39);
  });

  it('adds the amount for credit transactions', () => {
    const txs = [
      makeTx({ id: 'a', date: '2026-03-01', direction: 'credit', amount: 100, balance: 100 }),
      makeTx({ id: 'b', date: '2026-03-02', direction: 'credit', amount: 50, balance: 150 }),
    ];

    expect(validateBalanceContinuity(txs)).toEqual([]);
  });

  it('subtracts the amount for debit transactions', () => {
    const txs = [
      makeTx({ id: 'a', date: '2026-03-01', direction: 'debit', amount: 100, balance: 900 }),
      makeTx({ id: 'b', date: '2026-03-02', direction: 'debit', amount: 50, balance: 850 }),
    ];

    expect(validateBalanceContinuity(txs)).toEqual([]);
  });

  it('flags a debit row when the balance does not decrease by the amount', () => {
    const txs = [
      makeTx({ id: 'a', date: '2026-03-01', direction: 'debit', amount: 100, balance: 900 }),
      makeTx({ id: 'b', date: '2026-03-02', direction: 'debit', amount: 50, balance: 800 }), // expected 850
    ];

    const issues = validateBalanceContinuity(txs);

    expect(issues).toHaveLength(1);
    expect(issues[0].expectedBalance).toBe(850);
    expect(issues[0].actualBalance).toBe(800);
  });

  it('preserves original array order for same-date rows (a sort-by-date-only would break this)', () => {
    // Same date for all three; statement order is a(100) -> b(90, -10) -> c(70, -20).
    // If rows were re-ordered (e.g. by id, or by amount) the walk would produce
    // different expected values and this would falsely flag.
    const txs = [
      makeTx({ id: 'a', date: '2026-03-01', direction: 'debit', amount: 0, balance: 100 }),
      makeTx({ id: 'b', date: '2026-03-01', direction: 'debit', amount: 10, balance: 90 }),
      makeTx({ id: 'c', date: '2026-03-01', direction: 'debit', amount: 20, balance: 70 }),
    ];

    expect(validateBalanceContinuity(txs)).toEqual([]);
  });

  it('skips null-balance rows entirely without breaking the chain', () => {
    const txs = [
      makeTx({ id: 'a', date: '2026-03-01', direction: 'debit', amount: 10, balance: 990 }),
      makeTx({ id: 'b', date: '2026-03-02', direction: 'debit', amount: 999, balance: null, account: 'UOB Credit Card' }),
      makeTx({ id: 'c', date: '2026-03-03', direction: 'debit', amount: 5, balance: 985 }),
    ];

    expect(validateBalanceContinuity(txs)).toEqual([]);
  });

  it('validates multiple accounts independently', () => {
    const txs = [
      makeTx({ id: 'a1', date: '2026-03-01', account: 'UOB One', direction: 'debit', amount: 10, balance: 990 }),
      makeTx({ id: 'a2', date: '2026-03-02', account: 'UOB One', direction: 'debit', amount: 5, balance: 900 }), // expected 985, flagged
      makeTx({ id: 'b1', date: '2026-03-01', account: 'HSBC Savings', direction: 'credit', amount: 100, balance: 1100 }),
      makeTx({ id: 'b2', date: '2026-03-02', account: 'HSBC Savings', direction: 'credit', amount: 50, balance: 1150 }), // clean
    ];

    const issues = validateBalanceContinuity(txs);

    expect(issues).toHaveLength(1);
    expect(issues[0].account).toBe('UOB One');
    expect(issues[0].id).toBe('a2');
  });

  it('does not falsely trigger on float arithmetic within the 0.005 tolerance', () => {
    const txs = [
      makeTx({ id: 'a', date: '2026-03-01', direction: 'debit', amount: 0.1, balance: 999.9 }),
      makeTx({ id: 'b', date: '2026-03-02', direction: 'debit', amount: 0.2, balance: 999.7 }), // 999.9 - 0.2 = 999.7000000000001 in fp
    ];

    expect(validateBalanceContinuity(txs)).toEqual([]);
  });

  it('never flags the first row of an account (no predecessor)', () => {
    const txs = [
      makeTx({ id: 'a', date: '2026-03-01', direction: 'debit', amount: 999999, balance: -12345 }),
    ];

    expect(validateBalanceContinuity(txs)).toEqual([]);
  });
});
