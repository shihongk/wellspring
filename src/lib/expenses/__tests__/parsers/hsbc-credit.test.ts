import { describe, it, expect } from 'vitest';
import { parseHSBCCredit } from '@/lib/expenses/parsers/hsbc-credit';

// Realistic OCR output: 2 debits + 1 CR credit, with sidebar labels on separate lines
const FIXTURE = `
HSBC Premier Credit Card Statement

Statement Date 06 Apr 2026

Previous Statement Balance 221.95
Payment 221.95CR
Purchases & Debits 183.67
GST Charges 0.00
Total Account Balance 183.67

31 Mar 28 Mar GRAB SG SINGAPORE 20.00
04 Apr 02 Apr NETFLIX SINGAPORE 16.98
03 Apr 03 Apr REFUND MERCHANT 224.95CR

Total Due 183.67
`;

describe('parseHSBCCredit', () => {
  const result = parseHSBCCredit(FIXTURE, '2026-04-06_Statement.pdf');

  it('returns 3 transactions', () => {
    expect(result).toHaveLength(3);
  });

  it('CR-suffixed amount produces credit direction with positive amount', () => {
    const refund = result.find(t => t.description === 'REFUND MERCHANT');
    expect(refund).toBeDefined();
    expect(refund!.direction).toBe('credit');
    expect(refund!.amount).toBe(224.95);
    expect(refund!.amount).toBeGreaterThan(0);
  });

  it('plain amounts produce debit direction', () => {
    const grab = result.find(t => t.description === 'GRAB SG SINGAPORE');
    expect(grab).toBeDefined();
    expect(grab!.direction).toBe('debit');
    expect(grab!.amount).toBe(20);
  });

  it('sidebar labels do not appear in any transaction description', () => {
    const sidebarTerms = [
      'Previous Statement Balance',
      'Purchases & Debits',
      'GST Charges',
      'Total Account Balance',
    ];
    for (const term of sidebarTerms) {
      expect(result.every(t => !t.description.includes(term))).toBe(true);
    }
  });

  it('balance is null for all transactions', () => {
    expect(result.every(t => t.balance === null)).toBe(true);
  });

  it('all transactions assigned to HSBC Premier account', () => {
    expect(result.every(t => t.account === 'HSBC Premier')).toBe(true);
  });

  it('dates parsed correctly from OCR text', () => {
    const grab = result.find(t => t.description === 'GRAB SG SINGAPORE');
    expect(grab!.date).toBe('2026-03-31');
  });

  it('all ids are unique 16-char hex strings', () => {
    const ids = result.map(t => t.id);
    expect(ids.every(id => /^[0-9a-f]{16}$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('parseHSBCCredit — Revolution account', () => {
  const text = `
HSBC REVOLUTION Visa Credit Card 2026

Statement Date 28 Apr 2026

15 Apr 14 Apr GRAB SINGAPORE 12.50
`;

  it('assigns HSBC Revolution account when REVOLUTION in text', () => {
    const result = parseHSBCCredit(text, '2026-04-28_Statement.pdf');
    expect(result[0].account).toBe('HSBC Revolution');
  });
});

describe('parseHSBCCredit — multi-line OCR group', () => {
  const text = `
HSBC Premier 2026

Statement Date 06 Apr 2026

31 Mar
28 Mar
COLD STORAGE VIVOCITY
45.00
`;

  it('handles transaction spread across multiple lines', () => {
    const result = parseHSBCCredit(text, '2026-04-06_Statement.pdf');
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('COLD STORAGE VIVOCITY');
    expect(result[0].amount).toBe(45);
    expect(result[0].direction).toBe('debit');
  });
});
