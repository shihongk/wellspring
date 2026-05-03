import { describe, it, expect } from 'vitest';
import { parseCitiCredit } from '@/lib/expenses/parsers/citi-credit';

const FIXTURE = `
Statement Date 06 Apr 2026

Bill summary pages ignored.

CITI REWARDS WORLD MASTERCARD 4321-XXXX-XXXX-8765

DATE  DESCRIPTION  AMOUNT (SGD)
TRANSACTIONS FOR CITI REWARDS WORLD MASTERCARD
ALL TRANSACTIONS BILLED IN SINGAPORE DOLLARS

12 MAR
GRAB SG
SG
17.50

27 MAR
AMAZON.COM
US
FOREIGN AMOUNT U.S. DOLLAR 19.99
27.45

02 APR
PAYMENT RECEIVED
(990.27)

SUB-TOTAL:  (945.32)
GRAND TOTAL  (945.32)

CITI CASH BACK PLUS MASTERCARD 5678-XXXX-XXXX-4321

DATE  DESCRIPTION  AMOUNT (SGD)
TRANSACTIONS FOR CITI CASH BACK PLUS MASTERCARD
ALL TRANSACTIONS BILLED IN SINGAPORE DOLLARS

15 MAR
CCY CONVERSION FEE USD
SG
0.54

SUB-TOTAL:  0.54
GRAND TOTAL  0.54
`;

describe('parseCitiCredit', () => {
  const result = parseCitiCredit(FIXTURE, 'eStatement_Apr2026.pdf');

  it('returns 4 transactions across 2 cards', () => {
    expect(result).toHaveLength(4);
  });

  it('GRAB: correct date, amount, direction, account', () => {
    const grab = result.find(t => t.description.includes('GRAB'));
    expect(grab?.date).toBe('2026-03-12');
    expect(grab?.amount).toBe(17.5);
    expect(grab?.direction).toBe('debit');
    expect(grab?.account).toBe('Citi Rewards');
  });

  it('GRAB: description is exactly the merchant line (country code line not appended)', () => {
    const grab = result.find(t => t.description.includes('GRAB'));
    // "GRAB SG" is the merchant name; the separate "SG" country-code line is stripped
    // so description should NOT be "GRAB SG SG"
    expect(grab?.description).toBe('GRAB SG');
  });

  it('AMAZON: FOREIGN AMOUNT line stripped, uses SGD amount', () => {
    const amazon = result.find(t => t.description.includes('AMAZON'));
    expect(amazon?.amount).toBe(27.45);
    expect(amazon?.description).not.toContain('FOREIGN AMOUNT');
  });

  it('parenthesis amount → credit direction', () => {
    const payment = result.find(t => t.description.includes('PAYMENT RECEIVED'));
    expect(payment?.direction).toBe('credit');
    expect(payment?.amount).toBe(990.27);
  });

  it('CCY CONVERSION FEE pre-categorized as Bank Charges', () => {
    const fee = result.find(t => t.description.includes('CCY CONVERSION FEE'));
    expect(fee?.category).toBe('Bank Charges');
    expect(fee?.account).toBe('Citi Cash Back Plus');
  });

  it('all credit card transactions have null balance', () => {
    expect(result.every(t => t.balance === null)).toBe(true);
  });

  it('all ids are unique', () => {
    const ids = result.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
