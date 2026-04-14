import { MonthlyPlanRow, PortfolioHolding, PortfolioSnapshot } from '@/types';
import { formatSGD } from '@/lib/fx';
import { Card } from '@/components/ui/card';
import { TICKER_NAME } from '@/lib/constants';

interface Props {
  plan: MonthlyPlanRow[];
  holdings: PortfolioHolding[];
  cash: PortfolioSnapshot['cash'];
}

export function PlanSummary({ plan, holdings, cash }: Props) {
  if (plan.length === 0) return null;

  return (
    <Card>
      <h2 className="text-lg font-semibold mb-3">Monthly Plan</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b">
            <tr>
              <th className="py-2 text-left font-semibold">Ticker</th>
              <th className="py-2 text-right font-semibold">Target</th>
              <th className="py-2 text-right font-semibold">Current Allocation</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {plan.map((row) => {
              const holding = holdings.find((h) => h.ticker === row.ticker);
              const allocationPct = row.ticker === 'CASH'
                ? cash.allocationPct
                : holding?.allocationPct ?? null;

              return (
                <tr key={row.ticker}>
                  <td className="py-2">
                    <div className="font-medium">{row.ticker}</div>
                    <div className="text-xs text-gray-400">{TICKER_NAME[row.ticker]}</div>
                  </td>
                  <td className="py-2 text-right">{formatSGD(row.targetSGD)}</td>
                  <td className="py-2 text-right">
                    {allocationPct != null ? `${allocationPct.toFixed(1)}%` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
