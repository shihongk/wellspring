'use client';

import { useState, useTransition } from 'react';
import { CashAccount } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { formatSGD } from '@/lib/fx';

interface Props {
  accounts: CashAccount[];
  upsertAction: (account: string, amount: number) => Promise<void>;
  deleteAction: (account: string) => Promise<void>;
  renameAction: (oldName: string, newName: string, amount: number) => Promise<void>;
}

function AccountRow({
  acc,
  renameAction,
  deleteAction,
}: {
  acc: CashAccount;
  renameAction: Props['renameAction'];
  deleteAction: Props['deleteAction'];
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(acc.account);
  const [amount, setAmount] = useState(acc.amount.toString());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  function handleSave() {
    if (!name.trim()) { setError('Account name is required'); return; }
    const val = parseFloat(amount);
    if (isNaN(val) || val < 0) { setError('Enter a valid amount'); return; }
    setError('');
    startTransition(async () => {
      await renameAction(acc.account, name.trim(), val);
      setEditing(false);
    });
  }

  function handleCancel() {
    setEditing(false);
    setName(acc.account);
    setAmount(acc.amount.toString());
    setError('');
  }

  function handleDelete() {
    startTransition(async () => { await deleteAction(acc.account); });
  }

  return (
    <tr className="border-b last:border-0">
      <td className="py-3 pr-4">
        {editing ? (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full"
            autoFocus
          />
        ) : (
          <span className="font-medium">{acc.account}</span>
        )}
      </td>
      <td className="py-3 pr-4 text-right">
        {editing ? (
          <Input
            type="number" step="0.01" min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full text-right"
          />
        ) : (
          formatSGD(acc.amount)
        )}
        {error && <p className="text-loss text-xs mt-1">{error}</p>}
      </td>
      <td className="py-3 text-right">
        <div className="flex gap-2 justify-end">
          {editing ? (
            <>
              <Button variant="primary" className="text-xs py-1 px-3" onClick={handleSave} disabled={isPending}>
                {isPending ? 'Saving…' : 'Save'}
              </Button>
              <Button variant="secondary" className="text-xs py-1 px-3" onClick={handleCancel}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" className="text-xs py-1 px-3" onClick={() => setEditing(true)}>Edit</Button>
              <Button variant="danger" className="text-xs py-1 px-3" onClick={handleDelete} disabled={isPending}>Delete</Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function AddAccountForm({ upsertAction }: { upsertAction: Props['upsertAction'] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Account name is required'); return; }
    const val = parseFloat(amount);
    if (isNaN(val) || val < 0) { setError('Enter a valid amount'); return; }
    setError('');
    startTransition(async () => {
      await upsertAction(name.trim(), val);
      setName(''); setAmount(''); setOpen(false);
    });
  }

  if (!open) {
    return (
      <Button variant="primary" onClick={() => setOpen(true)}>Add Account</Button>
    );
  }

  return (
    <Card className="space-y-3">
      <p className="font-medium text-sm">New cash account</p>
      {error && <p className="text-loss text-xs">{error}</p>}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[140px]">
          <Label htmlFor="acc-name">Account / Source</Label>
          <Input id="acc-name" placeholder="e.g. DBS, Tiger" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex-1 min-w-[120px]">
          <Label htmlFor="acc-amount">Amount (SGD)</Label>
          <Input id="acc-amount" type="number" step="0.01" min="0" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="primary" onClick={handleSubmit} disabled={isPending}>{isPending ? 'Saving…' : 'Save'}</Button>
        <Button variant="secondary" onClick={() => { setOpen(false); setError(''); }}>Cancel</Button>
      </div>
    </Card>
  );
}

export default function CashForm({ accounts, upsertAction, deleteAction, renameAction }: Props) {
  const total = accounts.reduce((s, a) => s + a.amount, 0);

  return (
    <div className="space-y-4 max-w-lg">
      {accounts.length > 0 && (
        <Card>
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-1/3" />
              <col className="w-1/3" />
              <col className="w-1/3" />
            </colgroup>
            <thead className="border-b">
              <tr>
                <th className="pb-2 text-left font-semibold">Account</th>
                <th className="pb-2 text-right font-semibold">Balance (SGD)</th>
                <th className="pb-2 text-right font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => (
                <AccountRow key={acc.account} acc={acc} renameAction={renameAction} deleteAction={deleteAction} />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-bold">
                <td className="pt-3">Total</td>
                <td className="pt-3 text-right">{formatSGD(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </Card>
      )}

      <AddAccountForm upsertAction={upsertAction} />
    </div>
  );
}
