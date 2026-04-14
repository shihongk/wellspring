'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Transaction, TransactionType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { EQUITY_TICKERS, TICKER_CURRENCY, TICKER_NAME } from '@/lib/constants';

interface Props {
  action: (data: Omit<Transaction, 'id'>) => Promise<void>;
}

export default function TransactionForm({ action }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState<Omit<Transaction, 'id'>>({
    date: today,
    ticker: EQUITY_TICKERS[0],
    type: 'BUY',
    shares: 0,
    priceLocal: 0,
    currency: TICKER_CURRENCY[EQUITY_TICKERS[0]],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.shares <= 0 || formData.priceLocal <= 0) {
      setError('Shares and price must be greater than 0');
      return;
    }

    startTransition(async () => {
      try {
        await action(formData);
        router.push('/transactions');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to log transaction');
      }
    });
  };

  const handleTickerChange = (ticker: string) => {
    setFormData({
      ...formData,
      ticker,
      currency: TICKER_CURRENCY[ticker],
    });
  };

  return (
    <Card className="max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="text-red-600 text-sm p-3 bg-red-50 rounded-md">{error}</div>}

        <div>
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          />
        </div>

        <div>
          <Label htmlFor="ticker">Ticker</Label>
          <Select
            id="ticker"
            value={formData.ticker}
            onChange={(e) => handleTickerChange(e.target.value)}
            required
          >
            {EQUITY_TICKERS.map((t) => (
              <option key={t} value={t}>
                {t} — {TICKER_NAME[t]}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="type">Type</Label>
          <Select
            id="type"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as TransactionType })}
            required
          >
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </Select>
        </div>

        <div>
          <Label htmlFor="shares">Shares</Label>
          <Input
            id="shares"
            type="number"
            step="0.0001"
            min="0"
            value={formData.shares || ''}
            onChange={(e) => setFormData({ ...formData, shares: parseFloat(e.target.value) || 0 })}
            required
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <Label htmlFor="priceLocal">Price</Label>
            <Input
              id="priceLocal"
              type="number"
              step="0.0001"
              min="0"
              value={formData.priceLocal || ''}
              onChange={(e) => setFormData({ ...formData, priceLocal: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>
          <div className="w-24">
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              type="text"
              value={formData.currency}
              disabled
            />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Saving...' : 'Log Transaction'}
        </Button>
      </form>
    </Card>
  );
}
