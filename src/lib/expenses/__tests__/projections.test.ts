import { describe, it, expect } from 'vitest';
import {
  computeBaselineAverages,
  generateProjections,
  aggregateCashFlow,
} from '../projections';
import type { ExpenseTransaction, ExpenseProjectionOverride } from '@/types';

function makeTx(overrides: Partial<ExpenseTransaction> & { date: string; category: string; amount: number }): ExpenseTransaction {
  return {
    id: 'test',
    postDate: overrides.date,
    description: 'desc',
    direction: 'debit',
    balance: null,
    account: 'Test Account',
    sourceFile: 'test.pdf',
    excluded: false,
    oneOff: false,
    ...overrides,
  };
}

const NO_INFLATION = { expenseInflationRate: 0, incomeGrowthRate: 0 };
const INCOME_CATS = ['Salary', 'Interest', 'Other Income', 'Income'];

describe('computeBaselineAverages', () => {
  it('divides by total months even when a category is absent in some months', () => {
    // 3-month baseline, Food only appears in 1 month
    const txs = [
      makeTx({ date: '2026-01-15', category: 'Food & Drink', amount: 300 }),
    ];
    const avg = computeBaselineAverages(txs, '2026-01', '2026-03');
    // 300 / 3 months = 100
    expect(avg['Food & Drink']).toBeCloseTo(100);
  });

  it('excludes transactions with excluded: true', () => {
    const txs = [
      makeTx({ date: '2026-01-10', category: 'Food & Drink', amount: 200, excluded: true }),
      makeTx({ date: '2026-01-15', category: 'Food & Drink', amount: 100 }),
    ];
    const avg = computeBaselineAverages(txs, '2026-01', '2026-01');
    expect(avg['Food & Drink']).toBeCloseTo(100);
  });

  it('excludes transactions with oneOff: true', () => {
    const txs = [
      makeTx({ date: '2026-01-10', category: 'Shopping', amount: 1000, oneOff: true }),
      makeTx({ date: '2026-01-15', category: 'Shopping', amount: 50 }),
    ];
    const avg = computeBaselineAverages(txs, '2026-01', '2026-01');
    expect(avg['Shopping']).toBeCloseTo(50);
  });

  it('excludes Transfer category from baseline', () => {
    const txs = [
      makeTx({ date: '2026-01-10', category: 'Transfer', amount: 500 }),
      makeTx({ date: '2026-01-15', category: 'Food & Drink', amount: 100 }),
    ];
    const avg = computeBaselineAverages(txs, '2026-01', '2026-01');
    expect(avg['Transfer']).toBeUndefined();
    expect(avg['Food & Drink']).toBeCloseTo(100);
  });

  it('excludes Investment category from baseline', () => {
    const txs = [
      makeTx({ date: '2026-01-10', category: 'Investment', amount: 2000 }),
      makeTx({ date: '2026-01-15', category: 'Groceries', amount: 150 }),
    ];
    const avg = computeBaselineAverages(txs, '2026-01', '2026-01');
    expect(avg['Investment']).toBeUndefined();
    expect(avg['Groceries']).toBeCloseTo(150);
  });

  it('includes income category credits and excludes income category debits', () => {
    const txs = [
      makeTx({ date: '2026-01-25', category: 'Salary', amount: 5000, direction: 'credit' }),
      makeTx({ date: '2026-01-26', category: 'Salary', amount: 100, direction: 'debit' }),
    ];
    const avg = computeBaselineAverages(txs, '2026-01', '2026-01');
    expect(avg['Salary']).toBeCloseTo(5000);
  });

  it('excludes transactions outside the baseline window', () => {
    const txs = [
      makeTx({ date: '2025-12-15', category: 'Food & Drink', amount: 200 }),
      makeTx({ date: '2026-01-15', category: 'Food & Drink', amount: 100 }),
      makeTx({ date: '2026-04-01', category: 'Food & Drink', amount: 300 }),
    ];
    const avg = computeBaselineAverages(txs, '2026-01', '2026-03');
    // Only Jan tx included; divided by 3 months
    expect(avg['Food & Drink']).toBeCloseTo(100 / 3);
  });
});

