'use client';

import { useState } from 'react';
import { BalanceContinuityIssue } from '@/types';

type State = 'idle' | 'loading' | 'done' | 'error';

function fmtSGD(n: number): string {
  return 'S$' + n.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ValidateBalancesButton() {
  const [state, setState] = useState<State>('idle');
  const [issues, setIssues] = useState<BalanceContinuityIssue[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleValidate() {
    setState('loading');
    try {
      const res = await fetch('/api/expenses/validate');
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error ?? 'Validation failed');
        setState('error');
      } else {
        setIssues(json.issues);
        setState('done');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
      setState('error');
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleValidate}
        disabled={state === 'loading'}
        className="px-4 py-2 rounded-md text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
      >
        {state === 'loading' ? 'Validating…' : 'Validate Balances'}
      </button>

      {state === 'done' && (
        <div className="absolute right-0 top-full mt-2 w-96 max-h-80 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg p-3 z-10 text-sm">
          {issues.length === 0 ? (
            <span className="text-green-600">No continuity issues</span>
          ) : (
            <ul className="flex flex-col gap-2">
              {issues.map(issue => (
                <li key={`${issue.account}-${issue.id}`} className="border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                  <div className="font-medium text-slate-800">{issue.account} · {issue.date}</div>
                  <div className="text-slate-500">{issue.description}</div>
                  <div className="text-red-600">expected {fmtSGD(issue.expectedBalance)}, got {fmtSGD(issue.actualBalance)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {state === 'error' && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-red-200 rounded-lg shadow-lg p-3 z-10 text-sm text-red-600">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
