'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Holding, Currency } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { TICKER_NAME, TICKER_CURRENCY, ALL_TICKERS } from '@/lib/constants';

interface Props {
  holding?: Holding;
  action: (data: Holding) => Promise<void>;
}

export function HoldingForm({ holding, action }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    ticker: holding?.ticker || '',
    name: holding?.name || '',
    shares: holding?.shares?.toString() ?? '',
    avgCostLocal: holding?.avgCostLocal?.toString() ?? '',
    currency: holding?.currency || 'SGD',
  });

  const isEdit = !!holding;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    startTransition(async () => {
      try {
        await action({
          ...formData,
          shares: parseFloat(formData.shares.toString()) || 0,
          avgCostLocal: parseFloat(formData.avgCostLocal.toString()) || 0,
          currency: formData.currency as Currency,
        });
        router.push('/holdings');
      } catch (err) {
        setError(String(err));
      }
    });
  };

  return (
    <Card className="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="text-loss text-sm font-medium">{error}</div>}
        
        <div>
          <Label htmlFor="ticker">Ticker</Label>
          {isEdit ? (
            <Input id="ticker" value={formData.ticker} disabled />
          ) : (
            <Select
              id="ticker"
              value={formData.ticker}
              onChange={(e) => {
                const t = e.target.value;
                setFormData((f) => ({
                  ...f,
                  ticker: t,
                  name: TICKER_NAME[t] ?? f.name,
                  currency: (TICKER_CURRENCY[t] ?? f.currency) as Currency,
                }));
              }}
              required
            >
              <option value="">Select a ticker…</option>
              {ALL_TICKERS.filter((t) => t !== 'CASH').map((t) => (
                <option key={t} value={t}>
                  {t} — {TICKER_NAME[t]}
                </option>
              ))}
            </Select>
          )}
        </div>

        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            readOnly={!isEdit && !!TICKER_NAME[formData.ticker]}
            disabled={!isEdit && !!TICKER_NAME[formData.ticker]}
            required
          />
        </div>

        <div>
          <Label htmlFor="shares">Shares</Label>
          <Input
            id="shares"
            type="number"
            step="any"
            min="0"
            value={formData.shares}
            onChange={(e) => setFormData({ ...formData, shares: e.target.value })}
            required
          />
        </div>

        <div>
          <Label htmlFor="avgCostLocal">Avg Cost (Local)</Label>
          <Input
            id="avgCostLocal"
            type="number"
            step="any"
            min="0"
            value={formData.avgCostLocal}
            onChange={(e) => setFormData({ ...formData, avgCostLocal: e.target.value })}
            required
          />
        </div>

        <div>
          <Label htmlFor="currency">Currency</Label>
          <Select
            id="currency"
            value={formData.currency}
            onChange={(e) => setFormData({ ...formData, currency: e.target.value as Currency })}
            disabled={isEdit}
          >
            <option value="SGD">SGD</option>
            <option value="USD">USD</option>
            <option value="HKD">HKD</option>
          </Select>
        </div>

        <div className="pt-2 flex gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Holding'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.back()} disabled={isPending}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}