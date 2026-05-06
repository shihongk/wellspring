'use client';

import { CpfTransaction } from '@/types';

function fmtSGD(n: number): string {
  return 'S$' + Math.abs(n).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtChange(n: number) {
  if (n === 0) return <span className="text-slate-300">—</span>;
  const cls = n > 0 ? 'text-green-600' : 'text-red-600';
  return <span className={cls}>{n > 0 ? '+' : ''}{fmtSGD(n)}</span>;
}

function toMonthKey(date: string) { return date.slice(0, 7); }

function formatMonth(key: string) {
  const [y, m] = key.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('en-SG', { month: 'short', year: 'numeric' });
}

interface Props {
  transactions: CpfTransaction[];
}

export function CpfTransactionList({ transactions }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="py-10 text-center text-slate-500 text-sm border border-dashed border-slate-200 rounded-xl bg-slate-50">
        No CPF transactions yet. Import a CPF annual statement to populate this list.
      </div>
    );
  }

  const grouped = new Map<string, CpfTransaction[]>();
  for (const tx of [...transactions].reverse()) {
    const key = toMonthKey(tx.date);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(tx);
  }

  return (
    <div className="flex flex-col gap-4">
      {[...grouped.entries()].map(([monthKey, txs]) => (
        <div key={monthKey} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 text-sm font-semibold text-slate-600">
            {formatMonth(monthKey)}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-100">
                <th className="text-left px-5 py-2 font-medium">Date</th>
                <th className="text-left px-3 py-2 font-medium">Code</th>
                <th className="text-left px-3 py-2 font-medium">Ref</th>
                <th className="text-right px-3 py-2 font-medium">OA</th>
                <th className="text-right px-3 py-2 font-medium">SA/RA</th>
                <th className="text-right px-5 py-2 font-medium">MA</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((tx, i) => (
                <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                  <td className="px-5 py-2.5 text-slate-500 tabular-nums">
                    {new Date(tx.date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-xs px-1.5 py-0.5 bg-slate-100 rounded text-slate-700">{tx.code}</span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-400 text-xs">{tx.ref || '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtChange(tx.oaChange)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtChange(tx.saChange)}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{fmtChange(tx.maChange)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}