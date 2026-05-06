'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function MigrateRetirementSection() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'already-exists' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleMigrate = async () => {
    setStatus('running');
    setErrorMessage('');

    try {
      const res = await fetch('/api/setup/migrate-retirement', {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to migrate');
      }

      if (data.skipped && data.skipped.length > 0 && (!data.created || data.created.length === 0)) {
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
      <h2 className="text-lg font-semibold text-slate-900">v0.7 Retirement Features</h2>
      <p className="mt-1 mb-4 text-sm text-slate-600">
        Add the <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">CpfBalances</code> and <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">RetirementOneOffs</code> tabs to your existing sheet. Required for the CPF panel and Retirement page.
      </p>

      {status === 'idle' && <Button onClick={handleMigrate}>Add Retirement Tabs</Button>}
      {status === 'running' && <Button disabled>Adding tabs…</Button>}
      {status === 'done' && <p className="text-sm font-medium text-emerald-600">✓ Retirement tabs created successfully.</p>}
      {status === 'already-exists' && <p className="text-sm font-medium text-emerald-600">✓ Tabs already exist — nothing to do.</p>}
      {status === 'error' && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-red-600">Error: {errorMessage}</p>
          <Button variant="secondary" onClick={() => setStatus('idle')}>Try again</Button>
        </div>
      )}
    </div>
  );
}
