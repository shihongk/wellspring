'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function MigrateCpfTransactionsSection() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'already-exists' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleMigrate = async () => {
    setStatus('running');
    setErrorMessage('');
    try {
      const res = await fetch('/api/setup/migrate-cpf-transactions', { method: 'POST' });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to migrate');
      if (data.skipped?.length > 0 && !data.created?.length) {
        setStatus('already-exists');
      } else {
        setStatus('done');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'An unknown error occurred');
      setStatus('error');
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">v0.8 CPF Transactions</h2>
      <p className="mt-1 mb-4 text-sm text-slate-600">
        Add the <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">CpfTransactions</code> tab to your existing sheet. Required to store CPF statement transaction history.
      </p>
      {status === 'idle' && <Button onClick={handleMigrate}>Add CpfTransactions Tab</Button>}
      {status === 'running' && <Button disabled>Adding tab…</Button>}
      {status === 'done' && <p className="text-sm font-medium text-emerald-600">✓ CpfTransactions tab created successfully.</p>}
      {status === 'already-exists' && <p className="text-sm font-medium text-emerald-600">✓ Tab already exists — nothing to do.</p>}
      {status === 'error' && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-red-600">Error: {errorMessage}</p>
          <Button variant="secondary" onClick={() => setStatus('idle')}>Try again</Button>
        </div>
      )}
    </div>
  );
}