import { describe, it, expect } from 'vitest';
import { deriveGrossMonthlySalary } from '../salary';
import { CpfTransaction } from '@/types';

function conRow(date: string, oaChange: number, saChange: number, maChange: number): CpfTransaction {
  return { date, code: 'CON', ref: '', oaChange, saChange, maChange };
}

describe('deriveGrossMonthlySalary', () => {
  it('returns null when there are no CON rows', () => {
    const txs: CpfTransaction[] = [
      { date: '2026-01-15', code: 'INT', ref: '', oaChange: 100, saChange: 0, maChange: 0 },
    ];
    expect(deriveGrossMonthlySalary(txs, 30)).toBeNull();
  });

  it('derives salary from a single month, single CON row (age ≤55 bracket: total 37%)', () => {
    // oa 0.23 + sa 0.06 + ma 0.08 = 0.37 of salary, salary = 5000 → contribution = 1850
    const txs = [conRow('2026-06-15', 1150, 300, 400)];
    expect(deriveGrossMonthlySalary(txs, 30)).toBe(Math.round(1850 / 0.37));
  });

  it('sums multiple CON rows within the same month', () => {
    const txs = [
      conRow('2026-06-15', 1150, 300, 400),
      conRow('2026-06-20', 100, 0, 0), // e.g. a correction/backdated row in the same month
    ];
    const expectedTotal = 1150 + 300 + 400 + 100;
    expect(deriveGrossMonthlySalary(txs, 30)).toBe(Math.round(expectedTotal / 0.37));
  });

  it('uses the median of recent months (even count averages the middle pair)', () => {
    const txs = [
      conRow('2026-01-15', 500, 100, 100), // total 700
      conRow('2026-06-15', 1150, 300, 400), // total 1850
    ];
    expect(deriveGrossMonthlySalary(txs, 30)).toBe(Math.round(((700 + 1850) / 2) / 0.37));
  });

  it('median ignores a bonus-month outlier', () => {
    const txs = [
      conRow('2026-03-15', 1150, 300, 400), // 1850
      conRow('2026-04-15', 1150, 300, 400), // 1850
      conRow('2026-05-15', 1150, 300, 400), // 1850
      conRow('2026-06-15', 1150, 300, 400), // regular contribution
      conRow('2026-06-20', 2000, 500, 500), // AWS/bonus extra CON in June → 4850 total
    ];
    expect(deriveGrossMonthlySalary(txs, 30)).toBe(Math.round(1850 / 0.37));
  });

  it('only considers the six most recent months', () => {
    const txs = [
      conRow('2025-01-15', 9999, 0, 0), // stale month, outside the 6-month window
      ...['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']
        .map(m => conRow(`${m}-15`, 1150, 300, 400)),
    ];
    expect(deriveGrossMonthlySalary(txs, 30)).toBe(Math.round(1850 / 0.37));
  });

  it('selects the contribution rate bracket for the given age', () => {
    // age 56 → 55–60 bracket, total 34%
    const txs = [conRow('2026-06-15', 1150, 300, 400)];
    const total = 1150 + 300 + 400;
    expect(deriveGrossMonthlySalary(txs, 56)).toBe(Math.round(total / 0.34));
  });
});
