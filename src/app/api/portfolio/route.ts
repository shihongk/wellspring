export const dynamic = 'force-dynamic';

import { getHoldings, getCash, getMonthlyPlan } from '@/lib/google-sheets';
import { fetchPricesAndFx } from '@/lib/yahoo-finance';
import { computePortfolioSnapshot } from '@/lib/portfolio';

export async function GET() {
  try {
    const [holdings, cash, plan, { fxRates, prices, stale, fetchedAt }] = await Promise.all([
      getHoldings(),
      getCash(),
      getMonthlyPlan(),
      fetchPricesAndFx(),
    ]);
    const snapshot = computePortfolioSnapshot(holdings, prices, fxRates, cash, plan, stale, fetchedAt);
    return Response.json(snapshot);
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}