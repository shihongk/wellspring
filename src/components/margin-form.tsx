'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { formatSGD } from '@/lib/fx';

interface Props {
  outstandingSGD: number;
  cashAccounts: string[];
  repayAction: (amountSGD: number, cashAccount: string) => Promise<void>;
}

export default function MarginForm({ outstandingSGD, cashAccounts, repayAction }: Props) {
  const [amount, setAmount] = useState('');
  const [cashAccount, setCashAccount] = useState(cashAccounts[0] ?? '');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) { setError('Enter a valid amount'); return; }
    if (!cashAccount) { setError('Select a cash account'); return; }
    setError('');
    startTransition(async () => {
      await repayAction(val, cashAccount);
      setAmount('');
    });
  }

  return (
    <div className="space-y-4 max-w-lg">
      <Card>
        <p className="text-sm text-slate-600">Outstanding Margin</p>
        <p className={`text-2xl font-bold ${outstandingSGD > 0 ? 'text-loss' : ''}`}>
          {formatSGD(outstandingSGD)}
        </p>
      </Card>

      {outstandingSGD > 0 && (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-3">
            <p className="font-medium text-sm">Repay Margin</p>
            {error && <p className="text-loss text-xs">{error}</p>}
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-[140px]">
                <Label htmlFor="repay-amount">Amount (SGD)</Label>
                <Input
                  id="repay-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <Label htmlFor="repay-cash-account">Excess to</Label>
                <Select
                  id="repay-cash-account"
                  value={cashAccount}
                  onChange={(e) => setCashAccount(e.target.value)}
                >
                  {cashAccounts.map((acc) => (
                    <option key={acc} value={acc}>{acc}</option>
                  ))}
                </Select>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Pays down outstanding margin first; any excess is added to the selected cash account.
            </p>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? 'Saving…' : 'Repay'}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
