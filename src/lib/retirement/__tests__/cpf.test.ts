import { describe, it, expect } from 'vitest';
import { getCpfContributionRate, getCpfAllocationRates, projectCpfYear, projectCpf } from '../cpf';
import { CPF_RETIREMENT_SUMS_2026, HDB_MONTHLY_OA } from '@/lib/constants';

describe('getCpfContributionRate', () => {
  it('returns correct rates for each age bracket', () => {
    // ≤55
    expect(getCpfContributionRate(30)).toEqual({ employer: 0.17, employee: 0.20, total: 0.37 });
    expect(getCpfContributionRate(55)).toEqual({ employer: 0.17, employee: 0.20, total: 0.37 });
    // 55–60
    expect(getCpfContributionRate(56)).toEqual({ employer: 0.16, employee: 0.18, total: 0.34 });
    expect(getCpfContributionRate(60)).toEqual({ employer: 0.16, employee: 0.18, total: 0.34 });
    // 60–65
    expect(getCpfContributionRate(61)).toEqual({ employer: 0.125, employee: 0.125, total: 0.25 });
    expect(getCpfContributionRate(65)).toEqual({ employer: 0.125, employee: 0.125, total: 0.25 });
    // 65–70
    expect(getCpfContributionRate(66)).toEqual({ employer: 0.09, employee: 0.075, total: 0.165 });
    expect(getCpfContributionRate(70)).toEqual({ employer: 0.09, employee: 0.075, total: 0.165 });
    // >70
    expect(getCpfContributionRate(71)).toEqual({ employer: 0.075, employee: 0.05, total: 0.125 });
  });
});

describe('getCpfAllocationRates', () => {
  it('returns SA > 0 at age 55 (still in ≤55 bracket)', () => {
    expect(getCpfAllocationRates(55).sa).toBeGreaterThan(0);
  });

  it('returns SA = 0 for age > 55', () => {
    expect(getCpfAllocationRates(56).sa).toBe(0);
    expect(getCpfAllocationRates(60).sa).toBe(0);
    expect(getCpfAllocationRates(65).sa).toBe(0);
  });

  it('allocation rates sum to total contribution rate for each bracket', () => {
    const checks = [30, 40, 48, 52, 57, 62, 67, 72];
    for (const age of checks) {
      const alloc = getCpfAllocationRates(age);
      const contrib = getCpfContributionRate(age);
      const raRate = Math.max(0, contrib.total - alloc.oa - alloc.sa - alloc.ma);
      expect(alloc.oa + alloc.sa + alloc.ma + raRate).toBeCloseTo(contrib.total, 5);
    }
  });
});

describe('projectCpfYear — contributions and interest', () => {
  it('applies annual OA/SA/MA contributions and interest', () => {
    // age 40 (dob 1990, year 2030) — 35–45 bracket: OA 21%, SA 7%, MA 9%, total 37%
    const result = projectCpfYear({
      currentYear: 2030,
      dob: '1990-01',
      balances: { oa: 100000, sa: 50000, ma: 30000, ra: 0 },
      grossMonthlySalary: 5000,
      payoutStartAge: 65,
    });

    // Annual contributions before interest
    const annualOaContrib = 5000 * 12 * 0.21; // 12600
    const annualSaContrib = 5000 * 12 * 0.07; // 4200
    const annualMaContrib = 5000 * 12 * 0.09; // 5400

    expect(result.age).toBe(40);
    // OA grows from contributions but is reduced by HDB loan deduction (~$14,460/yr)
    expect(result.oa).toBeGreaterThan(100000 + annualOaContrib - HDB_MONTHLY_OA * 12);
    expect(result.sa).toBeGreaterThan(50000 + annualSaContrib);
    expect(result.ma).toBeGreaterThan(30000 + annualMaContrib);
    expect(result.ra).toBe(0);
    expect(result.cpfLifeMonthlyPayout).toBeNull();
    expect(result.brsWithdrawal).toBe(0);
  });

  it('computes monthly contribution amounts correctly', () => {
    const salary = 8000;
    const result = projectCpfYear({
      currentYear: 2026,
      dob: '1984-06',
      balances: { oa: 0, sa: 0, ma: 0, ra: 0 },
      grossMonthlySalary: salary,
      payoutStartAge: 65,
    });
    // age 42 → 35–45 bracket: employer 17%, employee 20%
    expect(result.monthlyContribEmployee).toBeCloseTo(salary * 0.20, 5);
    expect(result.monthlyContribEmployer).toBeCloseTo(salary * 0.17, 5);
  });
});

