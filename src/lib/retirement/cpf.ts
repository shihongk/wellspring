import { CpfProjectionYear, CpfBalance } from '@/types';
import {
  CPF_CONTRIBUTION_RATES,
  CPF_ALLOCATION_RATES,
  CPF_INTEREST,
  CPF_RETIREMENT_SUMS_2026,
  CPF_LIFE_BASE_BRS_MONTHLY,
  CPF_LIFE_DEFERRAL_BONUS,
  HDB_MONTHLY_OA,
  HDB_LOAN_END_YEAR,
  MA_BASE_ANNUAL_DEDUCTION,
  MA_DEDUCTION_BASE_YEAR,
  MA_HEALTHCARE_INFLATION,
} from '@/lib/constants';

export function getCpfContributionRate(age: number): { employer: number; employee: number; total: number } {
  const bracket = CPF_CONTRIBUTION_RATES.find(b => age <= b.maxAge);
  if (!bracket) throw new Error(`No CPF contribution rate bracket for age ${age}`);
  return { employer: bracket.employer, employee: bracket.employee, total: bracket.total };
}

export function getCpfAllocationRates(age: number): { oa: number; sa: number; ma: number } {
  const bracket = CPF_ALLOCATION_RATES.find(b => age <= b.maxAge);
  if (!bracket) throw new Error(`No CPF allocation rate bracket for age ${age}`);
  return { oa: bracket.oa, sa: bracket.sa, ma: bracket.ma };
}

function projectedBrs(year: number): number {
  return CPF_RETIREMENT_SUMS_2026.brs * Math.pow(1 + CPF_RETIREMENT_SUMS_2026.growthRate, year - 2026);
}

function computeAnnualInterest(oa: number, sa: number, ma: number, ra: number) {
  // Extra 1% on first $60k combined (capped at $20k from OA)
  const oaForExtra = Math.min(oa, 20000);
  const nonOaTotal = sa + ma + ra;
  const nonOaForExtra = Math.min(nonOaTotal, Math.max(0, 60000 - oaForExtra));

  const oaInterest = oa * CPF_INTEREST.oa + oaForExtra * CPF_INTEREST.extraOnFirst60k;

  let saExtra = 0, maExtra = 0, raExtra = 0;
  if (nonOaTotal > 0 && nonOaForExtra > 0) {
    const nonOaExtraTotal = nonOaForExtra * CPF_INTEREST.extraOnFirst60k;
    saExtra = (sa / nonOaTotal) * nonOaExtraTotal;
    maExtra = (ma / nonOaTotal) * nonOaExtraTotal;
    raExtra = (ra / nonOaTotal) * nonOaExtraTotal;
  }

  return {
    oa: oaInterest,
    sa: sa * CPF_INTEREST.sa + saExtra,
    ma: ma * CPF_INTEREST.ma + maExtra,
    ra: ra * CPF_INTEREST.ra + raExtra,
  };
}

export interface ProjectCpfYearParams {
  currentYear: number;
  dob: string;                           // 'YYYY-MM'
  balances: { oa: number; sa: number; ma: number; ra: number };
  grossMonthlySalary: number;
  payoutStartAge: number;
  lockedCpfLifePayout?: number | null;   // carry forward once CPF LIFE starts
}

export function projectCpfYear(params: ProjectCpfYearParams): CpfProjectionYear {
  const {
    currentYear, dob, balances, grossMonthlySalary, payoutStartAge,
    lockedCpfLifePayout = null,
  } = params;

  const birthYear = parseInt(dob.slice(0, 4), 10);
  const age = currentYear - birthYear;

  const contrib = getCpfContributionRate(age);
  const alloc = getCpfAllocationRates(age);

  // Annual allocation: allocation rates are fractions of gross monthly wage
  // RA gets the residual for age ≥ 55 (SA contributions route to RA)
  const raAllocRate = Math.max(0, contrib.total - alloc.oa - alloc.sa - alloc.ma);

  let { oa, sa, ma, ra } = balances;

  oa += grossMonthlySalary * 12 * alloc.oa;
  sa += grossMonthlySalary * 12 * alloc.sa;
  ma += grossMonthlySalary * 12 * alloc.ma;
  ra += grossMonthlySalary * 12 * raAllocRate;

  if (currentYear <= HDB_LOAN_END_YEAR) {
    oa = Math.max(0, oa - HDB_MONTHLY_OA * 12);
  }

  const maDeduction = MA_BASE_ANNUAL_DEDUCTION *
    Math.pow(1 + MA_HEALTHCARE_INFLATION, currentYear - MA_DEDUCTION_BASE_YEAR);
  ma = Math.max(0, ma - maDeduction);

  const interest = computeAnnualInterest(oa, sa, ma, ra);
  oa += interest.oa;
  sa += interest.sa;
  ma += interest.ma;
  ra += interest.ra;

  let brsWithdrawal = 0;

  if (age === 55) {
    // SA closes; full balance transfers to RA
    ra += sa;
    sa = 0;

    // OA above BRS is withdrawable (user pledges property for BRS target)
    const brsNow = projectedBrs(currentYear);
    brsWithdrawal = Math.max(0, oa - brsNow);
    oa = Math.min(oa, brsNow);
  }

  let cpfLifeMonthlyPayout: number | null = lockedCpfLifePayout;
  if (lockedCpfLifePayout === null && age >= payoutStartAge) {
    const brsAtPayout = projectedBrs(currentYear);
    const deferralYears = Math.max(0, payoutStartAge - 65);
    const deferralMultiplier = Math.pow(1 + CPF_LIFE_DEFERRAL_BONUS, deferralYears);
    cpfLifeMonthlyPayout = (ra / brsAtPayout) * CPF_LIFE_BASE_BRS_MONTHLY * deferralMultiplier;
  }

  return {
    year: currentYear,
    age,
    oa,
    sa,
    ma,
    ra,
    totalCpf: oa + sa + ma + ra,
    monthlyContribEmployee: grossMonthlySalary * contrib.employee,
    monthlyContribEmployer: grossMonthlySalary * contrib.employer,
    cpfLifeMonthlyPayout,
    brsWithdrawal,
  };
}

export interface ProjectCpfParams {
  startBalances: CpfBalance;
  dob: string;
  grossMonthlySalary: number;
  endYear: number;
  payoutStartAge: number;
}

export function projectCpf(params: ProjectCpfParams): CpfProjectionYear[] {
  const { startBalances, dob, grossMonthlySalary, endYear, payoutStartAge } = params;
  const startYear = parseInt(startBalances.date.slice(0, 4), 10);

  const results: CpfProjectionYear[] = [];
  let balances = { oa: startBalances.oa, sa: startBalances.sa, ma: startBalances.ma, ra: 0 };
  let lockedCpfLifePayout: number | null = null;

  for (let year = startYear; year <= endYear; year++) {
    const result = projectCpfYear({ currentYear: year, dob, balances, grossMonthlySalary, payoutStartAge, lockedCpfLifePayout });
    results.push(result);
    balances = { oa: result.oa, sa: result.sa, ma: result.ma, ra: result.ra };
    if (lockedCpfLifePayout === null && result.cpfLifeMonthlyPayout !== null) {
      lockedCpfLifePayout = result.cpfLifeMonthlyPayout;
    }
  }

  return results;
}
