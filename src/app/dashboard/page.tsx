export const dynamic = 'force-dynamic';

import { getHoldings, getCash, getTargetAllocations } from '@/lib/google-sheets';
import { fetchPricesAndFx } from '@/lib/yahoo-finance';
import { computePortfolioSnapshot } from '@/lib/portfolio';
import { PortfolioSummary } from '@/components/portfolio-summary';
import { DashboardClient } from '@/components/dashboard-client';
import { RefreshButton } from '@/components/refresh-button';

export default async function DashboardPage() {
  const [holdings, cash, targetAllocations, { fxRates, prices, stale, fetchedAt }] = await Promise.all([
    getHoldings(),
    getCash(),
    getTargetAllocations().catch(() => []),
    fetchPricesAndFx(),
  ]);

  const snapshot = computePortfolioSnapshot(holdings, prices, fxRates, cash, stale, fetchedAt);

  const targetAllocMap: Record<string, number> = Object.fromEntries(
    targetAllocations.map((r) => [r.ticker, r.targetPct])
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <RefreshButton />
      </div>

      <PortfolioSummary snapshot={snapshot} />

      <DashboardClient snapshot={snapshot} targetAllocations={targetAllocMap} />
    </div>
  );
}
