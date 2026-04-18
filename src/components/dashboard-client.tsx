'use client';

import { useState } from 'react';
import { PortfolioSnapshot, FxRates } from '@/types';
import { HoldingsTable } from '@/components/holdings-table';
import { AllocationPanel } from '@/components/allocation-panel';
import { HistoryClient, type BreakdownItem } from '@/components/history-client';
import { Card } from '@/components/ui/card';
import { SnapshotButton } from '@/components/snapshot-button';
import { RefreshButton } from '@/components/refresh-button';
import { formatSGD } from '@/lib/fx';

interface Props {
  snapshot: PortfolioSnapshot;
  targetAllocations: Record<string, number>;
  chartData: { date: string; totalValueSGD: number }[];
  breakdown: BreakdownItem[];
  fxRates: FxRates;
  stale: boolean;
  fetchedAtLabel: string;
}

function fmtPct(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

function fmtSGDCompact(v: number): string {
  return (v >= 0 ? '+' : '') + formatSGD(v);
}

export function DashboardClient({
  snapshot, targetAllocations, chartData, breakdown,
  fxRates, stale, fetchedAtLabel,
}: Props) {
  const [excludeCash, setExcludeCash] = useState(true);

  // ── KPI: all-time return ──────────────────────────────────────────────────────
  const equityWithGain = snapshot.holdings.filter((h) => h.unrealizedGainSGD != null);
  const totalGainSGD   = equityWithGain.reduce((s, h) => s + h.unrealizedGainSGD!, 0);
  const totalCostBasis = equityWithGain.reduce((s, h) => s + h.costBasisSGD, 0);
  const allTimeReturnPct = totalCostBasis > 0 ? (totalGainSGD / totalCostBasis) * 100 : null;

  // ── KPI: month-to-date ────────────────────────────────────────────────────────
  const thisMonth    = new Date().toISOString().slice(0, 7);
  const monthEntries = chartData.filter((e) => e.date.startsWith(thisMonth));
  const latestEntry  = chartData[chartData.length - 1] ?? null;
  const mtdStart     = monthEntries[0] ?? null;
  const mtdDiff      = latestEntry && mtdStart
    ? latestEntry.totalValueSGD - mtdStart.totalValueSGD : null;
  const mtdPct       = mtdDiff != null && mtdStart && mtdStart.totalValueSGD > 0
    ? (mtdDiff / mtdStart.totalValueSGD) * 100 : null;
  const mtdStartDate = mtdStart
    ? new Date(mtdStart.date + 'T00:00:00').toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
    : null;

  const gainColor = totalGainSGD >= 0 ? 'text-green-600' : 'text-red-600';
  const mtdColor  = mtdDiff != null ? (mtdDiff >= 0 ? 'text-green-600' : 'text-red-600') : 'text-gray-400';

  // ── Holdings table ────────────────────────────────────────────────────────────
  const equityTotal = snapshot.holdings.reduce((sum, h) => sum + (h.totalValueSGD ?? 0), 0);
  const holdingsWithAdjustedAlloc = snapshot.holdings.map((h) => {
    if (!excludeCash) return h;
    const adjAlloc = equityTotal > 0 && h.totalValueSGD != null
      ? (h.totalValueSGD / equityTotal) * 100 : null;
    return { ...h, allocationPct: adjAlloc };
  });
  const cashAlloc = excludeCash ? null : snapshot.cash.allocationPct;

  return (
    <div className="space-y-4">

      {/* ── Header — toggle lives here, controls table alloc + donut ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Portfolio</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
            <span>Exclude cash</span>
            <button
              role="switch"
              aria-checked={excludeCash}
              onClick={() => setExcludeCash((v) => !v)}
              className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none ${
                excludeCash ? '' : 'bg-slate-300'
              }`}
              style={excludeCash ? { backgroundColor: '#0f766e' } : undefined}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                  excludeCash ? 'translate-x-3.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </label>
          <SnapshotButton />
          <RefreshButton />
        </div>
      </div>

      {/* ── Stale warning ── */}
      {stale && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-amber-800 text-sm">
          Prices are stale — Yahoo Finance may be unreachable. Showing last known data.
        </div>
      )}

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        <Card className="flex flex-col gap-1.5 p-3">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Value</p>
            <p className="text-2xl font-bold" style={{ color: '#4338ca' }}>
              {snapshot.totalValueSGD != null ? formatSGD(snapshot.totalValueSGD) : '—'}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-500">
              USD/SGD {fxRates.USDSGD.toFixed(4)}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-500">
              HKD/SGD {fxRates.HKDSGD.toFixed(4)}
            </span>
          </div>
          <p className="text-xs text-gray-400">{fetchedAtLabel}</p>
        </Card>

        <Card className="flex flex-col gap-1.5 p-3">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">All-time Return</p>
          {allTimeReturnPct != null ? (
            <>
              <p className={`text-2xl font-bold ${gainColor}`}>{fmtPct(allTimeReturnPct)}</p>
              <p className={`text-sm font-medium ${gainColor}`}>{fmtSGDCompact(totalGainSGD)}</p>
            </>
          ) : (
            <p className="text-2xl font-bold text-gray-400">—</p>
          )}
          <p className="text-xs text-gray-400 mt-auto pt-2">Since purchase · cost basis</p>
        </Card>

        <Card className="flex flex-col gap-1.5 p-3">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Month to Date</p>
          {mtdPct != null ? (
            <>
              <p className={`text-2xl font-bold ${mtdColor}`}>{fmtPct(mtdPct)}</p>
              <p className={`text-sm font-medium ${mtdColor}`}>{fmtSGDCompact(mtdDiff!)}</p>
            </>
          ) : mtdDiff != null ? (
            <p className={`text-2xl font-bold ${mtdColor}`}>{fmtSGDCompact(mtdDiff)}</p>
          ) : (
            <p className="text-2xl font-bold text-gray-400">—</p>
          )}
          <p className="text-xs text-gray-400 mt-auto pt-2">
            {mtdStartDate ? `Since ${mtdStartDate}` : 'No history this month'}
          </p>
        </Card>

      </div>

      {/* ── Holdings table ── */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <HoldingsTable
          holdings={holdingsWithAdjustedAlloc}
          cash={{ ...snapshot.cash, allocationPct: cashAlloc }}
          grandTotalSGD={snapshot.totalValueSGD}
          excludeCash={excludeCash}
          targetAllocations={targetAllocations}
        />
      </div>

      {/* ── Allocation | History & Attribution ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        <Card className="p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Allocation</h2>
          <AllocationPanel snapshot={snapshot} excludeCash={excludeCash} />
        </Card>

        <Card className="p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">History &amp; Attribution</h2>
          {chartData.length > 0 ? (
            <HistoryClient chartData={chartData} breakdown={breakdown} />
          ) : (
            <p className="text-sm text-gray-400">
              No snapshots yet — click <span className="font-medium text-gray-600">Record Snapshot</span> above to start tracking.
            </p>
          )}
        </Card>

      </div>

    </div>
  );
}
