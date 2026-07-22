import { getLatestCpfBalance, getRetirementOneOffs, getCpfTransactions } from '@/lib/retirement/sheets';
import { getHoldings, getPortfolioHistory } from '@/lib/google-sheets';
import { getExpenses, getProjectionOverrides } from '@/lib/expenses/sheets';
import { fetchPricesAndFx } from '@/lib/yahoo-finance';
import { toSGD } from '@/lib/fx';
import { deriveGrossMonthlySalary } from '@/lib/retirement/salary';
import { RetirementClient } from '@/components/retirement/RetirementClient';

export const dynamic = 'force-dynamic';

export default async function RetirementPage() {
  const [cpfBalance, oneOffs, holdings, pricesData, expenseTransactions, projectionOverrides, portfolioHistory, cpfTransactions] = await Promise.all([
    getLatestCpfBalance(),
    getRetirementOneOffs(),
    getHoldings(),
    fetchPricesAndFx(),
    getExpenses(),
    getProjectionOverrides(),
    getPortfolioHistory(),
    getCpfTransactions(),
  ]);

  const userAge = new Date().getFullYear() - 1984;
  const derivedGrossMonthlySalary = deriveGrossMonthlySalary(cpfTransactions, userAge);

  const currentPortfolioByTicker: Record<string, number> = {};
  let totalEquity = 0;

  for (const h of holdings) {
    if (h.ticker === 'CASH') continue;
    const p = pricesData.prices[h.ticker]?.price ?? null;
    if (p !== null) {
      const val = toSGD(h.shares * p, h.currency, pricesData.fxRates);
      currentPortfolioByTicker[h.ticker] = val;
      totalEquity += val;
    }
  }

  const tickerWeights: Record<string, number> = {};
  if (totalEquity > 0) {
    for (const [ticker, value] of Object.entries(currentPortfolioByTicker)) {
      tickerWeights[ticker] = value / totalEquity;
    }
  } else {
    const tickers = Object.keys(currentPortfolioByTicker);
    if (tickers.length > 0) {
      tickers.forEach(t => { tickerWeights[t] = 1 / tickers.length; });
    }
  }

  // Find the portfolio history entry closest to Jan 1 of the baseline year (cpfYear + 1).
  // This matches what the projection engine uses as its starting point.
  let startPortfolioByTicker: Record<string, number> = { ...currentPortfolioByTicker };
  if (cpfBalance && totalEquity > 0 && portfolioHistory.length > 0) {
    const cpfYear = parseInt(cpfBalance.date.slice(0, 4), 10);
    const baselineMs = Date.UTC(cpfYear + 1, 0, 1); // Jan 1 of baseline year
    const entry = portfolioHistory
      .slice()
      .sort((a, b) => {
        const distA = Math.abs(new Date(a.date).getTime() - baselineMs);
        const distB = Math.abs(new Date(b.date).getTime() - baselineMs);
        return distA - distB;
      })[0];

    if (entry && !isNaN(entry.totalValueSGD) && entry.totalValueSGD > 0) {
      for (const [ticker, weight] of Object.entries(tickerWeights)) {
        startPortfolioByTicker[ticker] = entry.totalValueSGD * weight;
      }
    }
  }

  return (
    <main className="ml-48 p-8 min-h-screen" style={{ backgroundColor: '#f0f9ff' }}>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Retirement Projections</h1>
      <RetirementClient cpfBalance={cpfBalance} oneOffs={oneOffs} currentPortfolioByTicker={currentPortfolioByTicker} startPortfolioByTicker={startPortfolioByTicker} tickerWeights={tickerWeights} initialGrossMonthlySalary={derivedGrossMonthlySalary ?? 9000} initialNetMonthlyCashFlow={3000} expenseTransactions={expenseTransactions} projectionOverrides={projectionOverrides} />
    </main>
  );
}
