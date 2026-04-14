import { PortfolioHolding, PortfolioSnapshot } from '@/types';
import { formatShares } from '@/lib/fx';

interface Props {
  holdings: PortfolioHolding[];
  cash: PortfolioSnapshot['cash'];
  grandTotalSGD: number | null;
  excludeCash?: boolean;
}

const nd = '—';

function fmt(v: number | null) {
  if (v == null) return nd;
  return new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', maximumFractionDigits: 0 }).format(v);
}
function fmtPct(v: number | null) { return v != null ? `${v.toFixed(2)}%` : nd; }
function fmtPrice(v: number | null) { return v != null ? v.toFixed(2) : nd; }

const cell = 'px-3 py-3 whitespace-nowrap';
const cellR = `${cell} text-right`;

export function HoldingsTable({ holdings, cash, grandTotalSGD }: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-gray-700 border-b text-xs uppercase tracking-wide">
          <tr>
            <th className={`${cell} font-semibold`}>Ticker</th>
            <th className={`${cell} font-semibold`}>Name</th>
            <th className={`${cellR} font-semibold`}>Shares</th>
            <th className={`${cellR} font-semibold`}>Avg Cost</th>
            <th className={`${cellR} font-semibold`}>Price</th>
            <th className={`${cellR} font-semibold`}>Value (local)</th>
            <th className={`${cellR} font-semibold`}>Value (SGD)</th>
            <th className={`${cellR} font-semibold`}>Gain/Loss</th>
            <th className={`${cellR} font-semibold`}>Gain %</th>
            <th className={`${cellR} font-semibold`}>Alloc</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {holdings.map((h) => {
            const gainColor = h.unrealizedGainSGD != null
              ? h.unrealizedGainSGD >= 0 ? 'text-gain' : 'text-loss'
              : '';
            return (
              <tr key={h.ticker} className="hover:bg-gray-50">
                <td className={`${cell} font-semibold`}>{h.ticker}</td>
                <td className={`${cell} text-gray-600 max-w-[180px] truncate`} title={h.name}>{h.name}</td>
                <td className={cellR}>{formatShares(h.shares)}</td>
                <td className={cellR}>{fmtPrice(h.avgCostLocal)} <span className="text-gray-400 text-xs">{h.currency}</span></td>
                <td className={cellR}>{fmtPrice(h.currentPriceLocal)}</td>
                <td className={cellR}>
                  {h.currentPriceLocal != null
                    ? <>{new Intl.NumberFormat('en-SG', { maximumFractionDigits: 0 }).format(h.shares * h.currentPriceLocal)} <span className="text-gray-400 text-xs">{h.currency}</span></>
                    : nd}
                </td>
                <td className={cellR}>{fmt(h.totalValueSGD)}</td>
                <td className={`${cellR} ${gainColor}`}>{fmt(h.unrealizedGainSGD)}</td>
                <td className={`${cellR} ${gainColor}`}>{fmtPct(h.unrealizedGainPct)}</td>
                <td className={cellR}>{fmtPct(h.allocationPct)}</td>
              </tr>
            );
          })}

          {/* Cash row */}
          <tr className="bg-gray-50/50 hover:bg-gray-100/50">
            <td className={`${cell} font-semibold`}>CASH</td>
            <td className={`${cell} text-gray-600`}>Cash (SGD)</td>
            <td className={cellR}>{nd}</td>
            <td className={cellR}>{nd}</td>
            <td className={cellR}>{nd}</td>
            <td className={cellR}>{nd}</td>
            <td className={cellR}>{fmt(cash.SGD)}</td>
            <td className={cellR}>{nd}</td>
            <td className={cellR}>{nd}</td>
            <td className={cellR}>{fmtPct(cash.allocationPct)}</td>
          </tr>

          {/* Grand total */}
          <tr className="font-bold border-t-2 bg-gray-50">
            <td className={cell} colSpan={6}>Total</td>
            <td className={cellR}>{fmt(grandTotalSGD)}</td>
            <td colSpan={3} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
