import { getLatestCpfBalance, getRetirementOneOffs } from '@/lib/retirement/sheets';
import { getHoldings } from '@/lib/google-sheets';
import { getExpenses, getProjectionOverrides } from '@/lib/expenses/sheets';
import { fetchPricesAndFx } from '@/lib/yahoo-finance';
import { toSGD } from '@/lib/fx';
import { RetirementClient } from '@/components/retirement/RetirementClient';

export const dynamic = 'force-dynamic';

export default async function RetirementPage() {
  const [cpfBalance, oneOffs, holdings, pricesData, expenseTransactions, projectionOverrides] = await Promise.all([
    getLatestCpfBalance(),
    getRetirementOneOffs(),
    getHoldings(),
    fetchPricesAndFx(),
    getExpenses(),
    getProjectionOverrides(),
  ]);

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
      tickers.forEach(t => {
        tickerWeights[t] = 1 / tickers.length;
      });
    }
  }

  return (
    <main className="ml-48 p-8 min-h-screen" style={{ backgroundColor: '#f0f9ff' }}>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Retirement Projections</h1>
      <RetirementClient cpfBalance={cpfBalance} oneOffs={oneOffs} currentPortfolioByTicker={currentPortfolioByTicker} tickerWeights={tickerWeights} initialGrossMonthlySalary={9000} initialNetMonthlyCashFlow={3000} expenseTransactions={expenseTransactions} projectionOverrides={projectionOverrides} />
    </main>
  );
}