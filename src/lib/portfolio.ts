import {
  Holding,
  CashPosition,
  FxRates,
  PortfolioSnapshot,
  PortfolioHolding,
  InvestmentScheduleRow,
} from '@/types';
import { toSGD } from '@/lib/fx';

export function computeNewAvgCost(oldShares: number, oldAvg: number, newShares: number, newPrice: number): number {
  const totalShares = oldShares + newShares;
  if (totalShares === 0) return 0;
  return ((oldShares * oldAvg) + (newShares * newPrice)) / totalShares;
}

export function computeGap(targetPct: number, currentPct: number): number {
  return Math.round((currentPct - targetPct) * 10) / 10;
}

export function computeRecommendedUnits(plannedSGD: number, currentPriceSGD: number | null): number | null {
  if (currentPriceSGD == null || currentPriceSGD <= 0) return null;
  return Math.floor(plannedSGD / currentPriceSGD);
}

export function groupByMonth(rows: InvestmentScheduleRow[]): { month: string; rows: InvestmentScheduleRow[] }[] {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function parseMonth(m: string): number {
    const [mon, yr] = m.split(' ');
    return parseInt(yr) * 12 + MONTHS.indexOf(mon);
  }

  const map = new Map<string, InvestmentScheduleRow[]>();
  for (const row of rows) {
    if (!map.has(row.month)) map.set(row.month, []);
    map.get(row.month)!.push(row);
  }

  return [...map.entries()]
    .sort(([a], [b]) => parseMonth(a) - parseMonth(b))
    .map(([month, rows]) => ({ month, rows }));
}

export function computePortfolioSnapshot(
  holdings: Holding[],
  prices: Record<string, { price: number | null; currency: string }>,
  fxRates: FxRates,
  cash: CashPosition,
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
  };
}