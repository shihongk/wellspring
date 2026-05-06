import { CpfBalance, RetirementOneOff, RetirementProjectionYear } from '@/types';
import { projectCpfYear } from './cpf';

export interface ProjectRetirementParams {
  cpfStartBalances: CpfBalance;
  dob: string;
  retirementAge: number;
  payoutStartAge: number;
  grossMonthlySalary: number;
  netMonthlyCashFlow: number;                       // income − expenses per month (net of CPF)
  currentPortfolioByTicker: Record<string, number>; // SGD value per ticker
  tickerReturns: Record<string, number>;            // ticker → annual % (e.g. 8 = 8%)
  tickerWeights: Record<string, number>;            // current weight per ticker (sum = 1)
  oneOffs: RetirementOneOff[];
  horizonYears: number;
  inflationRate: number;
}

export function projectRetirement(params: ProjectRetirementParams): RetirementProjectionYear[] {
  const {
    cpfStartBalances, dob, retirementAge, payoutStartAge,
    grossMonthlySalary, netMonthlyCashFlow,
    currentPortfolioByTicker, tickerReturns, tickerWeights,
    oneOffs, horizonYears, inflationRate,
  } = params;

  const birthYear = parseInt(dob.slice(0, 4), 10);
  const startYear = parseInt(cpfStartBalances.date.slice(0, 4), 10);
  const endYear = startYear + horizonYears - 1;

  let cpfBalances = { oa: cpfStartBalances.oa, sa: cpfStartBalances.sa, ma: cpfStartBalances.ma, ra: 0 };
  let lockedCpfLifePayout: number | null = null;

  const portfolio: Record<string, number> = { ...currentPortfolioByTicker };
  let cashReserve = 0;

  const results: RetirementProjectionYear[] = [];

  for (let year = startYear; year <= endYear; year++) {
    const age = year - birthYear;
    const isRetired = age >= retirementAge;

    // Step 1 — CPF: zero salary after retirement so contributions stop
    const cpf = projectCpfYear({
      currentYear: year,
      dob,
      balances: cpfBalances,
      grossMonthlySalary: isRetired ? 0 : grossMonthlySalary,
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
          ? o.amountSGD * Math.pow(1 + inflationRate / 100, year - startYear)
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
