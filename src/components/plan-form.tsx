'use client';

import { useState, useTransition } from 'react';
import { MonthlyPlanRow } from '@/types';
import { ALL_TICKERS, TICKER_NAME } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { formatSGD } from '@/lib/fx';

interface Props {
  plan: MonthlyPlanRow[];
  action: (plan: MonthlyPlanRow[]) => Promise<void>;
}

export function PlanForm({ plan, action }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const initialValues = Object.fromEntries(
    ALL_TICKERS.map((ticker) => {
      const row = plan.find((p) => p.ticker === ticker);
      return [ticker, row?.targetSGD?.toString() ?? '0'];
    })
  );

  const [values, setValues] = useState<Record<string, string>>(initialValues);

  const total = ALL_TICKERS.reduce((sum, ticker) => sum + (parseFloat(values[ticker]) || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const planRows: MonthlyPlanRow[] = ALL_TICKERS.map((ticker) => ({
      ticker,
      targetSGD: parseFloat(values[ticker]) || 0,
    }));

    startTransition(async () => {
      try {
        await action(planRows);
        setSaved(true);
      } catch (err) {
        setError(String(err));
      }
    });
  };

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="text-loss text-sm font-medium">{error}</div>}
        {saved && <div className="text-gain text-sm font-medium">Plan saved.</div>}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="py-2 text-left font-semibold">Ticker</th>
                <th className="py-2 text-right font-semibold">Target (SGD)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ALL_TICKERS.map((ticker) => (
                <tr key={ticker}>
                  <td className="py-2">
                    <div className="font-medium">{ticker}</div>
                    <div className="text-xs text-gray-400">{TICKER_NAME[ticker]}</div>
                  </td>
                  <td className="py-2">
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={values[ticker]}
                      onChange={(e) => setValues({ ...values, [ticker]: e.target.value })}
                      className="text-right w-36 ml-auto"
                    />
                  </td>
                </tr>
              ))}
              <tr className="font-bold border-t-2">
                <td className="py-2">Total</td>
                <td className="py-2 text-right">{formatSGD(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : 'Save Plan'}
        </Button>
      </form>
    </Card>
  );
}
