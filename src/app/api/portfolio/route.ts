export const dynamic = 'force-dynamic';

import { getHoldings, getCash } from '@/lib/google-sheets';
import { fetchPricesAndFx } from '@/lib/yahoo-finance';
import { computePortfolioSnapshot } from '@/lib/portfolio';

export async function GET() {
  try {
    const [holdings, cash, { fxRates, prices, stale, fetchedAt }] = await Promise.all([
      getHoldings(),
      getCash(),
      fetchPricesAndFx(),
    ]);
    const snapshot = computePortfolioSnapshot(holdings, prices, fxRates, cash, stale, fetchedAt);
    return Response.json(snapshot);
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
