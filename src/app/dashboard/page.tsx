export const dynamic = 'force-dynamic';

import { getDashboardData } from '@/lib/google-sheets';
import { fetchPricesAndFx } from '@/lib/yahoo-finance';
import { computePortfolioSnapshot } from '@/lib/portfolio';
import { DashboardClient } from '@/components/dashboard-client';
import { type BreakdownItem } from '@/components/history-client';

const TICKER_COLORS: Record<string, string> = {
  'BRK-B':   '#0f766e',
  'JK8.SI':  '#0369a1',
  '2823.HK': '#7c3aed',
  '2838.HK': '#b45309',
  'CASH':    '#64748b',
};

export default async function DashboardPage() {
  const [{ holdings, cash, targetAllocations, history }, { fxRates, prices, stale, fetchedAt }] =
    await Promise.all([
      getDashboardData(),
      fetchPricesAndFx(),
    ]);

  const snapshot = computePortfolioSnapshot(holdings, prices, fxRates, cash, stale, fetchedAt);

  const targetAllocMap = Object.fromEntries(
    targetAllocations.map((r) => [r.ticker, r.targetPct])
  );

  const chartData = history.map((e) => ({ date: e.date, totalValueSGD: e.totalValueSGD }));

  const total = snapshot.totalValueSGD ?? 0;
  const breakdown: BreakdownItem[] = [
    ...snapshot.holdings
      .filter((h) => h.totalValueSGD != null)
      .map((h) => ({
        ticker: h.ticker,
        name: h.name,
        valueSGD: h.totalValueSGD!,
        allocationPct: h.allocationPct ?? (h.totalValueSGD! / total) * 100,
        color: TICKER_COLORS[h.ticker] ?? '#94a3b8',
        costBasisSGD: h.costBasisSGD,
        unrealizedGainSGD: h.unrealizedGainSGD,
      }))
      .sort((a, b) => b.valueSGD - a.valueSGD),
    {
      ticker: 'CASH',
      name: 'Cash',
      valueSGD: snapshot.cash.SGD,
      allocationPct: snapshot.cash.allocationPct ?? (snapshot.cash.SGD / total) * 100,
      color: TICKER_COLORS['CASH'],
      costBasisSGD: snapshot.cash.SGD,
      unrealizedGainSGD: 0,
    },
  ];

  return (
    <DashboardClient
      snapshot={snapshot}
      targetAllocations={targetAllocMap}
      chartData={chartData}
      breakdown={breakdown}
      fxRates={fxRates}
      stale={stale}
      fetchedAt={fetchedAt ?? null}
    />
  );
}