describe('generateProjections', () => {
  it('uses baseline average when no override and no inflation', () => {
    const baseline = { 'Food & Drink': 300 };
    const rows = generateProjections(baseline, [], ['2026-06', '2026-07'], NO_INFLATION);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ month: '2026-06', category: 'Food & Drink', amount: 300 });
    expect(rows[1]).toMatchObject({ month: '2026-07', category: 'Food & Drink', amount: 300 });
  });

  it('override replaces baseline for the exact month/category', () => {
    const baseline = { 'Groceries': 400 };
    const overrides: ExpenseProjectionOverride[] = [
      { month: '2026-07', category: 'Groceries', amount: 600 },
    ];
    const rows = generateProjections(baseline, overrides, ['2026-06', '2026-07', '2026-08'], NO_INFLATION);
    expect(rows.find(r => r.month === '2026-06')!.amount).toBeCloseTo(400);
    expect(rows.find(r => r.month === '2026-07')!.amount).toBeCloseTo(600);
    expect(rows.find(r => r.month === '2026-08')!.amount).toBeCloseTo(400);
  });

  it('inflation compounds annually: year 1 = 1x, year 2 = 1.1x, year 3 = 1.21x', () => {
    const baseline = { 'Transport': 100 };
    const settings = { expenseInflationRate: 10, incomeGrowthRate: 0 };
    // first target year is 2026
    const rows = generateProjections(baseline, [], ['2026-01', '2027-01', '2028-01'], settings);
    expect(rows.find(r => r.month === '2026-01')!.amount).toBeCloseTo(100);
    expect(rows.find(r => r.month === '2027-01')!.amount).toBeCloseTo(110);
    expect(rows.find(r => r.month === '2028-01')!.amount).toBeCloseTo(121);
  });

  it('uses incomeGrowthRate for income categories', () => {
    const baseline = { 'Salary': 5000, 'Transport': 200 };
    const settings = { expenseInflationRate: 5, incomeGrowthRate: 20 };
    const rows = generateProjections(baseline, [], ['2026-01', '2027-01'], settings);
    const salary2027 = rows.find(r => r.month === '2027-01' && r.category === 'Salary')!;
    const transport2027 = rows.find(r => r.month === '2027-01' && r.category === 'Transport')!;
    expect(salary2027.amount).toBeCloseTo(6000);
    expect(transport2027.amount).toBeCloseTo(210);
  });

  it('override is not inflated — raw override amount used as-is', () => {
    const baseline = { 'Groceries': 300 };
    const overrides: ExpenseProjectionOverride[] = [
      { month: '2027-06', category: 'Groceries', amount: 500 },
    ];
    const settings = { expenseInflationRate: 10, incomeGrowthRate: 0 };
    const rows = generateProjections(baseline, overrides, ['2026-06', '2027-06'], settings);
    expect(rows.find(r => r.month === '2027-06')!.amount).toBeCloseTo(500);
  });

  it('returns empty array when targetMonths is empty', () => {
    expect(generateProjections({ 'Food & Drink': 100 }, [], [], NO_INFLATION)).toEqual([]);
  });
});

describe('aggregateCashFlow', () => {
  it('computes rolling 3M / 6M / 12M net cash flows', () => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const m = (i + 1).toString().padStart(2, '0');
      return `2026-${m}`;
    });
    const projections = months.flatMap(month => [
      { month, category: 'Salary', amount: 5000 },
      { month, category: 'Food & Drink', amount: 1000 },
    ]);
    const result = aggregateCashFlow(projections, INCOME_CATS);
    // Each month: net = 5000 - 1000 = 4000
    expect(result.next3M).toBeCloseTo(12000);
    expect(result.next6M).toBeCloseTo(24000);
    expect(result.next12M).toBeCloseTo(48000);
  });

  it('returns 0 for periods with fewer months than requested', () => {
    const projections = [
      { month: '2026-01', category: 'Food & Drink', amount: 200 },
    ];
    const result = aggregateCashFlow(projections, INCOME_CATS);
    expect(result.next3M).toBeCloseTo(-200);
    expect(result.next6M).toBeCloseTo(-200);
    expect(result.next12M).toBeCloseTo(-200);
  });

  it('treats income categories as inflows (positive) and expenses as outflows', () => {
    const projections = [
      { month: '2026-01', category: 'Salary', amount: 3000 },
      { month: '2026-01', category: 'Interest', amount: 50 },
      { month: '2026-01', category: 'Transport', amount: 200 },
    ];
    const result = aggregateCashFlow(projections, INCOME_CATS);
    // net = (3000 + 50) - 200 = 2850
    expect(result.next3M).toBeCloseTo(2850);
  });
});
