export const dynamic = 'force-dynamic';

import { getHoldings, getCash, getMonthlyPlan } from '@/lib/google-sheets';
import { fetchPricesAndFx } from '@/lib/yahoo-finance';
import { computePortfolioSnapshot } from '@/lib/portfolio';
import { PortfolioSummary } from '@/components/portfolio-summary';
import { DashboardClient } from '@/components/dashboard-client';
import { RefreshButton } from '@/components/refresh-button';

export default async function DashboardPage() {
  const [holdings, cash, plan, { fxRates, prices, stale, fetchedAt }] = await Promise.all([
    getHoldings(),
    getCash(),
    getMonthlyPlan(),
    fetchPricesAndFx(),
  ]);

  const snapshot = computePortfolioSnapshot(holdings, prices, fxRates, cash, plan, stale, fetchedAt);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <RefreshButton />
      </div>

      <PortfolioSummary snapshot={snapshot} />

      <DashboardClient snapshot={snapshot} />
    </div>
  );
}