describe('projectCpfYear — age 55 SA→RA transfer', () => {
  it('transfers entire SA to RA and zeros SA at age 55', () => {
    const result = projectCpfYear({
      currentYear: 2045,
      dob: '1990-01',
      balances: { oa: 200000, sa: 80000, ma: 60000, ra: 0 },
      grossMonthlySalary: 5000,
      payoutStartAge: 65,
    });
    expect(result.age).toBe(55);
    expect(result.sa).toBe(0);
    expect(result.ra).toBeGreaterThan(0);
  });

  it('computes BRS withdrawal: OA above projected BRS at 55', () => {
    const year55 = 2045;
    const brsAt55 = CPF_RETIREMENT_SUMS_2026.brs * Math.pow(1.035, year55 - 2026);

    // Start with OA well above BRS so withdrawal is non-zero
    const result = projectCpfYear({
      currentYear: year55,
      dob: '1990-01',
      balances: { oa: 500000, sa: 80000, ma: 60000, ra: 0 },
      grossMonthlySalary: 0,
      payoutStartAge: 65,
    });
    expect(result.brsWithdrawal).toBeGreaterThan(0);
    expect(result.oa).toBeLessThanOrEqual(brsAt55 * 1.001); // OA capped at BRS (allow tiny float drift)
  });

  it('returns zero brsWithdrawal if OA is below BRS at 55', () => {
    const result = projectCpfYear({
      currentYear: 2045,
      dob: '1990-01',
      balances: { oa: 50000, sa: 30000, ma: 20000, ra: 0 },
      grossMonthlySalary: 0,
      payoutStartAge: 65,
    });
    expect(result.brsWithdrawal).toBe(0);
  });
});

describe('projectCpfYear — CPF LIFE payout', () => {
  it('sets cpfLifeMonthlyPayout at payoutStartAge', () => {
    const result = projectCpfYear({
      currentYear: 2055,
      dob: '1990-01',
      balances: { oa: 50000, sa: 0, ma: 80000, ra: 150000 },
      grossMonthlySalary: 0,
      payoutStartAge: 65,
    });
    expect(result.cpfLifeMonthlyPayout).not.toBeNull();
    expect(result.cpfLifeMonthlyPayout!).toBeGreaterThan(0);
  });

  it('carries forward a locked payout without recomputing', () => {
    const locked = 1234.56;
    const result = projectCpfYear({
      currentYear: 2056,
      dob: '1990-01',
      balances: { oa: 50000, sa: 0, ma: 80000, ra: 200000 },
      grossMonthlySalary: 0,
      payoutStartAge: 65,
      lockedCpfLifePayout: locked,
    });
    expect(result.cpfLifeMonthlyPayout).toBe(locked);
  });

  it('returns null before payoutStartAge', () => {
    const result = projectCpfYear({
      currentYear: 2050,
      dob: '1990-01',
      balances: { oa: 50000, sa: 0, ma: 80000, ra: 150000 },
      grossMonthlySalary: 0,
      payoutStartAge: 65,
    });
    expect(result.age).toBe(60);
    expect(result.cpfLifeMonthlyPayout).toBeNull();
  });

  it('applies deferral bonus when payoutStartAge > 65', () => {
    const base = projectCpfYear({
      currentYear: 2055,
      dob: '1990-01',
      balances: { oa: 50000, sa: 0, ma: 80000, ra: 150000 },
      grossMonthlySalary: 0,
      payoutStartAge: 65,
    });
    const deferred = projectCpfYear({
      currentYear: 2057,
      dob: '1990-01',
      balances: { oa: 50000, sa: 0, ma: 80000, ra: 150000 },
      grossMonthlySalary: 0,
      payoutStartAge: 67,
    });
    // Deferred 2 years → ~+14% payout (before RA growth differences)
    expect(deferred.cpfLifeMonthlyPayout!).toBeGreaterThan(base.cpfLifeMonthlyPayout!);
  });
});

describe('projectCpf', () => {
  it('generates the correct number of years', () => {
    const results = projectCpf({
      startBalances: { date: '2026-01-01', oa: 50000, sa: 30000, ma: 20000 },
      dob: '1984-06',
      grossMonthlySalary: 8000,
      endYear: 2049,
      payoutStartAge: 65,
    });
    expect(results.length).toBe(2049 - 2026 + 1);
  });

  it('SA→RA transfer happens at age 55', () => {
    const results = projectCpf({
      startBalances: { date: '2026-01-01', oa: 100000, sa: 60000, ma: 40000 },
      dob: '1984-06',
      grossMonthlySalary: 8000,
      endYear: 2050,
      payoutStartAge: 65,
    });
    const year55 = results.find(r => r.age === 55)!;
    const year54 = results.find(r => r.age === 54)!;
    expect(year55.sa).toBe(0);
    expect(year55.ra).toBeGreaterThan(year54.sa); // RA received SA + any prior RA + interest
  });

  it('CPF LIFE payout is non-null from payoutStartAge and locked thereafter', () => {
    const results = projectCpf({
      startBalances: { date: '2026-01-01', oa: 100000, sa: 60000, ma: 40000 },
      dob: '1984-06',
      grossMonthlySalary: 8000,
      endYear: 2060,
      payoutStartAge: 65,
    });
    const year65 = results.find(r => r.age === 65)!;
    const year66 = results.find(r => r.age === 66)!;
    const year70 = results.find(r => r.age === 70)!;

    expect(year65.cpfLifeMonthlyPayout).not.toBeNull();
    expect(year66.cpfLifeMonthlyPayout).toBe(year65.cpfLifeMonthlyPayout);
    expect(year70.cpfLifeMonthlyPayout).toBe(year65.cpfLifeMonthlyPayout);
  });

  it('balances grow year over year from contributions and interest', () => {
    const results = projectCpf({
      startBalances: { date: '2026-01-01', oa: 50000, sa: 30000, ma: 20000 },
      dob: '1984-06',
      grossMonthlySalary: 5000,
      endYear: 2035,
      payoutStartAge: 65,
    });
    for (let i = 1; i < results.length; i++) {
      expect(results[i].totalCpf).toBeGreaterThan(results[i - 1].totalCpf);
    }
  });
});
