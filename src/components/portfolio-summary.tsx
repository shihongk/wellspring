import { PortfolioSnapshot } from '@/types';
import { formatSGD, formatDateTime } from '@/lib/fx';
import { Card } from '@/components/ui/card';

interface Props {
  snapshot: PortfolioSnapshot;
}

export function PortfolioSummary({ snapshot }: Props) {
  const { totalValueSGD, pricesStale, pricesFetchedAt, fxRates } = snapshot;

  return (
    <div className="space-y-3">
      {pricesStale && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-amber-800 text-sm">
          Prices are stale — Yahoo Finance may be unreachable. Showing last known data.
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">Total Portfolio Value</p>
            <p className="text-4xl font-bold mt-1" style={{ color: '#4338ca' }}>
              {totalValueSGD != null ? formatSGD(totalValueSGD) : '—'}
            </p>
            {pricesFetchedAt && (
              <p className="text-xs text-gray-400 mt-1">
                Prices fetched {formatDateTime(pricesFetchedAt)}
              </p>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500">
              USDSGD {fxRates.USDSGD.toFixed(4)}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500">
              HKDSGD {fxRates.HKDSGD.toFixed(4)}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
