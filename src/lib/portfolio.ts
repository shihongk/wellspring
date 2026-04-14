import {
  Holding,
  CashPosition,
  MonthlyPlanRow,
  FxRates,
  PortfolioSnapshot,
  PortfolioHolding,
} from '@/types';
import { toSGD } from '@/lib/fx';

export function computeNewAvgCost(oldShares: number, oldAvg: number, newShares: number, newPrice: number): number {
  const totalShares = oldShares + newShares;
  if (totalShares === 0) return 0;
  return ((oldShares * oldAvg) + (newShares * newPrice)) / totalShares;
}

export function computePortfolioSnapshot(
  holdings: Holding[],
  prices: Record<string, { price: number | null; currency: string }>,
  fxRates: FxRates,
  cash: CashPosition,
  plan: MonthlyPlanRow[],
  pricesStale: boolean,
  pricesFetchedAt: string | null
): PortfolioSnapshot {
  
  let grandTotalSGD = cash.SGD;
  
  const portfolioHoldings: PortfolioHolding[] = holdings.map((h) => {
    const currentPriceLocal = pricesStale ? null : (prices[h.ticker]?.price ?? null);
    const costBasisSGD = toSGD(h.shares * h.avgCostLocal, h.currency, fxRates);
    
    let totalValueSGD: number | null = null;
    let currentPriceSGD: number | null = null;
    let unrealizedGainSGD: number | null = null;
    let unrealizedGainPct: number | null = null;
    
    if (currentPriceLocal !== null) {
      currentPriceSGD = toSGD(currentPriceLocal, h.currency, fxRates);
      totalValueSGD = toSGD(h.shares * currentPriceLocal, h.currency, fxRates);
      unrealizedGainSGD = totalValueSGD - costBasisSGD;
      unrealizedGainPct = costBasisSGD > 0 ? (unrealizedGainSGD / costBasisSGD) * 100 : 0;
      grandTotalSGD += totalValueSGD;
    }

    return { ...h, currentPriceLocal, currentPriceSGD, totalValueSGD, costBasisSGD, unrealizedGainSGD, unrealizedGainPct, allocationPct: null };
  });

  portfolioHoldings.forEach((h) => {
    h.allocationPct = (h.totalValueSGD !== null && grandTotalSGD > 0) ? (h.totalValueSGD / grandTotalSGD) * 100 : null;
  });

  const cashAllocationPct = grandTotalSGD > 0 ? (cash.SGD / grandTotalSGD) * 100 : 0;

  return {
    pricesStale,
    pricesFetchedAt,
    fxRates,
    totalValueSGD: pricesStale ? null : grandTotalSGD,
    holdings: portfolioHoldings,
    cash: { SGD: cash.SGD, allocationPct: cashAllocationPct },
    plan,
  };
}