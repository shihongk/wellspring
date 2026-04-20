'use client';

import { useState } from 'react';
import { ValueHistoryChart } from '@/components/value-history-chart';

type Range = '1D' | 'YTD' | '1M' | '3M' | '6M' | '1Y' | 'ALL';
const RANGES: Range[] = ['1D', 'YTD', '1M', '3M', '6M', '1Y', 'ALL'];
const RANGE_DAYS: Record<Range, number | null> = {
  '1D': 1,
  'YTD': null,
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
  'ALL': null,
};

interface DataPoint {
  date: string;
  totalValueSGD: number;
}

export interface BreakdownItem {
  ticker: string;
  name: string;
  valueSGD: number;
  allocationPct: number;
  color: string;
  /** Cost basis in SGD — used for ALL-time contribution (undefined for cash) */
  costBasisSGD?: number;
  /** Unrealized gain in SGD — used for ALL-time contribution (null if price unavailable) */
  unrealizedGainSGD?: number | null;
}

interface Props {
  chartData: DataPoint[];
  breakdown: BreakdownItem[];
}

function filterByRange(data: DataPoint[], range: Range): DataPoint[] {
  if (range === 'ALL' || data.length === 0) return data;
  if (range === '1D') return data.slice(-2);
  if (range === 'YTD') {
    const jan1 = `${new Date().getFullYear()}-01-01`;
    return data.filter((d) => d.date >= jan1);
  }
  const days = RANGE_DAYS[range]!;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return data.filter((d) => d.date >= cutoffStr);
}

function fmtSGD(value: number): string {
  // Compact format: S$289K or S$1.2M
  if (value >= 1_000_000) return 'S$' + (value / 1_000_000).toFixed(1) + 'M';
  if (value >= 1_000) return 'S$' + (value / 1_000).toFixed(1) + 'K';
  return 'S$' + value.toFixed(0);
}

function fmtSGDFull(value: number): string {
  return 'S$' + value.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-SG', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export function HistoryClient({ chartData, breakdown }: Props) {
  const [range, setRange] = useState<Range>('1Y');
  const filtered = filterByRange(chartData, range);
  const isAll = range === 'ALL';

  // ── ALL: use cost basis as reference (equity only, matching dashboard calculation) ──
  // Cash is excluded from the denominator — same as dashboard's totalCostBasis
  const totalValueSGD = breakdown.reduce((s, r) => s + r.valueSGD, 0);
  const equityItems   = breakdown.filter((r) => r.ticker !== 'CASH' && r.unrealizedGainSGD != null);
  const equityCostBasis  = equityItems.reduce((s, r) => s + (r.costBasisSGD ?? 0), 0);
  const equityTotalGain  = equityItems.reduce((s, r) => s + r.unrealizedGainSGD!, 0);
  const allTimeReturn    = equityCostBasis > 0 ? (equityTotalGain / equityCostBasis) * 100 : null;

  function allTimeContributionPP(row: BreakdownItem): number | null {
    if (row.ticker === 'CASH' || row.unrealizedGainSGD == null || equityCostBasis <= 0) return null;
    return (row.unrealizedGainSGD / equityCostBasis) * 100;
  }

  // ── Period ranges: use history snapshot values ───────────────────────────────
  let periodReturn: number | null = null;
  let periodStartValue: number | null = null;
  let periodEndValue: number | null = null;
  let periodStartDate: string | null = null;
  if (!isAll && filtered.length >= 2) {
    periodStartValue = filtered[0].totalValueSGD;
    periodEndValue   = filtered[filtered.length - 1].totalValueSGD;
    periodStartDate  = filtered[0].date;
    periodReturn = periodStartValue > 0
      ? ((periodEndValue - periodStartValue) / periodStartValue) * 100
      : null;
  }

  // ── Derived display values ───────────────────────────────────────────────────
  const displayReturn     = isAll ? allTimeReturn   : periodReturn;
  // For ALL: cost basis → current equity value (mirrors dashboard's gain / costBasis)
  const displayStartValue = isAll ? equityCostBasis : periodStartValue;
  const displayEndValue   = isAll ? (equityCostBasis + equityTotalGain) : periodEndValue;
  const displayDiff       = displayStartValue != null && displayEndValue != null
    ? displayEndValue - displayStartValue : null;

  function getContributionPP(row: BreakdownItem): number | null {
    if (isAll) return allTimeContributionPP(row);
    return periodReturn != null ? (row.allocationPct / 100) * periodReturn : null;
  }

  return (
    <div>
      {/* Shared range selector */}
      <div className="flex gap-1 mb-3">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              r === range
                ? 'text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
            style={r === range ? { backgroundColor: '#0f766e' } : undefined}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Side-by-side layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">

        {/* Left: chart — h-full so SVG stretches to match right column height */}
        <div className="flex flex-col h-full">
          <ValueHistoryChart data={chartData} range={range} />
        </div>

        {/* Right: contribution breakdown */}
        <div className="flex flex-col">
          {/* Period / all-time summary header */}
          <div className="flex items-baseline justify-between mb-1">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                {isAll ? 'All-time Return' : range === '1D' ? '1-Day Return' : range === 'YTD' ? 'YTD Return' : `${range} Return`}
              </p>
              {displayReturn != null ? (
                <p className={`text-2xl font-bold ${displayReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {displayReturn >= 0 ? '+' : ''}{displayReturn.toFixed(2)}%
                </p>
              ) : (
                <p className="text-2xl font-bold text-gray-400">—</p>
              )}
            </div>
            {displayStartValue != null && displayEndValue != null && (
              <div className="text-right">
                <p className="text-xs text-gray-400">
                  {fmtSGD(displayStartValue)} → {fmtSGD(displayEndValue)}
                </p>
                {displayDiff != null && (
                  <p className={`text-xs font-medium ${displayDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {displayDiff >= 0 ? '+' : ''}{fmtSGDFull(displayDiff)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Reference date label */}
          <p className="text-xs text-gray-400 mb-2">
            {isAll
              ? 'Since purchase — cost basis'
              : periodStartDate
                ? `Since ${fmtDate(periodStartDate)}`
                : 'Insufficient data for this range'}
          </p>

          {/* Rows — compact single-line */}
          <div className="space-y-0.5">
            {breakdown.map((row) => {
              const pp = getContributionPP(row);
              return (
                <div key={row.ticker} className="flex items-center gap-2 py-1 text-xs">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }} />
                  <span className="font-semibold text-gray-800 w-16 shrink-0">{row.ticker}</span>
                  <span className="text-gray-400 truncate flex-1 min-w-0">{row.name}</span>
                  <span className="text-gray-500 shrink-0 w-14 text-right">{fmtSGD(row.valueSGD)}</span>
                  {pp != null ? (
                    <span className={`font-semibold w-16 text-right whitespace-nowrap shrink-0 ${pp >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {pp >= 0 ? '+' : ''}{pp.toFixed(2)} pp
                    </span>
                  ) : (
                    <span className="text-gray-400 w-16 text-right shrink-0">—</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-auto pt-2 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">Current total</span>
            <span className="text-sm font-bold text-gray-900">{fmtSGDFull(totalValueSGD)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
