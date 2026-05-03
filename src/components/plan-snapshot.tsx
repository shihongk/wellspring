'use client';

import { PortfolioSnapshot, TargetAllocationRow } from '@/types';
import { computeGap } from '@/lib/portfolio';
import { TICKER_NAME } from '@/lib/constants';

interface Props {
  snapshot: PortfolioSnapshot;
  targetAllocations: TargetAllocationRow[];
}

const nd = '—';
function fmtPct(v: number | null) { return v != null ? `${v.toFixed(1)}%` : nd; }
function fmtSGD(v: number | null) {
  if (v == null) return nd;
  return new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', maximumFractionDigits: 0 }).format(v);
}

/**
 * Cash-constrained buy recommendations using iterative convergence.
 *
 * Buying increases the total portfolio value, which shifts the target values —
 * so we iterate until the allocations converge (typically 3-5 rounds).
 *
 * Each iteration:
 *   1. newTotal = currentEquityTotal + cashRemaining
 *   2. toBuy[i] = max(0, targetPct[i]% * newTotal - currentValue[i])
 *   3. If sum(toBuy) <= cashRemaining → done
 *   4. Otherwise scale toBuy proportionally to cashRemaining and repeat
 */
function computeBuyRecommendations(
  holdings: PortfolioSnapshot['holdings'],
  cashSGD: number,
  targetMap: Record<string, number>,
): Record<string, { buySGD: number; note: 'full' | 'partial' }> {
  const equityTotal = holdings.reduce((s, h) => s + (h.totalValueSGD ?? 0), 0);

  // Working copy of current values
  const currentValue: Record<string, number> = {};
  for (const h of holdings) {
    if (h.totalValueSGD != null) currentValue[h.ticker] = h.totalValueSGD;
  }

  const accumulated: Record<string, number> = {};
  let cashLeft = cashSGD;

  for (let iter = 0; iter < 20; iter++) {
    const deployedSoFar = Object.values(accumulated).reduce((s, v) => s + v, 0);
    const newTotal = equityTotal + deployedSoFar + cashLeft;

    const raw: Record<string, number> = {};
    let totalRaw = 0;

    for (const h of holdings) {
      const targetPct = targetMap[h.ticker];
      if (!targetPct || targetPct <= 0 || currentValue[h.ticker] == null) continue;
      const targetValue = (targetPct / 100) * newTotal;
      const alreadyBuying = accumulated[h.ticker] ?? 0;
      const toBuy = targetValue - currentValue[h.ticker] - alreadyBuying;
      if (toBuy > 0.01) {
        raw[h.ticker] = toBuy;
        totalRaw += toBuy;
      }
    }

    if (totalRaw <= 0.01) break; // converged

    if (totalRaw <= cashLeft + 0.01) {
      // Cash covers everything — add remainder and done
      for (const [ticker, amount] of Object.entries(raw)) {
        accumulated[ticker] = (accumulated[ticker] ?? 0) + amount;
      }
      cashLeft -= totalRaw;
      break;
    }

    // Scale to fit remaining cash, then loop to recheck
    const scale = cashLeft / totalRaw;
    for (const [ticker, amount] of Object.entries(raw)) {
      accumulated[ticker] = (accumulated[ticker] ?? 0) + amount * scale;
    }
    cashLeft = 0;
    break; // cash exhausted
  }

  if (Object.keys(accumulated).length === 0) return {};

  const totalSpend = Object.values(accumulated).reduce((s, v) => s + v, 0);
  const isPartial = totalSpend > cashSGD - 0.5; // used (nearly) all cash

  const result: Record<string, { buySGD: number; note: 'full' | 'partial' }> = {};
  for (const [ticker, amount] of Object.entries(accumulated)) {
    if (amount > 0.01) {
      result[ticker] = { buySGD: amount, note: isPartial ? 'partial' : 'full' };
    }
  }
  return result;
}

