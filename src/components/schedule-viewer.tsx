'use client';

import { useState, useTransition } from 'react';
import { InvestmentScheduleRow, FxRates } from '@/types';
import { groupByMonth, computeRecommendedUnits } from '@/lib/portfolio';
import { toSGD } from '@/lib/fx';
import { EQUITY_TICKERS, TICKER_NAME } from '@/lib/constants';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  schedule: InvestmentScheduleRow[];
  prices: Record<string, { price: number | null; currency: string }>;
  pricesStale: boolean;
  pricesFetchedAt: string | null;
  fxRates: FxRates;
  action: (rows: InvestmentScheduleRow[]) => Promise<void>;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function currentMonthLabel(): string {
  const now = new Date();
  return `${MONTHS_SHORT[now.getMonth()]} ${now.getFullYear()}`;
}

function parseMonthValue(m: string): number {
  const [mon, yr] = m.split(' ');
  return parseInt(yr) * 12 + MONTHS_SHORT.indexOf(mon);
}

function currentMonthValue(): number {
  const now = new Date();
  return now.getFullYear() * 12 + now.getMonth();
}

// Generate month options: 6 months back to 18 months forward
function monthOptions(): string[] {
  const now = new Date();
  const options: string[] = [];
  for (let i = -6; i <= 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    options.push(`${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`);
  }
  return options;
}

const SAMPLE_ROW: InvestmentScheduleRow = {
  month: currentMonthLabel(),
  ticker: 'TSM',
  name: TICKER_NAME['TSM'],
  plannedSGD: 1000,
};

const nd = '—';

function fmtSGD(v: number) {
  return new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', maximumFractionDigits: 0 }).format(v);
}

type EditableRow = InvestmentScheduleRow & { _id: number };

let _nextId = 0;
function withIds(rows: InvestmentScheduleRow[]): EditableRow[] {
  return rows.map((r) => ({ ...r, _id: _nextId++ }));
}

