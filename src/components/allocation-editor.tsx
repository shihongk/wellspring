'use client';

import { useState, useTransition } from 'react';
import { TargetAllocationRow } from '@/types';
import { EQUITY_TICKERS, TICKER_NAME } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

interface Props {
  initialAllocations: TargetAllocationRow[];
  cashSGD: number;
  action: (rows: TargetAllocationRow[]) => Promise<void>;
}

export function AllocationEditor({ initialAllocations, cashSGD, action }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const initialValues = Object.fromEntries(
    EQUITY_TICKERS.map((ticker) => {
      const row = initialAllocations.find((r) => r.ticker === ticker);
      return [ticker, row?.targetPct?.toString() ?? '0'];
    })
  );

  const [values, setValues] = useState<Record<string, string>>(initialValues);

  const total = EQUITY_TICKERS.reduce((sum, ticker) => sum + (parseFloat(values[ticker]) || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const rows: TargetAllocationRow[] = EQUITY_TICKERS.map((ticker) => ({
      ticker,
      targetPct: parseFloat(values[ticker]) || 0,
    }));

    startTransition(async () => {
      try {
        await action(rows);
        setSaved(true);
      } catch (err) {
        setError(String(err));
      }
    });
  };

  const fmtSGD = (v: number) =>
    new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', maximumFractionDigits: 0 }).format(v);

  return (
    <Card>
      <h2 className="text-lg font-semibold mb-3">Target Allocation</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="text-loss text-sm font-medium">{error}</div>}
        {saved && <div className="text-gain text-sm font-medium">Allocations saved.</div>}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="py-2 text-left font-semibold">Ticker</th>
                <th className="py-2 text-right font-semibold">Target %</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {EQUITY_TICKERS.map((ticker) => (
                <tr key={ticker}>
                  <td className="py-2">
                    <div className="font-medium">{ticker}</div>
                    <div className="text-xs text-gray-400">{TICKER_NAME[ticker]}</div>
                  </td>
                  <td className="py-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={values[ticker]}
                      onChange={(e) => setValues({ ...values, [ticker]: e.target.value })}
                      className="text-right w-28 ml-auto"
                    />
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50/50">
                <td className="py-2">
                  <div className="font-medium text-gray-500">CASH</div>
                  <div className="text-xs text-gray-400">Available to invest</div>
                </td>
                <td className="py-2 text-right text-gray-500">{fmtSGD(cashSGD)}</td>
              </tr>
              <tr className="font-bold border-t-2">
                <td className="py-2">Total</td>
                <td className="py-2 text-right">
                  <span className={total > 100 ? 'text-loss' : total === 100 ? 'text-gain' : ''}>
                    {total.toFixed(1)}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : 'Save Allocations'}
        </Button>
      </form>
    </Card>
  );
}
