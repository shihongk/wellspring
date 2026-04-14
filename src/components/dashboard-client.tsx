'use client';

import { useState } from 'react';
import { PortfolioSnapshot } from '@/types';
import { HoldingsTable } from '@/components/holdings-table';
import { AllocationChart } from '@/components/allocation-chart';
import { PlanSummary } from '@/components/plan-summary';

interface Props {
  snapshot: PortfolioSnapshot;
}

export function DashboardClient({ snapshot }: Props) {
  const [excludeCash, setExcludeCash] = useState(false);

  // Re-compute allocations excluding cash when toggled
  const equityTotal = snapshot.holdings.reduce(
    (sum, h) => sum + (h.totalValueSGD ?? 0), 0
  );

  const holdingsWithAdjustedAlloc = snapshot.holdings.map((h) => {
    if (!excludeCash) return h;
    const adjAlloc = equityTotal > 0 && h.totalValueSGD != null
      ? (h.totalValueSGD / equityTotal) * 100
      : null;
    return { ...h, allocationPct: adjAlloc };
  });

  const cashAlloc = excludeCash ? null : snapshot.cash.allocationPct;

  const chartData = [
    ...holdingsWithAdjustedAlloc
      .filter((h) => h.allocationPct != null)
      .map((h) => ({ ticker: h.ticker, allocationPct: h.allocationPct! })),
    ...(!excludeCash && snapshot.cash.allocationPct != null
      ? [{ ticker: 'CASH', allocationPct: snapshot.cash.allocationPct }]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* Toggle */}
      <div className="flex items-center justify-end">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <span>Exclude cash from allocation</span>
          <button
            role="switch"
            aria-checked={excludeCash}
            onClick={() => setExcludeCash((v) => !v)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ${
              excludeCash ? 'bg-primary' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                excludeCash ? 'translate-x-4' : 'translate-x-1'
              }`}
            />
          </button>
        </label>
      </div>

      <HoldingsTable
        holdings={holdingsWithAdjustedAlloc}
        cash={{ ...snapshot.cash, allocationPct: cashAlloc }}
        grandTotalSGD={snapshot.totalValueSGD}
        excludeCash={excludeCash}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border bg-white shadow-sm p-4">
          <h2 className="text-lg font-semibold mb-3">
            Allocation {excludeCash && <span className="text-xs font-normal text-gray-400">(ex-cash)</span>}
          </h2>
          <AllocationChart data={chartData} />
        </div>

        <PlanSummary plan={snapshot.plan} holdings={holdingsWithAdjustedAlloc} cash={{ ...snapshot.cash, allocationPct: cashAlloc }} />
      </div>
    </div>
  );
}
