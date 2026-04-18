export const dynamic = 'force-dynamic';

import { getPortfolioHistory, getHoldings, getCash } from '@/lib/google-sheets';
import { fetchPricesAndFx } from '@/lib/yahoo-finance';
import { computePortfolioSnapshot } from '@/lib/portfolio';
import { Card } from '@/components/ui/card';
import { Stat } from '@/components/ui/stat';
import { SnapshotButton } from '@/components/snapshot-button';
import { HistoryClient, type BreakdownItem } from '@/components/history-client';

const TICKER_COLORS: Record<string, string> = {
  'BRK-B':   '#0f766e',
  'JK8.SI':  '#0369a1',
  '2823.HK': '#7c3aed',
  '2838.HK': '#b45309',
  'CASH':    '#64748b',
};

function formatSGD(value: number): string {
  return 'S$' + value.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatChange(diff: number, pct: number): string {
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${formatSGD(diff)} (${sign}${pct.toFixed(1)}%)`;
}

export default async function HistoryPage() {
  const [history, holdings, cash, { fxRates, prices, stale, fetchedAt }] = await Promise.all([
    getPortfolioHistory(),
    getHoldings(),
    getCash(),
    fetchPricesAndFx(),
  ]);

  const snapshot = computePortfolioSnapshot(holdings, prices, fxRates, cash, stale, fetchedAt);
  const chartData = history.map((e) => ({ date: e.date, totalValueSGD: e.totalValueSGD }));

  // Stats derived from history
  let stats: {
    latest: typeof history[0];
    monthDiff: number; monthPct: number;
    allTimeDiff: number; allTimePct: number;
  } | null = null;

  if (history.length > 0) {
    const latest = history[history.length - 1];
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthEntries = history.filter((e) => e.date.startsWith(thisMonth));
    const monthStart = monthEntries.length > 0 ? monthEntries[0] : latest;
    const monthDiff = latest.totalValueSGD - monthStart.totalValueSGD;
    const monthPct = monthStart.totalValueSGD > 0 ? (monthDiff / monthStart.totalValueSGD) * 100 : 0;
    const first = history[0];
    const allTimeDiff = latest.totalValueSGD - first.totalValueSGD;
    const allTimePct = first.totalValueSGD > 0 ? (allTimeDiff / first.totalValueSGD) * 100 : 0;
    stats = { latest, monthDiff, monthPct, allTimeDiff, allTimePct };
  }

  // Build breakdown items from current snapshot (equity rows sorted by value, cash last)
  const total = snapshot.totalValueSGD ?? 0;
  const breakdown: BreakdownItem[] = [
    ...snapshot.holdings
      .filter((h) => h.totalValueSGD != null)
      .map((h) => ({
        ticker: h.ticker,
        name: h.name,
        valueSGD: h.totalValueSGD!,
        allocationPct: h.allocationPct ?? (h.totalValueSGD! / total) * 100,
        color: TICKER_COLORS[h.ticker] ?? '#94a3b8',
        costBasisSGD: h.costBasisSGD,
        unrealizedGainSGD: h.unrealizedGainSGD,
      }))
      .sort((a, b) => b.valueSGD - a.valueSGD),
    {
      ticker: 'CASH',
      name: 'Cash',
      valueSGD: snapshot.cash.SGD,
      allocationPct: snapshot.cash.allocationPct ?? (snapshot.cash.SGD / total) * 100,
      color: TICKER_COLORS['CASH'],
      // cash has no unrealized gain — cost basis treated as current value
      costBasisSGD: snapshot.cash.SGD,
      unrealizedGainSGD: 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Portfolio History</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {history.length > 0
              ? `${history.length} snapshot${history.length !== 1 ? 's' : ''} recorded`
              : 'No snapshots yet'}
          </p>
        </div>
        <SnapshotButton />
      </div>

      {stats ? (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <Stat label="Latest value" value={formatSGD(stats.latest.totalValueSGD)} />
              <p className="text-xs text-gray-400 mt-1">
                {new Date(stats.latest.date + 'T00:00:00').toLocaleDateString('en-SG', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </p>
            </Card>
            <Card>
              <Stat
                label="Month to date"
                value={
                  <span className={stats.monthDiff >= 0 ? 'text-gain' : 'text-loss'}>
                    {formatChange(stats.monthDiff, stats.monthPct)}
                  </span>
                }
              />
              <p className="text-xs text-gray-400 mt-1">Since start of this month</p>
            </Card>
            <Card>
              <Stat
                label="All-time change"
                value={
                  <span className={stats.allTimeDiff >= 0 ? 'text-gain' : 'text-loss'}>
                    {formatChange(stats.allTimeDiff, stats.allTimePct)}
                  </span>
                }
              />
              <p className="text-xs text-gray-400 mt-1">
                Since{' '}
                {new Date(history[0].date + 'T00:00:00').toLocaleDateString('en-SG', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </p>
            </Card>
          </div>

          {/* Chart + Breakdown (shared range selector) */}
          <Card className="p-6">
            <HistoryClient chartData={chartData} breakdown={breakdown} />
          </Card>
        </>
      ) : (
        <Card className="py-16">
          <div className="text-center space-y-2">
            <p className="text-gray-500 font-medium">No snapshots recorded yet</p>
            <p className="text-sm text-gray-400">
              Click &ldquo;Record Snapshot&rdquo; above, or visit your dashboard to auto-record one.
            </p>
            <p className="text-xs text-gray-400 mt-2">
              For automatic daily snapshots, run:{' '}
              <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">npx tsx scripts/snapshot.ts</code>
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