export function PlanSnapshot({ snapshot, targetAllocations }: Props) {
  const targetMap = Object.fromEntries(targetAllocations.map((r) => [r.ticker, r.targetPct]));
  const totalSGD = snapshot.totalValueSGD;
  const cashSGD = snapshot.cash.SGD;

  const equityTotal = snapshot.holdings.reduce((s, h) => s + (h.totalValueSGD ?? 0), 0);

  const buyRecs = computeBuyRecommendations(snapshot.holdings, cashSGD, targetMap);
  const totalToBuy = Object.values(buyRecs).reduce((s, r) => s + r.buySGD, 0);
  const isPartial = Object.values(buyRecs).some((r) => r.note === 'partial');
  const cashRemaining = cashSGD - totalToBuy;

  // Pre-compute per-row derived values so we can sum them for the totals row
  const rows = snapshot.holdings.map((h) => {
    const targetPct = targetMap[h.ticker];
    const hasTarget = targetPct != null && targetPct > 0;
    // Use equity-only alloc (same basis as dashboard with excludeCash=true)
    const equityOnlyAlloc = equityTotal > 0 && h.totalValueSGD != null
      ? (h.totalValueSGD / equityTotal) * 100
      : null;
    const gap = hasTarget && equityOnlyAlloc != null ? computeGap(targetPct, equityOnlyAlloc) : null;
    const rec = buyRecs[h.ticker];
    const buySGD = rec?.buySGD ?? null;
    const buyUnits = buySGD != null && h.currentPriceSGD != null && h.currentPriceSGD > 0
      ? Math.floor(buySGD / h.currentPriceSGD)
      : null;
    return { h, targetPct, hasTarget, gap, rec, buySGD, buyUnits, equityOnlyAlloc };
  });

  const sumValue    = rows.reduce((s, r) => s + (r.h.totalValueSGD ?? 0), 0);
  const sumGain     = rows.every(r => r.h.unrealizedGainSGD != null)
    ? rows.reduce((s, r) => s + (r.h.unrealizedGainSGD ?? 0), 0)
    : null;
  const sumBuySGD   = totalToBuy > 0 ? totalToBuy : null;
  const sumBuyUnits = rows.reduce((s, r) => s + (r.buyUnits ?? 0), 0);

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 border-b bg-gray-50 gap-2">
        <span className="text-sm font-semibold text-gray-700">Current Portfolio</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            Total: <span className="font-semibold text-gray-800">{fmtSGD(totalSGD)}</span>
          </span>
          <span className="text-xs text-gray-400">
            FX: USD {snapshot.fxRates.USDSGD.toFixed(4)} · HKD {snapshot.fxRates.HKDSGD.toFixed(4)}
          </span>
          {snapshot.pricesStale && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
              ⚠ Stale prices
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead className="text-xs uppercase tracking-wide text-gray-400 border-b">
          <tr>
            <th className="px-4 py-2 text-left font-semibold">Ticker</th>
            <th className="px-4 py-2 text-right font-semibold">Value (SGD)</th>
            <th className="px-4 py-2 text-right font-semibold">Price</th>
            <th className="px-4 py-2 text-right font-semibold">Alloc %</th>
            <th className="px-4 py-2 text-right font-semibold">Target %</th>
            <th className="px-4 py-2 text-right font-semibold">Gap</th>
            <th className="px-4 py-2 text-right font-semibold">To Buy (SGD)</th>
            <th className="px-4 py-2 text-right font-semibold">To Buy (units)</th>
            <th className="px-4 py-2 text-right font-semibold">Gain/Loss</th>
            <th className="px-4 py-2 text-right font-semibold">Gain %</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map(({ h, targetPct, hasTarget, gap, rec, buySGD, buyUnits, equityOnlyAlloc }) => {
            const gapColor = gap == null ? '' : gap > 0 ? 'text-gain' : gap < 0 ? 'text-loss' : 'text-gray-500';
            const gainColor = h.unrealizedGainSGD != null
              ? h.unrealizedGainSGD >= 0 ? 'text-gain' : 'text-loss'
              : '';

            return (
              <tr key={h.ticker} className="hover:bg-gray-50">
                <td className="px-4 py-2">
                  <span className="font-semibold">{h.ticker}</span>
                  <span className="ml-2 text-xs text-gray-400">{TICKER_NAME[h.ticker]}</span>
                </td>
                <td className="px-4 py-2 text-right">{fmtSGD(h.totalValueSGD)}</td>
                <td className="px-4 py-2 text-right text-gray-500">
                  {h.currentPriceLocal != null
                    ? <>{h.currentPriceLocal.toFixed(2)} <span className="text-xs text-gray-400">{h.currency}</span></>
                    : nd}
                </td>
                <td className="px-4 py-2 text-right">{fmtPct(equityOnlyAlloc)}</td>
                <td className="px-4 py-2 text-right text-gray-500">{hasTarget ? `${targetPct.toFixed(1)}%` : nd}</td>
                <td className={`px-4 py-2 text-right font-medium ${gapColor}`}>
                  {gap != null ? `${gap > 0 ? '+' : ''}${gap.toFixed(1)}%` : nd}
                </td>
                <td className="px-4 py-2 text-right font-medium">
                  {buySGD != null ? (
                    <span className="text-gain">
                      {fmtSGD(buySGD)}
                      {rec?.note === 'partial' && (
                        <span className="ml-1 text-xs text-amber-500" title="Cash insufficient to fully close gap — amount scaled down proportionally">~</span>
                      )}
                    </span>
                  ) : <span className="text-gray-300">{nd}</span>}
                </td>
                <td className="px-4 py-2 text-right font-medium">
                  {buyUnits != null ? (
                    <span className="text-gain">{buyUnits.toLocaleString()}</span>
                  ) : <span className="text-gray-300">{nd}</span>}
                </td>
                <td className={`px-4 py-2 text-right ${gainColor}`}>{fmtSGD(h.unrealizedGainSGD)}</td>
                <td className={`px-4 py-2 text-right ${gainColor}`}>
                  {h.unrealizedGainPct != null ? `${h.unrealizedGainPct.toFixed(2)}%` : nd}
                </td>
              </tr>
            );
          })}

          {/* Equity totals row */}
          <tr className="font-semibold border-t-2 bg-gray-50 text-gray-700">
            <td className="px-4 py-2 text-xs uppercase tracking-wide text-gray-400">Equity total</td>
            <td className="px-4 py-2 text-right">{fmtSGD(sumValue)}</td>
            <td className="px-4 py-2 text-right text-gray-300">{nd}</td>
            <td className="px-4 py-2 text-right text-gray-300">{nd}</td>
            <td className="px-4 py-2 text-right text-gray-300">{nd}</td>
            <td className="px-4 py-2 text-right text-gray-300">{nd}</td>
            <td className="px-4 py-2 text-right text-gain">
              {sumBuySGD != null ? (
                <>{fmtSGD(sumBuySGD)}{isPartial && <span className="ml-1 text-xs text-amber-500">~</span>}</>
              ) : nd}
            </td>
            <td className="px-4 py-2 text-right text-gain">
              {sumBuyUnits > 0 ? sumBuyUnits.toLocaleString() : nd}
            </td>
            <td className={`px-4 py-2 text-right ${sumGain != null ? sumGain >= 0 ? 'text-gain' : 'text-loss' : ''}`}>
              {fmtSGD(sumGain)}
            </td>
            <td className="px-4 py-2 text-right text-gray-300">{nd}</td>
          </tr>

          {/* Cash row */}
          <tr className="bg-gray-50/50">
            <td className="px-4 py-2">
              <span className="font-semibold text-gray-500">CASH</span>
              <span className="ml-2 text-xs text-gray-400">Available to invest</span>
            </td>
            <td className="px-4 py-2 text-right">{fmtSGD(cashSGD)}</td>
            <td className="px-4 py-2 text-right text-gray-400">{nd}</td>
            <td className="px-4 py-2 text-right">{fmtPct(snapshot.cash.allocationPct)}</td>
            <td className="px-4 py-2 text-right text-gray-400">{nd}</td>
            <td className="px-4 py-2 text-right text-gray-400">{nd}</td>
            <td className="px-4 py-2 text-right text-xs text-gray-500" colSpan={2}>
              {totalToBuy > 0 && (
                <span>
                  Deploy {fmtSGD(totalToBuy)}
                  {isPartial && <span className="ml-1 text-amber-500">~</span>}
                  {cashRemaining > 0.5 && <span className="ml-2 text-gray-400">· {fmtSGD(cashRemaining)} left</span>}
                </span>
              )}
            </td>
            <td colSpan={2} />
          </tr>

          {/* Grand total row */}
          <tr className="font-bold border-t-2 bg-gray-100 text-gray-800">
            <td className="px-4 py-2 text-xs uppercase tracking-wide text-gray-400">Grand total</td>
            <td className="px-4 py-2 text-right">{fmtSGD(sumValue + cashSGD)}</td>
            <td className="px-4 py-2 text-right text-gray-300">{nd}</td>
            <td className="px-4 py-2 text-right text-gray-300">{nd}</td>
            <td className="px-4 py-2 text-right text-gray-300">{nd}</td>
            <td className="px-4 py-2 text-right text-gray-300">{nd}</td>
            <td className="px-4 py-2 text-right text-gain">
              {sumBuySGD != null ? fmtSGD(sumBuySGD) : nd}
            </td>
            <td className="px-4 py-2 text-right text-gain">
              {sumBuyUnits > 0 ? sumBuyUnits.toLocaleString() : nd}
            </td>
            <td className={`px-4 py-2 text-right ${sumGain != null ? sumGain >= 0 ? 'text-gain' : 'text-loss' : ''}`}>
              {fmtSGD(sumGain)}
            </td>
            <td className="px-4 py-2 text-right text-gray-300">{nd}</td>
          </tr>
        </tbody>
      </table>

      </div>

      {isPartial && (
        <div className="px-4 py-2 border-t bg-amber-50 text-xs text-amber-700">
          ~ Cash is insufficient to fully close all gaps. Amounts are scaled proportionally to your available {fmtSGD(cashSGD)}.
        </div>
      )}
    </div>
  );
}
