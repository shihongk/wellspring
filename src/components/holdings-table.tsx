import { PortfolioHolding, PortfolioSnapshot } from '@/types';
import { formatShares } from '@/lib/fx';
import { computeGap } from '@/lib/portfolio';

interface Props {
  holdings: PortfolioHolding[];
  cash: PortfolioSnapshot['cash'];
  grandTotalSGD: number | null;
  excludeCash?: boolean;
  targetAllocations?: Record<string, number>;
}

const nd = '—';

function fmt(v: number | null) {
  if (v == null) return nd;
  return new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', maximumFractionDigits: 0 }).format(v);
}
function fmtPct(v: number | null) { return v != null ? `${v.toFixed(2)}%` : nd; }
function fmtPrice(v: number | null) { return v != null ? v.toFixed(2) : nd; }

// Column group bg tints — applied to both <th> and <td> for visual banding
const tint = {
  identity: '',                          // Ticker, Name — no tint
  position: 'bg-blue-50/40',            // Shares, Avg Cost
  market:   'bg-indigo-50/40',          // Price, Value (local), Value (SGD)
  perf:     'bg-emerald-50/40',         // Gain/Loss, Gain %
  alloc:    'bg-violet-50/40',          // Alloc, Target %, Gap
};

const cell  = 'px-2 py-1.5 whitespace-nowrap';
const cellR = `${cell} text-right`;

// Helpers that combine alignment + tint
const th  = (t: string) => `${cell}  font-semibold ${t}`;
const thR = (t: string) => `${cellR} font-semibold ${t}`;
const td  = (t: string) => `${cell}  ${t}`;
const tdR = (t: string) => `${cellR} ${t}`;

export function HoldingsTable({ holdings, cash, grandTotalSGD, targetAllocations }: Props) {
  // Total gain/loss: sum unrealised gains for holdings with known prices only
  const holdingsWithGain = holdings.filter((h) => h.unrealizedGainSGD != null);
  const totalGainSGD = holdingsWithGain.length > 0
    ? holdingsWithGain.reduce((s, h) => s + h.unrealizedGainSGD!, 0)
    : null;
  const totalCostBasis = holdingsWithGain.reduce((s, h) => s + h.costBasisSGD, 0);
  const totalGainPct = totalGainSGD != null && totalCostBasis > 0
    ? (totalGainSGD / totalCostBasis) * 100
    : null;
  const totalGainColor = totalGainSGD != null
    ? totalGainSGD >= 0 ? 'text-gain' : 'text-loss'
    : '';

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="text-gray-600 border-b text-xs uppercase tracking-wide">
          <tr>
            {/* Identity */}
            <th className={th(tint.identity)}>Ticker</th>
            <th className={th(tint.identity)}>Name</th>
            {/* Position */}
            <th className={thR(tint.position)}>Shares</th>
            <th className={thR(tint.position)}>Avg Cost</th>
            {/* Market */}
            <th className={thR(tint.market)}>Price</th>
            <th className={thR(tint.market)}>Value (local)</th>
            <th className={thR(tint.market)}>Value (SGD)</th>
            {/* Performance */}
            <th className={thR(tint.perf)}>Gain/Loss</th>
            <th className={thR(tint.perf)}>Gain %</th>
            {/* Allocation */}
            <th className={thR(tint.alloc)}>Alloc</th>
            <th className={thR(tint.alloc)}>Target %</th>
            <th className={thR(tint.alloc)}>Gap</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {holdings.map((h) => {
            const gainColor = h.unrealizedGainSGD != null
              ? h.unrealizedGainSGD >= 0 ? 'text-gain font-medium' : 'text-loss font-medium'
              : '';

            const targetPct = targetAllocations?.[h.ticker];
            const hasTarget = targetPct != null && targetPct > 0;
            let gapDisplay: React.ReactNode = <span className="text-gray-300">{nd}</span>;
            if (hasTarget && h.allocationPct != null) {
              const gap = computeGap(targetPct, h.allocationPct);
              const gapColor = gap > 0 ? 'text-gain font-medium' : gap < 0 ? 'text-loss font-medium' : 'text-gray-400';
              gapDisplay = <span className={gapColor}>{gap > 0 ? '+' : ''}{gap.toFixed(1)}%</span>;
            }

            return (
              <tr key={h.ticker} className="hover:bg-gray-50/80 transition-colors">
                {/* Identity */}
                <td className={`${td(tint.identity)} font-semibold text-gray-900`}>{h.ticker}</td>
                <td className={`${td(tint.identity)} text-gray-500`} title={h.name}>{h.name}</td>
                {/* Position */}
                <td className={tdR(tint.position)}>{formatShares(h.shares)}</td>
                <td className={tdR(tint.position)}>
                  {fmtPrice(h.avgCostLocal)}{' '}
                  <span className="text-gray-400 text-xs">{h.currency}</span>
                </td>
                {/* Market */}
                <td className={tdR(tint.market)}>{fmtPrice(h.currentPriceLocal)}</td>
                <td className={tdR(tint.market)}>
                  {h.currentPriceLocal != null
                    ? <>{new Intl.NumberFormat('en-SG', { maximumFractionDigits: 0 }).format(h.shares * h.currentPriceLocal)}{' '}<span className="text-gray-400 text-xs">{h.currency}</span></>
                    : nd}
                </td>
                <td className={`${tdR(tint.market)} font-medium`}>{fmt(h.totalValueSGD)}</td>
                {/* Performance */}
                <td className={`${tdR(tint.perf)} ${gainColor}`}>{fmt(h.unrealizedGainSGD)}</td>
                <td className={`${tdR(tint.perf)} ${gainColor}`}>{fmtPct(h.unrealizedGainPct)}</td>
                {/* Allocation */}
                <td className={tdR(tint.alloc)}>{fmtPct(h.allocationPct)}</td>
                <td className={`${tdR(tint.alloc)} text-gray-500`}>{hasTarget ? `${targetPct.toFixed(1)}%` : <span className="text-gray-300">{nd}</span>}</td>
                <td className={tdR(tint.alloc)}>{gapDisplay}</td>
              </tr>
            );
          })}

          {/* Cash row */}
          <tr className="border-t bg-slate-50/60 hover:bg-slate-100/60 transition-colors">
            <td className={`${td(tint.identity)} font-semibold text-gray-500`}>CASH</td>
            <td className={`${td(tint.identity)} text-gray-400`}>Cash (SGD)</td>
            <td className={tdR(tint.position)}>{nd}</td>
            <td className={tdR(tint.position)}>{nd}</td>
            <td className={tdR(tint.market)}>{nd}</td>
            <td className={tdR(tint.market)}>{nd}</td>
            <td className={`${tdR(tint.market)} font-medium`}>{fmt(cash.SGD)}</td>
            <td className={tdR(tint.perf)}>{nd}</td>
            <td className={tdR(tint.perf)}>{nd}</td>
            <td className={tdR(tint.alloc)}>{fmtPct(cash.allocationPct)}</td>
            <td className={tdR(tint.alloc)}>{nd}</td>
            <td className={tdR(tint.alloc)}>{nd}</td>
          </tr>

          {/* Total row */}
          <tr className="font-bold border-t-2 bg-gray-50">
            <td className={cell} colSpan={6}>Total</td>
            <td className={`${cellR} font-bold`}>{fmt(grandTotalSGD)}</td>
            <td className={`${cellR} font-bold ${totalGainColor}`}>{fmt(totalGainSGD)}</td>
            <td className={`${cellR} font-bold ${totalGainColor}`}>{fmtPct(totalGainPct)}</td>
            <td colSpan={3} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
