import { describe, it, expect } from 'vitest';
import { detectStatementType } from '@/lib/expenses/detect';

describe('detectStatementType', () => {
  it('detects UOB deposit from text', () => {
    expect(detectStatementType('x.pdf', 'customer.service@uobgroup.com')).toBe('uob-deposit');
  });

  it('detects UOB credit from text', () => {
    expect(detectStatementType('x.pdf', 'card.centre@uobgroup.com')).toBe('uob-credit');
  });

  it('detects Citi credit from text', () => {
    expect(detectStatementType('x.pdf', 'Citibank Singapore')).toBe('citi-credit');
  });

  it('detects HSBC composite from text', () => {
    expect(detectStatementType('x.pdf', 'HSBC COMPOSITE STATEMENT')).toBe('hsbc-composite');
  });

  it('detects HSBC Revolution from text', () => {
    expect(detectStatementType('x.pdf', 'HSBC VISA REVOLUTION')).toBe('hsbc-credit-revolution');
  });

  it('detects HSBC Premier from text (no composite/revolution)', () => {
    expect(detectStatementType('x.pdf', 'HSBC Premier Credit Card')).toBe('hsbc-credit-premier');
  });

  it('text signals take priority over filename', () => {
    // filename says revolution but text says uob deposit — text wins
    expect(detectStatementType('REVOLUTION.pdf', 'customer.service@uobgroup.com')).toBe('uob-deposit');
  });

  // Filename fallback (empty text — image PDFs)
  it('filename fallback: REVOLUTION in filename', () => {
    expect(detectStatementType('2026-04-28_Revolution_Statement.pdf', '')).toBe('hsbc-credit-revolution');
  });

  it('filename fallback: COMPOSITE in filename', () => {
    expect(detectStatementType('HSBC_Composite.pdf', '')).toBe('hsbc-composite');
  });

  it('filename fallback: HSBC in filename → premier', () => {
    expect(detectStatementType('HSBC_Premier.pdf', '')).toBe('hsbc-credit-premier');
  });

  it('returns unknown when nothing matches', () => {
    expect(detectStatementType('random.pdf', 'some unrelated text')).toBe('unknown');
  });
});