export function ScheduleViewer({ schedule, prices, pricesStale, pricesFetchedAt, fxRates, action }: Props) {
  const [rows, setRows] = useState<EditableRow[]>(() =>
    schedule.length > 0 ? withIds(schedule) : withIds([SAMPLE_ROW])
  );
  const [showPast, setShowPast] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Partial<InvestmentScheduleRow>>({});
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');

  const monthOpts = monthOptions();

  function startEdit(row: EditableRow) {
    setEditingId(row._id);
    setDraft({ month: row.month, ticker: row.ticker, name: row.name, plannedSGD: row.plannedSGD });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft({});
  }

  function commitEdit(id: number) {
    setRows((prev) =>
      prev.map((r) =>
        r._id === id
          ? { ...r, month: draft.month ?? r.month, ticker: draft.ticker ?? r.ticker, name: draft.name ?? r.name, plannedSGD: draft.plannedSGD ?? r.plannedSGD }
          : r
      )
    );
    setEditingId(null);
    setDraft({});
  }

  function deleteRow(id: number) {
    setRows((prev) => prev.filter((r) => r._id !== id));
  }

  function addRow() {
    const newRow: EditableRow = { month: currentMonthLabel(), ticker: 'TSM', name: TICKER_NAME['TSM'], plannedSGD: 1000, _id: _nextId++ };
    setRows((prev) => [...prev, newRow]);
    setEditingId(newRow._id);
    setDraft({ month: newRow.month, ticker: newRow.ticker, name: newRow.name, plannedSGD: newRow.plannedSGD });
  }

  function handleTickerChange(ticker: string) {
    setDraft((d) => ({ ...d, ticker, name: TICKER_NAME[ticker] ?? ticker }));
  }

  function handleSave() {
    setSaveStatus('idle');
    const clean: InvestmentScheduleRow[] = rows.map(({ _id: _, ...r }) => r);
    startTransition(async () => {
      try {
        await action(clean);
        setSaveStatus('saved');
      } catch (err) {
        setSaveStatus('error');
        setSaveError(String(err));
      }
    });
  }

  // Group for read view
  const groups = groupByMonth(rows.map(({ _id: _, ...r }) => r));
  const refMonth = currentMonthValue();
  const visibleGroups = showPast ? groups : groups.filter((g) => parseMonthValue(g.month) >= refMonth);

  const isEditing = editingId !== null;

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Investment Schedule</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <span>Show past</span>
            <button
              role="switch"
              aria-checked={showPast}
              onClick={() => setShowPast((v) => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ${
                showPast ? 'bg-primary' : 'bg-slate-300'
              }`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${showPast ? 'translate-x-4' : 'translate-x-1'}`} />
            </button>
          </label>
        </div>
      </div>

      {pricesStale && (
        <div className="mb-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Prices are stale{pricesFetchedAt ? ` (last fetched ${new Date(pricesFetchedAt).toLocaleString()})` : ''}. Recommended units may be inaccurate.
        </div>
      )}

      {schedule.length === 0 && (
        <div className="mb-3 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-3 py-2">
          No schedule found — a sample row has been added. Edit it, add more rows, then click Save.
        </div>
      )}

      {/* Editable rows table */}
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead className="border-b text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="py-2 text-left font-semibold">Month</th>
              <th className="py-2 text-left font-semibold">Ticker</th>
              <th className="py-2 text-left font-semibold">Name</th>
              <th className="py-2 text-right font-semibold">Planned (SGD)</th>
              <th className="py-2 text-right font-semibold">Price (local)</th>
              <th className="py-2 text-right font-semibold">Price (SGD)</th>
              <th className="py-2 text-right font-semibold">Rec. Units</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => {
              const priceData = prices[row.ticker];
              const priceLocal = priceData?.price ?? null;
              const currency = priceData?.currency ?? null;
              const priceSGD = priceLocal != null && currency != null
                ? toSGD(priceLocal, currency as 'USD' | 'SGD' | 'HKD', fxRates)
                : null;
              const recUnits = computeRecommendedUnits(row.plannedSGD, priceSGD);

              if (editingId === row._id) {
                return (
                  <tr key={row._id} className="bg-blue-50/40">
                    <td className="py-1.5 pr-2">
                      <select
                        value={draft.month}
                        onChange={(e) => setDraft((d) => ({ ...d, month: e.target.value }))}
                        className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary w-28"
                      >
                        {monthOpts.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 pr-2">
                      <select
                        value={draft.ticker}
                        onChange={(e) => handleTickerChange(e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary w-28"
                      >
                        {EQUITY_TICKERS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 pr-2">
                      <Input
                        value={draft.name ?? ''}
                        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                        className="w-48 text-sm"
                      />
                    </td>
                    <td className="py-1.5 pr-2 text-right">
                      <Input
                        type="number"
                        min="0"
                        step="100"
                        value={draft.plannedSGD ?? ''}
                        onChange={(e) => setDraft((d) => ({ ...d, plannedSGD: parseFloat(e.target.value) || 0 }))}
                        className="w-28 text-right text-sm ml-auto"
                      />
                    </td>
                    <td className="py-1.5 text-right text-gray-400 text-xs">
                      {priceLocal != null ? <>{priceLocal.toFixed(2)} <span className="text-gray-300">{currency}</span></> : nd}
                    </td>
                    <td className="py-1.5 text-right text-gray-400 text-xs">{priceSGD != null ? priceSGD.toFixed(2) : nd}</td>
                    <td className="py-1.5 text-right text-gray-400 text-xs">{recUnits != null ? recUnits : nd}</td>
                    <td className="py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => commitEdit(row._id)} className="text-xs text-gain font-medium hover:underline px-1">✓</button>
                        <button onClick={cancelEdit} className="text-xs text-gray-400 hover:underline px-1">✕</button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={row._id} className="hover:bg-gray-50 group">
                  <td className="py-2 text-gray-700">{row.month}</td>
                  <td className="py-2 font-medium">{row.ticker}</td>
                  <td className="py-2 text-gray-600 max-w-[200px] truncate" title={row.name}>{row.name}</td>
                  <td className="py-2 text-right">{fmtSGD(row.plannedSGD)}</td>
                  <td className="py-2 text-right text-gray-500">
                    {priceLocal != null ? (
                      <span>
                        {priceLocal.toFixed(2)} <span className="text-gray-400 text-xs">{currency}</span>
                        {pricesStale && <span className="ml-1 text-amber-500" title="Stale price">⚠</span>}
                      </span>
                    ) : nd}
                  </td>
                  <td className="py-2 text-right text-gray-500">
                    {priceSGD != null ? (
                      <span>
                        {priceSGD.toFixed(2)}
                        {pricesStale && <span className="ml-1 text-amber-500" title="Stale price">⚠</span>}
                      </span>
                    ) : nd}
                  </td>
                  <td className="py-2 text-right">{recUnits != null ? recUnits : <span className="text-gray-400">{nd}</span>}</td>
                  <td className="py-2 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(row)}
                        disabled={isEditing}
                        className="text-xs text-primary hover:underline disabled:opacity-30"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteRow(row._id)}
                        disabled={isEditing}
                        className="text-xs text-loss hover:underline disabled:opacity-30"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" variant="secondary" onClick={addRow} disabled={isEditing || isPending}>
          + Add row
        </Button>
        <Button type="button" variant="primary" onClick={handleSave} disabled={isEditing || isPending}>
          {isPending ? 'Saving…' : 'Save schedule'}
        </Button>
        {saveStatus === 'saved' && <span className="text-sm text-gain">✓ Saved</span>}
        {saveStatus === 'error' && <span className="text-sm text-loss">{saveError}</span>}
      </div>
    </Card>
  );
}
