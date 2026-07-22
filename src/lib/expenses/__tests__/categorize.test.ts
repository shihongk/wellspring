import { describe, it, expect } from 'vitest';
import { ruleMatches, applyRules } from '@/lib/expenses/categorize';
import { ExpenseRule, ExpenseTransaction } from '@/types';

function makeTx(overrides: Partial<ExpenseTransaction> = {}): ExpenseTransaction {
  return {
    id: 'tx1',
    date: '2026-03-01',
    postDate: '2026-03-01',
    description: 'GRAB SG',
    amount: 10,
    direction: 'debit',
    balance: null,
    account: 'UOB Preferred Visa',
    category: 'Other',
    sourceFile: 'test.pdf',
    ...overrides,
  };
}

const noRules: ExpenseRule[] = [];

describe('applyRules — old-style rule (merchant + category only)', () => {
  it('matches built-in rule', () => {
    expect(applyRules(makeTx({ description: 'GRAB SG' }), noRules).category).toBe('Transport');
  });

  it('is case-insensitive for description', () => {
    expect(applyRules(makeTx({ description: 'grab singapore' }), noRules).category).toBe('Transport');
  });

  it('returns Other when no rule matches', () => {
    expect(applyRules(makeTx({ description: 'UNKNOWN MERCHANT XYZ' }), noRules).category).toBe('Other');
  });

  it('user rule takes priority over built-in', () => {
    const rules: ExpenseRule[] = [{ merchant: 'GRAB', category: 'Food & Drink' }];
    expect(applyRules(makeTx({ description: 'GRAB SG' }), rules).category).toBe('Food & Drink');
  });

  it('user rules are checked in order — first match wins', () => {
    const rules: ExpenseRule[] = [
      { merchant: 'GRAB', category: 'Food & Drink' },
      { merchant: 'GRAB', category: 'Entertainment' },
    ];
    expect(applyRules(makeTx({ description: 'GRAB SG' }), rules).category).toBe('Food & Drink');
  });

  it('is case-insensitive for user rule merchant', () => {
    const rules: ExpenseRule[] = [{ merchant: 'grab', category: 'Shopping' }];
    expect(applyRules(makeTx({ description: 'GRAB SG' }), rules).category).toBe('Shopping');
  });

  it('matches NTUC to Groceries', () => {
    expect(applyRules(makeTx({ description: 'NTUC FAIRPRICE' }), noRules).category).toBe('Groceries');
  });

  it('matches CCY CONVERSION FEE to Bank Charges', () => {
    expect(applyRules(makeTx({ description: 'CCY CONVERSION FEE USD' }), noRules).category).toBe('Bank Charges');
  });

  it('matches INWARD CREDIT to Other Income', () => {
    expect(applyRules(makeTx({ description: 'Inward Credit-FAST' }), noRules).category).toBe('Other Income');
  });

  it('unmatched transaction is not excluded', () => {
    expect(applyRules(makeTx({ description: 'UNKNOWN MERCHANT XYZ' }), noRules).excluded).toBe(false);
  });
});

describe('ruleMatches — account constraint', () => {
  const rule: ExpenseRule = { merchant: 'GRAB', account: 'UOB Preferred Visa', category: 'Transport' };

  it('rejects a near-miss on account', () => {
    expect(ruleMatches(makeTx({ description: 'GRAB SG', account: 'HSBC Savings' }), rule)).toBe(false);
  });

  it('accepts a match on account', () => {
    expect(ruleMatches(makeTx({ description: 'GRAB SG', account: 'UOB Preferred Visa' }), rule)).toBe(true);
  });
});

describe('ruleMatches — amount constraint', () => {
  const rule: ExpenseRule = { merchant: 'HIB-', amount: 1.00, exclude: true };

  it('rejects a near-miss on amount', () => {
    expect(ruleMatches(makeTx({ description: 'TO 4835 HIB- 705173X278960', amount: 183.67 }), rule)).toBe(false);
  });

  it('accepts a match within epsilon of the exact amount', () => {
    expect(ruleMatches(makeTx({ description: 'TO 4835 HIB- 705173X278960', amount: 1.004 }), rule)).toBe(true);
  });
});

describe('ruleMatches — direction constraint', () => {
  const rule: ExpenseRule = { merchant: 'PAYMENT RECEIVED', direction: 'credit', category: 'Transfer' };

  it('rejects a near-miss on direction', () => {
    expect(ruleMatches(makeTx({ description: 'PAYMENT RECEIVED - THANK YOU', direction: 'debit' }), rule)).toBe(false);
  });

  it('accepts a match on direction', () => {
    expect(ruleMatches(makeTx({ description: 'PAYMENT RECEIVED - THANK YOU', direction: 'credit' }), rule)).toBe(true);
  });
});

describe('applyRules — exclude action', () => {
  it('sets excluded and falls back category to Other when rule has no category', () => {
    const rules: ExpenseRule[] = [{ merchant: 'JUNK VERIFICATION', exclude: true }];
    const result = applyRules(makeTx({ description: 'JUNK VERIFICATION TX' }), rules);
    expect(result.excluded).toBe(true);
    expect(result.category).toBe('Other');
  });
});

describe('applyRules — user rule vs built-in precedence', () => {
  it('user category rule beats built-in category rule', () => {
    const rules: ExpenseRule[] = [{ merchant: 'GRAB', category: 'Entertainment' }];
    expect(applyRules(makeTx({ description: 'GRAB SG' }), rules).category).toBe('Entertainment');
  });

  it('built-in exclusion still applies even when a user category rule also matches', () => {
    const rules: ExpenseRule[] = [{ merchant: 'HIB-', category: 'Shopping' }];
    const result = applyRules(makeTx({ description: 'TO 4835 HIB- 705173X278960', amount: 1.00 }), rules);
    expect(result.category).toBe('Shopping');
    expect(result.excluded).toBe(true);
  });
});

describe('applyRules — built-in HIB- $1.00 verification-transfer exclusion', () => {
  it('excludes a realistic $1.00 HSBC verification transfer description', () => {
    const result = applyRules(
      makeTx({ description: 'TO 4835 8500 2021 9896 HIB- 705173X278960 REF IB08-31946', amount: 1.00 }),
      noRules,
    );
    expect(result.excluded).toBe(true);
  });

  it('does not exclude the same merchant substring at a different amount', () => {
    const result = applyRules(
      makeTx({ description: 'TO 4835 8500 2021 9896 HIB- 705173X278960 REF IB08-31946', amount: 183.67 }),
      noRules,
    );
    expect(result.excluded).toBe(false);
  });
});

describe('applyRules — built-in structured category rules', () => {
  it('categorizes GIRO PAYMENT as Transfer', () => {
    expect(applyRules(makeTx({ description: 'GIRO PAYMENT - AXS' }), noRules).category).toBe('Transfer');
  });

  it('categorizes AUTOPAY as Transfer', () => {
    expect(applyRules(makeTx({ description: 'AUTOPAY DEDUCTION' }), noRules).category).toBe('Transfer');
  });

  it('categorizes BILL PAYMENT as Transfer', () => {
    expect(applyRules(makeTx({ description: 'BILL PAYMENT - CONDO MGMT' }), noRules).category).toBe('Transfer');
  });

  it('categorizes Amex PAYMENT RECEIVED as Transfer', () => {
    expect(applyRules(makeTx({ description: 'PAYMENT RECEIVED - THANK YOU', direction: 'credit' }), noRules).category).toBe('Transfer');
  });
});
