'use client';

import { PortfolioSnapshot } from '@/types';
import { AllocationChart } from '@/components/allocation-chart';

interface Props {
  snapshot: PortfolioSnapshot;
  excludeCash: boolean;
}

export function AllocationPanel({ snapshot, excludeCash }: Props) {
  const equityTotal = snapshot.holdings.reduce(
    (sum, h) => sum + (h.totalValueSGD ?? 0), 0
  );

  const chartData = [
    ...snapshot.holdings
      .filter((h) => h.allocationPct != null || h.totalValueSGD != null)
      .map((h) => {
        const allocationPct = excludeCash
          ? equityTotal > 0 && h.totalValueSGD != null
            ? (h.totalValueSGD / equityTotal) * 100
            : null
          : h.allocationPct;
        return { ticker: h.ticker, allocationPct: allocationPct ?? 0 };
      })
      .filter((h) => h.allocationPct > 0),
    ...(!excludeCash && snapshot.cash.allocationPct != null && snapshot.cash.allocationPct > 0
      ? [{ ticker: 'CASH', allocationPct: snapshot.cash.allocationPct }]
      : []),
  ];

  return <AllocationChart data={chartData} />;
}
