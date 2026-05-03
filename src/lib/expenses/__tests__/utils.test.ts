import { describe, it, expect } from 'vitest';
import {
  generateId,
  parseAmount,
  parseDDMMM,
  parseDDMMMYYYY,
  inferYear,
  directionFromDelta,
  isCreditFromSuffix,
  isCreditFromParens,
} from '@/lib/expenses/utils';

describe('generateId', () => {
  it('is deterministic', () => {
    const a = generateId('2026-03-09', 'GRAB SG', 12.5, 'UOB One');
    const b = generateId('2026-03-09', 'GRAB SG', 12.5, 'UOB One');
    expect(a).toBe(b);
  });

  it('returns a 16-char hex string', () => {
    const id = generateId('2026-03-09', 'GRAB SG', 12.5, 'UOB One');
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('differs when date changes', () => {
    const a = generateId('2026-03-09', 'GRAB SG', 12.5, 'UOB One');
    const b = generateId('2026-03-10', 'GRAB SG', 12.5, 'UOB One');
    expect(a).not.toBe(b);
  });

  it('differs when amount changes', () => {
    const a = generateId('2026-03-09', 'GRAB SG', 12.5, 'UOB One');
    const b = generateId('2026-03-09', 'GRAB SG', 12.6, 'UOB One');
    expect(a).not.toBe(b);
  });

  it('differs when account changes', () => {
    const a = generateId('2026-03-09', 'GRAB SG', 12.5, 'UOB One');
    const b = generateId('2026-03-09', 'GRAB SG', 12.5, 'Citi Rewards');
    expect(a).not.toBe(b);
  });
});

describe('parseAmount', () => {
  it('handles comma-separated thousands', () => {
    expect(parseAmount('1,234.56')).toBe(1234.56);
  });

  it('handles parentheses (credit card credit)', () => {
    expect(parseAmount('(990.27)')).toBe(990.27);
  });

  it('handles CR suffix (HSBC credit)', () => {
    expect(parseAmount('224.95CR')).toBe(224.95);
  });

  it('handles plain float', () => {
    expect(parseAmount('20.00')).toBe(20);
  });

  it('handles integer with comma', () => {
    expect(parseAmount('1,000')).toBe(1000);
  });

  it('handles lowercase cr suffix', () => {
    expect(parseAmount('50.00cr')).toBe(50);
  });
});

describe('parseDDMMM', () => {
  it('parses lowercase month', () => {
    expect(parseDDMMM('09 Mar', 2026)).toBe('2026-03-09');
  });

  it('parses uppercase month (UOB credit style)', () => {
    expect(parseDDMMM('02 APR', 2026)).toBe('2026-04-02');
  });

  it('zero-pads day and month', () => {
    expect(parseDDMMM('05 Jan', 2026)).toBe('2026-01-05');
  });

  it('throws on unknown month', () => {
    expect(() => parseDDMMM('09 Xyz', 2026)).toThrow();
  });
});

describe('parseDDMMMYYYY', () => {
  it('parses concatenated date', () => {
    expect(parseDDMMMYYYY('19Mar2026')).toBe('2026-03-19');
  });

  it('parses end-of-month date', () => {
    expect(parseDDMMMYYYY('31Mar2026')).toBe('2026-03-31');
  });

  it('throws on bad format', () => {
    expect(() => parseDDMMMYYYY('2026-03-19')).toThrow();
  });
});

describe('inferYear', () => {
  it('returns prior year when tx month is later than statement end month', () => {
    expect(inferYear(12, 1, 2026)).toBe(2025);
  });

  it('returns same year for same month', () => {
    expect(inferYear(3, 3, 2026)).toBe(2026);
  });

  it('returns same year for normal prior-month tx', () => {
    expect(inferYear(1, 3, 2026)).toBe(2026);
  });

  it('handles November tx in December statement', () => {
    expect(inferYear(11, 12, 2026)).toBe(2026);
  });
});

describe('directionFromDelta', () => {
  it('debit when balance decreases', () => {
    expect(directionFromDelta(900, 1000)).toBe('debit');
  });

  it('credit when balance increases', () => {
    expect(directionFromDelta(1100, 1000)).toBe('credit');
  });

  it('debit when balance unchanged', () => {
    expect(directionFromDelta(1000, 1000)).toBe('debit');
  });
});

describe('isCreditFromSuffix', () => {
  it('returns true for CR suffix', () => {
    expect(isCreditFromSuffix('224.95CR')).toBe(true);
  });

  it('returns true for lowercase cr', () => {
    expect(isCreditFromSuffix('224.95cr')).toBe(true);
  });

  it('returns false for plain amount', () => {
    expect(isCreditFromSuffix('20.00')).toBe(false);
  });
});

describe('isCreditFromParens', () => {
  it('returns true for parenthesised amount', () => {
    expect(isCreditFromParens('(990.27)')).toBe(true);
  });

  it('returns false for plain amount', () => {
    expect(isCreditFromParens('20.00')).toBe(false);
  });
});
