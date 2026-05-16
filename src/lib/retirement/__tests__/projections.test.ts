import { describe, it, expect } from 'vitest';
import { projectRetirement } from '../projections';

// Shared baseline: person well past 55 and 65 so CPF events don't interfere.
// cpfDate "2026-01-01" → startYear=2026, baselineYear=2027, first projected year=2028.
const BASE_PARAMS = {
  cpfStartBalances: { date: '2026-01-01', oa: 0, sa: 0, ma: 0 },
  dob: '1955-01',       // age 72 in 2027 — all CPF events already passed
  retirementAge: 65,
  payoutStartAge: 65,
  grossMonthlySalary: 0,
  salaryGrowthRate: 0,
  netMonthlyCashFlow: 0,
  currentPortfolioByTicker: { 'BRK-B': 100000 },
  tickerReturns: { 'BRK-B': 10 },
  tickerWeights: { 'BRK-B': 1 },
  oneOffs: [],
  horizonYears: 3,
  inflationRate: 0,
};

describe('projectRetirement — baseline entry', () => {
  it('first result is the raw starting state with no growth', () => {
    const results = projectRetirement({ ...BASE_PARAMS });
    expect(results[0].year).toBe(2027);   // baselineYear = cpfYear + 1
    expect(results[0].age).toBe(72);
    expect(results[0].investments).toBe(100000);
    expect(results[0].cpf.oa).toBe(0);
    expect(results[0].cpf.monthlyContribEmployee).toBe(0);
    expect(results[0].oneOffExpenses).toBe(0);
  });
});

describe('projectRetirement — investments grow by ticker return only', () => {
  it('compounds at the ticker rate when cash flow and one-offs are zero', () => {
    const results = projectRetirement({ ...BASE_PARAMS });

    // baseline + 3 projected years
    expect(results).toHaveLength(4);
    // Each projected year grows by exactly 10% from the previous
    expect(results[1].investments).toBeCloseTo(110000, 0);
    expect(results[2].investments).toBeCloseTo(121000, 0);
    expect(results[3].investments).toBeCloseTo(133100, 0);
  });

  it('returns correct year on projected rows', () => {
    const results = projectRetirement({ ...BASE_PARAMS });
    expect(results[1].year).toBe(2028);
    expect(results[2].year).toBe(2029);
    expect(results[3].year).toBe(2030);
  });
});

describe('projectRetirement — one-off expenses', () => {
  it('reduces investments in the year of the one-off', () => {
    const baseline = projectRetirement({ ...BASE_PARAMS });

    // One-off in 2028 (first projected year = results[1])
    const withOneOff = projectRetirement({
      ...BASE_PARAMS,
      oneOffs: [{ id: '1', year: 2028, description: 'Car', amountSGD: 50000 }],
    });

    // Baseline entry (2027): identical — one-off is in 2028
    expect(withOneOff[0].investments).toBeCloseTo(baseline[0].investments, 0);

    // 2028 (results[1]): 50k drawn from portfolio after returns applied
    // 100000 * 1.1 = 110000; minus 50k draw = 60000
    expect(withOneOff[1].investments).toBeCloseTo(baseline[1].investments - 50000, 0);

    // 2029 and 2030: lower starting base → lower final value
    expect(withOneOff[2].investments).toBeLessThan(baseline[2].investments);
    expect(withOneOff[3].investments).toBeLessThan(baseline[3].investments);

    expect(withOneOff[1].oneOffExpenses).toBe(50000);
    expect(withOneOff[2].oneOffExpenses).toBe(0);
  });

  it('accumulates multiple one-offs in the same year', () => {
    const results = projectRetirement({
      ...BASE_PARAMS,
      oneOffs: [
        { id: '1', year: 2028, description: 'A', amountSGD: 10000 },
        { id: '2', year: 2028, description: 'B', amountSGD: 20000 },
      ],
    });
    expect(results[1].oneOffExpenses).toBe(30000);
  });
});

