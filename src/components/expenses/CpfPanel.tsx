'use client';

import { useState, useTransition } from 'react';
import { CpfBalance } from '@/types';
import { getCpfContributionRate, getCpfAllocationRates } from '@/lib/retirement/cpf';
import { saveCpfBalanceAction } from '@/app/lib/actions';
import { Landmark, Calendar, RefreshCcw, Check, X } from 'lucide-react';

function fmtSGD(n: number): string {
  return 'S$' + n.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface CpfPanelProps {
  balance: CpfBalance | null;
  grossMonthlySalary: number;
  userAge: number;
}

export function CpfPanel({ balance, grossMonthlySalary, userAge }: CpfPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localBalance, setLocalBalance] = useState<CpfBalance | null>(balance);
  const [isPending, startTransition] = useTransition();

  const [formDate, setFormDate] = useState(localBalance?.date ?? new Date().toISOString().slice(0, 10));
  const [formOa, setFormOa] = useState(localBalance?.oa.toString() ?? '');
  const [formSa, setFormSa] = useState(localBalance?.sa.toString() ?? '');
  const [formMa, setFormMa] = useState(localBalance?.ma.toString() ?? '');

  const rates = getCpfContributionRate(userAge);
  const alloc = getCpfAllocationRates(userAge);

  const employeeContrib = grossMonthlySalary * rates.employee;
  const employerContrib = grossMonthlySalary * rates.employer;
  const totalContrib = grossMonthlySalary * rates.total;

  const raAlloc = Math.max(0, rates.total - alloc.oa - alloc.sa - alloc.ma);

  const handleSave = () => {
    const oa = parseFloat(formOa);
    const sa = parseFloat(formSa);
    const ma = parseFloat(formMa);
    if (isNaN(oa) || isNaN(sa) || isNaN(ma) || !formDate) return;

    const newBalance: CpfBalance = { date: formDate, oa, sa, ma };
    setLocalBalance(newBalance);
    setIsEditing(false);

    startTransition(() => {
      saveCpfBalanceAction(newBalance);
    });
  };

  const handleCancel = () => {
    setFormDate(localBalance?.date ?? new Date().toISOString().slice(0, 10));
    setFormOa(localBalance?.oa.toString() ?? '');
    setFormSa(localBalance?.sa.toString() ?? '');
    setFormMa(localBalance?.ma.toString() ?? '');
    setIsEditing(false);
  };

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-4 relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-800 font-semibold">
          <Landmark size={20} className="text-emerald-600" />
          CPF Balances
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1"
          >
            <RefreshCcw size={14} />
            Update balances
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-3 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-500 font-medium text-xs">As of Date</label>
              <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:ring-1 focus:ring-emerald-500 outline-none" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-500 font-medium text-xs">Ordinary Account (OA)</label>
              <input type="number" value={formOa} onChange={e => setFormOa(e.target.value)} placeholder="0.00" className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:ring-1 focus:ring-emerald-500 outline-none" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-500 font-medium text-xs">Special Account (SA)</label>
              <input type="number" value={formSa} onChange={e => setFormSa(e.target.value)} placeholder="0.00" className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:ring-1 focus:ring-emerald-500 outline-none" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-500 font-medium text-xs">MediSave Account (MA)</label>
              <input type="number" value={formMa} onChange={e => setFormMa(e.target.value)} placeholder="0.00" className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:ring-1 focus:ring-emerald-500 outline-none" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button onClick={handleSave} disabled={isPending} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-md hover:bg-emerald-700 transition-colors disabled:opacity-50">
              <Check size={14} /> Save
            </button>
            <button onClick={handleCancel} disabled={isPending} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-600 text-xs font-medium border border-slate-300 rounded-md hover:bg-slate-50 transition-colors disabled:opacity-50">
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      ) : !localBalance ? (
        <div className="py-8 text-center text-slate-500 text-sm border border-dashed border-slate-200 rounded-xl bg-slate-50">
          No CPF balances recorded yet. <button onClick={() => setIsEditing(true)} className="text-emerald-600 font-semibold hover:underline ml-1">Update now</button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex flex-col relative overflow-hidden">
              <div className="text-sm font-medium text-slate-500 mb-1 z-10">Ordinary Account (OA)</div>
              <div className="text-2xl font-semibold text-slate-800 z-10">{fmtSGD(localBalance.oa)}</div>
            </div>
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex flex-col relative overflow-hidden">
              <div className="text-sm font-medium text-slate-500 mb-1 z-10">Special Account (SA)</div>
              <div className="text-2xl font-semibold text-slate-800 z-10">{fmtSGD(localBalance.sa)}</div>
            </div>
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex flex-col relative overflow-hidden">
              <div className="text-sm font-medium text-slate-500 mb-1 z-10">MediSave Account (MA)</div>
              <div className="text-2xl font-semibold text-slate-800 z-10">{fmtSGD(localBalance.ma)}</div>
            </div>
          </div>
          <div className="text-xs font-medium text-slate-400 flex items-center justify-end gap-1.5">
            <Calendar size={12} /> As of {new Date(localBalance.date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </div>
      )}

      {/* Monthly Contribution Row */}
      <div className="mt-1 pt-4 border-t border-slate-100 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Estimated Monthly Contribution</span>
            <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-medium border border-emerald-100">Age {userAge}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
            <div className="flex items-center gap-1.5"><span className="text-slate-500 text-xs">Employee</span> <span className="font-semibold text-slate-800">{fmtSGD(employeeContrib)}</span></div>
            <div className="text-slate-300 hidden sm:block">+</div>
            <div className="flex items-center gap-1.5"><span className="text-slate-500 text-xs">Employer</span> <span className="font-semibold text-slate-800">{fmtSGD(employerContrib)}</span></div>
            <div className="text-slate-300 hidden sm:block">=</div>
            <div className="flex items-center gap-1.5"><span className="text-emerald-600 font-semibold">{fmtSGD(totalContrib)}</span> <span className="text-emerald-700/60 text-xs font-medium">Total</span></div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 bg-slate-50/50 px-3 py-2 rounded-lg">
           <span className="font-medium">Allocates to:</span>
           <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>OA {fmtSGD(grossMonthlySalary * alloc.oa)}</span>
           {alloc.sa > 0 && <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>SA {fmtSGD(grossMonthlySalary * alloc.sa)}</span>}
           <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-pink-400"></div>MA {fmtSGD(grossMonthlySalary * alloc.ma)}</span>
           {raAlloc > 0 && <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>RA {fmtSGD(grossMonthlySalary * raAlloc)}</span>}
        </div>
      </div>
    </div>
  );
}