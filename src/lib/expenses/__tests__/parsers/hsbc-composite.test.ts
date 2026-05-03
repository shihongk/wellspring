import { describe, it, expect } from 'vitest';
import { parseHSBCComposite } from '@/lib/expenses/parsers/hsbc-composite';

// Realistic OCR output: savings section with 2 transactions, then securities section
const FIXTURE = `
HSBC COMPOSITE STATEMENT

Your Portfolio at a Glance

Premier Savings Account

BALANCE BROUGHT FORWARD
12345.67

19Mar2026
SGV19036MB76M5VK
FAST PAYMENT RECEIPT
Khor Shihong
123.45 12469.12

25Mar2026
GRAB SINGAPORE PTE LTD
DEBIT PURCHASE
34.56 12434.56

SECURITIES & UNIT TRUSTS

SOME SECURITIES ROW THAT SHOULD NOT APPEAR
`;

describe('parseHSBCComposite', () => {
  const result = parseHSBCComposite(FIXTURE, '2026-04-07_Statement.pdf');

  it('returns exactly 2 transactions (securities section excluded)', () => {
    expect(result).toHaveLength(2);
  });

  it('first transaction is credit (balance increased from opening)', () => {
    // 12345.67 → 12469.12: balance increased
    expect(result[0].direction).toBe('credit');
  });

  it('first transaction has correct date, amount, balance', () => {
    expect(result[0].date).toBe('2026-03-19');
    expect(result[0].amount).toBe(123.45);
    expect(result[0].balance).toBe(12469.12);
  });

  it('second transaction is debit (balance decreased)', () => {
    // 12469.12 → 12434.56: balance decreased
    expect(result[1].direction).toBe('debit');
    expect(result[1].amount).toBe(34.56);
    expect(result[1].balance).toBe(12434.56);
  });

  it('multi-line description is collapsed to a single string', () => {
    expect(result[0].description).toBe('SGV19036MB76M5VK FAST PAYMENT RECEIPT Khor Shihong');
  });

  it('second transaction description collapsed correctly', () => {
    expect(result[1].description).toBe('GRAB SINGAPORE PTE LTD DEBIT PURCHASE');
  });

  it('securities section rows do not appear in output', () => {
    expect(result.every(t => !t.description.includes('SECURITIES'))).toBe(true);
  });

  it('balance populated for all transactions', () => {
    expect(result.every(t => t.balance !== null)).toBe(true);
  });

  it('all transactions assigned to HSBC Savings', () => {
    expect(result.every(t => t.account === 'HSBC Savings')).toBe(true);
  });

  it('all ids are unique 16-char hex strings', () => {
    const ids = result.map(t => t.id);
    expect(ids.every(id => /^[0-9a-f]{16}$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('parseHSBCComposite — no savings section header', () => {
  const text = `
HSBC COMPOSITE STATEMENT 2026

BALANCE BROUGHT FORWARD
5000.00

01Apr2026
SALARY DEPOSIT
1000.00 6000.00

SECURITIES & UNIT TRUSTS
IGNORED
`;

  it('processes from start when no savings header found', () => {
    const result = parseHSBCComposite(text, '2026-04-07_Statement.pdf');
    expect(result).toHaveLength(1);
    expect(result[0].direction).toBe('credit');
    expect(result[0].date).toBe('2026-04-01');
  });
});