describe('projectRetirement — BRS withdrawal at age 55', () => {
  it('adds BRS withdrawal to investments in the year the person turns 55', () => {
    // Person born 1984 turns 55 in 2039.
    // cpfDate "2035-01-01" → baselineYear=2036, first projected year=2037, endYear=2046.
    const params = {
      cpfStartBalances: { date: '2035-01-01', oa: 500000, sa: 80000, ma: 60000 },
      dob: '1984-06',
      retirementAge: 65,
      payoutStartAge: 65,
      grossMonthlySalary: 0,
      salaryGrowthRate: 0,
      netMonthlyCashFlow: 0,
      currentPortfolioByTicker: { 'TSM': 200000 },
      tickerReturns: { 'TSM': 0 },   // zero return so investments only change from BRS injection
      tickerWeights: { 'TSM': 1 },
      oneOffs: [],
      horizonYears: 10,
      inflationRate: 0,
    };

    const results = projectRetirement(params);
    const year55 = results.find(r => r.age === 55)!;
    const year54 = results.find(r => r.age === 54)!;

    expect(year55).toBeDefined();
    // Investments should jump at age 55 due to BRS withdrawal
    expect(year55.investments).toBeGreaterThan(year54.investments);
    expect(year55.cpf.brsWithdrawal).toBeGreaterThan(0);
  });
});

describe('projectRetirement — CPF LIFE payout', () => {
  // Start before age 55 so SA→RA transfer happens naturally during projection,
  // building up an RA balance that generates a non-zero CPF LIFE payout at 65.
  const CPF_LIFE_PARAMS = {
    cpfStartBalances: { date: '2026-01-01', oa: 100000, sa: 80000, ma: 50000 },
    dob: '1984-06',   // age 43 in 2027 (baseline), turns 55 in 2039, turns 65 in 2049
    retirementAge: 65,
    payoutStartAge: 65,
    grossMonthlySalary: 0,
    salaryGrowthRate: 0,
    netMonthlyCashFlow: 0,
    currentPortfolioByTicker: { 'BRK-B': 100000 },
    tickerReturns: { 'BRK-B': 0 },
    tickerWeights: { 'BRK-B': 1 },
    oneOffs: [],
    horizonYears: 30,  // baseline 2027 + projected 2028–2057
    inflationRate: 0,
  };

  it('adds cpfLifeMonthlyPayout to netMonthlyCashFlow from payoutStartAge', () => {
    const results = projectRetirement(CPF_LIFE_PARAMS);
    const before65 = results.find(r => r.age === 64)!;
    const at65 = results.find(r => r.age === 65)!;
    const after65 = results.find(r => r.age === 66)!;

    expect(before65.netMonthlyCashFlow).toBe(0);
    expect(at65.cpf.cpfLifeMonthlyPayout).not.toBeNull();
    expect(at65.netMonthlyCashFlow).toBeGreaterThan(0);
    // Payout locked — same the following year
    expect(after65.netMonthlyCashFlow).toBe(at65.netMonthlyCashFlow);
  });

  it('CPF LIFE payout boosts annual investable cash from payoutStartAge', () => {
    const results = projectRetirement(CPF_LIFE_PARAMS);
    const year64 = results.find(r => r.age === 64)!;
    const year65 = results.find(r => r.age === 65)!;

    // At 65: CPF LIFE payout × 12 invested → investments increase
    expect(year65.investments).toBeGreaterThan(year64.investments);
  });
});

describe('projectRetirement — netWorth', () => {
  it('netWorth = investments + totalCpf at each year', () => {
    const results = projectRetirement({ ...BASE_PARAMS, horizonYears: 5 });
    for (const row of results) {
      expect(row.netWorth).toBeCloseTo(row.investments + row.cpf.totalCpf + Math.max(0, row.cashReserve), 0);
    }
  });
});

describe('projectRetirement — positive cash flow', () => {
  it('distributes monthly surplus proportionally into tickers', () => {
    const results = projectRetirement({
      ...BASE_PARAMS,
      netMonthlyCashFlow: 1000,     // S$1k/month surplus
      tickerReturns: { 'BRK-B': 0 },  // zero return so growth is purely from cash injection
    });

    // First projected year (results[1]): investments = 100000 + 1000*12 = 112000
    expect(results[1].investments).toBeCloseTo(112000, 0);
  });
});
