import { describe, it, expect } from 'vitest';
import { categorize } from '@/lib/expenses/categorize';
import { ExpenseRule } from '@/types';

const noRules: ExpenseRule[] = [];

describe('categorize', () => {
  it('matches built-in rule', () => {
    expect(categorize('GRAB SG', noRules)).toBe('Transport');
  });

  it('is case-insensitive for description', () => {
    expect(categorize('grab singapore', noRules)).toBe('Transport');
  });

  it('returns Other when no rule matches', () => {
    expect(categorize('UNKNOWN MERCHANT XYZ', noRules)).toBe('Other');
  });

  it('user rule takes priority over built-in', () => {
    const rules: ExpenseRule[] = [{ merchant: 'GRAB', category: 'Food & Drink' }];
    expect(categorize('GRAB SG', rules)).toBe('Food & Drink');
  });

  it('user rules are checked in order — first match wins', () => {
    const rules: ExpenseRule[] = [
      { merchant: 'GRAB', category: 'Food & Drink' },
      { merchant: 'GRAB', category: 'Entertainment' },
    ];
    expect(categorize('GRAB SG', rules)).toBe('Food & Drink');
  });

  it('is case-insensitive for user rule merchant', () => {
    const rules: ExpenseRule[] = [{ merchant: 'grab', category: 'Shopping' }];
    expect(categorize('GRAB SG', rules)).toBe('Shopping');
  });

  it('matches NTUC to Groceries', () => {
    expect(categorize('NTUC FAIRPRICE', noRules)).toBe('Groceries');
  });

  it('matches CCY CONVERSION FEE to Bank Charges', () => {
    expect(categorize('CCY CONVERSION FEE USD', noRules)).toBe('Bank Charges');
  });

  it('matches INWARD CREDIT to Other Income', () => {
    expect(categorize('Inward Credit-FAST', noRules)).toBe('Other Income');
  });
});
