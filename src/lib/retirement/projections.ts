import { CpfBalance, RetirementOneOff, RetirementProjectionYear } from '@/types';
import { projectCpfYear } from './cpf';

export interface ProjectRetirementParams {
  cpfStartBalances: CpfBalance;
  dob: string;
  retirementAge: number;
  payoutStartAge: number;
  grossMonthlySalary: number;
  salaryGrowthRate: number;                         // annual % salary growth (e.g. 3 = 3%)
  netMonthlyCashFlow: number;                       // income − expenses per month (net of CPF)
  currentPortfolioByTicker: Record<string, number>; // SGD value per ticker at projection start
  tickerReturns: Record<string, number>;            // ticker → annual % (e.g. 8 = 8%)
  tickerWeights: Record<string, number>;            // current weight per ticker (sum = 1)
  oneOffs: RetirementOneOff[];
  horizonYears: number;
  inflationRate: number;
}

export function projectRetirement(params: ProjectRetirementParams): RetirementProjectionYear[] {
  const {
    cpfStartBalances, dob, retirementAge, payoutStartAge,
    grossMonthlySalary, salaryGrowthRate, netMonthlyCashFlow,
    currentPortfolioByTicker, tickerReturns, tickerWeights,
    oneOffs, horizonYears, inflationRate,
  } = params;

  const birthYear = parseInt(dob.slice(0, 4), 10);
  // startYear      = CPF balance date year (e.g. 2025 for a Dec-2025 statement)
  // baselineYear   = startYear + 1 — the Jan 1 starting point shown on the chart
  // First projected year = baselineYear + 1, so baselineYear is never re-projected.
  const startYear = parseInt(cpfStartBalances.date.slice(0, 4), 10);
  const baselineYear = startYear + 1;
  const endYear = startYear + horizonYears + 1;

  let cpfBalances = { oa: cpfStartBalances.oa, sa: cpfStartBalances.sa, ma: cpfStartBalances.ma, ra: 0 };
  let lockedCpfLifePayout: number | null = null;

  const portfolio: Record<string, number> = { ...currentPortfolioByTicker };
  let cashReserve = 0;

  const results: RetirementProjectionYear[] = [];

  // Baseline entry — raw starting state as of Jan 1 of baselineYear, no growth applied
  const baselineInvestments = Object.values(portfolio).reduce((a, b) => a + b, 0);
  const baselineAge = baselineYear - birthYear;
  const baseCpfTotal = cpfBalances.oa + cpfBalances.sa + cpfBalances.ma + cpfBalances.ra;
  results.push({
    year: baselineYear,
    age: baselineAge,
    investments: baselineInvestments,
    cpf: {
      year: baselineYear,
      age: baselineAge,
      oa: cpfBalances.oa,
      sa: cpfBalances.sa,
      ma: cpfBalances.ma,
      ra: cpfBalances.ra,
      totalCpf: baseCpfTotal,
      monthlyContribEmployee: 0,
      monthlyContribEmployer: 0,
      cpfLifeMonthlyPayout: null,
      brsWithdrawal: 0,
    },
    cashReserve: 0,
    netWorth: baselineInvestments + baseCpfTotal,
    netMonthlyCashFlow,
    oneOffExpenses: 0,
  });

  for (let year = baselineYear + 1; year <= endYear; year++) {
    const age = year - birthYear;
    const isRetired = age >= retirementAge;

    // yearsFromStart: years elapsed since the Jan 1 baseline
    const yearsFromStart = year - baselineYear;

    // Step 1 — CPF: zero salary after retirement so contributions stop
    const effectiveSalary = isRetired
      ? 0
      : grossMonthlySalary * Math.pow(1 + salaryGrowthRate / 100, yearsFromStart);
    const cpf = projectCpfYear({
      currentYear: year,
      dob,
      balances: cpfBalances,
      grossMonthlySalary: effectiveSalary,
      payoutStartAge,
      lockedCpfLifePayout,
    });

    cpfBalances = { oa: cpf.oa, sa: cpf.sa, ma: cpf.ma, ra: cpf.ra };
    if (lockedCpfLifePayout === null && cpf.cpfLifeMonthlyPayout !== null) {
      lockedCpfLifePayout = cpf.cpfLifeMonthlyPayout;
    }

    // Step 2 — Net investable cash for the year
    const cpfLifeAnnual = (cpf.cpfLifeMonthlyPayout ?? 0) * 12;
    const oneOffExpenses = oneOffs
      .filter(o => o.year === year)
      .reduce((sum, o) => {
        const amt = o.inTodaysPrices
          ? o.amountSGD * Math.pow(1 + inflationRate / 100, yearsFromStart)
          : o.amountSGD;
        return sum + amt;
      }, 0);

    const netInvestable = netMonthlyCashFlow * 12 + cpfLifeAnnual + cpf.brsWithdrawal - oneOffExpenses;

    // Step 3 — Apply annual ticker returns
    for (const ticker of Object.keys(portfolio)) {
      portfolio[ticker] *= 1 + (tickerReturns[ticker] ?? 0) / 100;
    }

    // Step 4 — Inject or draw cash proportionally
    if (netInvestable >= 0) {
      for (const ticker of Object.keys(portfolio)) {
        portfolio[ticker] += netInvestable * (tickerWeights[ticker] ?? 0);
      }
    } else {
      const totalPortfolio = Object.values(portfolio).reduce((a, b) => a + b, 0);
      const draw = -netInvestable;
      if (totalPortfolio >= draw) {
        const ratio = draw / totalPortfolio;
        for (const ticker of Object.keys(portfolio)) {
          portfolio[ticker] *= 1 - ratio;
        }
      } else {
        // Portfolio exhausted — overflow to negative cash reserve
        for (const ticker of Object.keys(portfolio)) {
          portfolio[ticker] = 0;
        }
        cashReserve += netInvestable + totalPortfolio;
      }
    }

    const totalInvestments = Object.values(portfolio).reduce((a, b) => a + b, 0);

    results.push({
      year,
      age,
      investments: totalInvestments,
      cpf,
      cashReserve,
      netWorth: totalInvestments + cpf.totalCpf + Math.max(0, cashReserve),
      netMonthlyCashFlow: netMonthlyCashFlow + (cpf.cpfLifeMonthlyPayout ?? 0),
      oneOffExpenses,
    });
  }

  return results;
}
