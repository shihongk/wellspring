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

// Draft tracks plannedSGD as the source of truth; units are derived unless user edits units directly
interface Draft {
  month: string;
  ticker: string;
  name: string;
  plannedSGD: number;
  // raw string values for the two editable fields so inputs stay responsive
  plannedSGDStr: string;
  unitsStr: string;
}

type EditableRow = InvestmentScheduleRow & { _id: number };
let _nextId = 0;
function withIds(rows: InvestmentScheduleRow[]): EditableRow[] {
  return rows.map((r) => ({ ...r, _id: _nextId++ }));
}

function makeDraft(row: InvestmentScheduleRow, priceSGD: number | null): Draft {
  const units = computeRecommendedUnits(row.plannedSGD, priceSGD);
  return {
    month: row.month,
    ticker: row.ticker,
    name: row.name,
    plannedSGD: row.plannedSGD,
    plannedSGDStr: row.plannedSGD.toString(),
    unitsStr: units != null ? units.toString() : '',
  };
}

export function ScheduleViewer({ schedule, prices, pricesStale, pricesFetchedAt, fxRates, action }: Props) {
  const [rows, setRows] = useState<EditableRow[]>(() =>
    schedule.length > 0 ? withIds(schedule) : withIds([SAMPLE_ROW])
  );
  const [showPast, setShowPast] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');

  const monthOpts = monthOptions();

  function getPriceSGD(ticker: string): number | null {
    const pd = prices[ticker];
    if (!pd?.price) return null;
    return toSGD(pd.price, pd.currency as 'USD' | 'SGD' | 'HKD', fxRates);
  }

  function startEdit(row: EditableRow) {
    setEditingId(row._id);
    setDraft(makeDraft(row, getPriceSGD(row.ticker)));
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  function commitEdit(id: number) {
    if (!draft) return;
    setRows((prev) =>
      prev.map((r) =>
        r._id === id
          ? { ...r, month: draft.month, ticker: draft.ticker, name: draft.name, plannedSGD: draft.plannedSGD }
          : r
      )
    );
    setEditingId(null);
    setDraft(null);
  }

  function deleteRow(id: number) {
    setRows((prev) => prev.filter((r) => r._id !== id));
  }

  function addRow() {
    const newRow: EditableRow = {
      month: currentMonthLabel(), ticker: 'TSM',
      name: TICKER_NAME['TSM'], plannedSGD: 1000, _id: _nextId++,
    };
    setRows((prev) => [...prev, newRow]);
    setEditingId(newRow._id);
    setDraft(makeDraft(newRow, getPriceSGD('TSM')));
  }

  function handleTickerChange(ticker: string) {
    if (!draft) return;
    const priceSGD = getPriceSGD(ticker);
    const units = computeRecommendedUnits(draft.plannedSGD, priceSGD);
    setDraft({
      ...draft,
      ticker,
      name: TICKER_NAME[ticker] ?? ticker,
      unitsStr: units != null ? units.toString() : '',
    });
  }

  // User edits Planned SGD → recalculate units
  function handlePlannedChange(val: string) {
    if (!draft) return;
    const planned = parseFloat(val) || 0;
    const priceSGD = getPriceSGD(draft.ticker);
    const units = computeRecommendedUnits(planned, priceSGD);
    setDraft({
      ...draft,
      plannedSGDStr: val,
      plannedSGD: planned,
      unitsStr: units != null ? units.toString() : draft.unitsStr,
    });
  }

  // User edits Units → recalculate planned SGD
  function handleUnitsChange(val: string) {
    if (!draft) return;
    const units = parseInt(val) || 0;
    const priceSGD = getPriceSGD(draft.ticker);
    const planned = priceSGD != null && units > 0 ? Math.round(units * priceSGD) : draft.plannedSGD;
    setDraft({
      ...draft,
      unitsStr: val,
      plannedSGD: planned,
      plannedSGDStr: planned.toString(),
    });
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

  const groups = groupByMonth(rows.map(({ _id: _, ...r }) => r));
  const refMonth = currentMonthValue();
  const visibleGroups = showPast ? groups : groups.filter((g) => parseMonthValue(g.month) >= refMonth);
  const isEditing = editingId !== null;

  // Total planned SGD across all visible rows
  const visibleRows = visibleGroups.flatMap((g) => g.rows);
  const totalPlanned = visibleRows.reduce((s, r) => s + r.plannedSGD, 0);

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Investment Schedule</h2>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <span>Show past</span>
          <button
            role="switch"
            aria-checked={showPast}
            onClick={() => setShowPast((v) => !v)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ${showPast ? 'bg-primary' : 'bg-slate-300'}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${showPast ? 'translate-x-4' : 'translate-x-1'}`} />
          </button>
        </label>
      </div>

      {pricesStale && (
        <div className="mb-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Prices are stale{pricesFetchedAt ? ` (last fetched ${new Date(pricesFetchedAt).toLocaleString()})` : ''}. Units may be inaccurate.
        </div>
      )}
      {schedule.length === 0 && (
        <div className="mb-3 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-3 py-2">
          No schedule found — a sample row has been added. Edit it, add more rows, then click Save.
        </div>
      )}

      <div className="overflow-x-auto mb-4">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="border-b text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th className="py-2 pr-3 text-left font-semibold">Month</th>
              <th className="py-2 pr-3 text-left font-semibold">Ticker</th>
              <th className="py-2 pr-3 text-left font-semibold">Name</th>
              {/* Price context — read-only */}
              <th className="py-2 pr-3 text-right font-semibold">Price (local)</th>
              <th className="py-2 pr-3 text-right font-semibold">Price (SGD)</th>
              {/* Editable quantity fields */}
              <th className="py-2 pr-3 text-right font-semibold">Units</th>
              <th className="py-2 pr-3 text-right font-semibold">Planned (SGD)</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => {
              const pd = prices[row.ticker];
              const priceLocal = pd?.price ?? null;
              const currency = pd?.currency ?? null;
              const priceSGD = priceLocal != null && currency != null
                ? toSGD(priceLocal, currency as 'USD' | 'SGD' | 'HKD', fxRates)
                : null;
              const recUnits = computeRecommendedUnits(row.plannedSGD, priceSGD);

              if (editingId === row._id && draft) {
                const draftPriceSGD = getPriceSGD(draft.ticker);
                const previewUnits = parseInt(draft.unitsStr) || 0;
                const previewPlanned = draftPriceSGD != null && previewUnits > 0
                  ? previewUnits * draftPriceSGD
                  : draft.plannedSGD;

                return (
                  <tr key={row._id} className="bg-blue-50/50">
                    <td className="py-2 pr-2">
                      <select
                        value={draft.month}
                        onChange={(e) => setDraft({ ...draft, month: e.target.value })}
                        className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary w-28"
                      >
                        {monthOpts.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        value={draft.ticker}
                        onChange={(e) => handleTickerChange(e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary w-24"
                      >
                        {EQUITY_TICKERS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-2 text-xs text-gray-400 max-w-[160px] truncate">
                      {TICKER_NAME[draft.ticker] ?? draft.ticker}
                    </td>
                    {/* Price context — read-only in edit mode too */}
                    <td className="py-2 pr-2 text-right text-xs text-gray-400">
                      {(() => { const pd2 = prices[draft.ticker]; return pd2?.price != null ? <>{pd2.price.toFixed(2)} <span className="text-gray-300">{pd2.currency}</span></> : nd; })()}
                    </td>
                    <td className="py-2 pr-2 text-right text-xs text-gray-400">
                      {draftPriceSGD != null ? draftPriceSGD.toFixed(2) : nd}
                    </td>
                    {/* Units input → drives plannedSGD */}
                    <td className="py-2 pr-2 text-right">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={draft.unitsStr}
                        onChange={(e) => handleUnitsChange(e.target.value)}
                        placeholder="units"
                        className="w-20 text-right text-sm ml-auto"
                      />
                    </td>
                    {/* Planned SGD input → drives units */}
                    <td className="py-2 pr-2 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <Input
                          type="number"
                          min="0"
                          step="100"
                          value={draft.plannedSGDStr}
                          onChange={(e) => handlePlannedChange(e.target.value)}
                          className="w-28 text-right text-sm"
                        />
                        {draftPriceSGD != null && parseInt(draft.unitsStr) > 0 && (
                          <span className="text-xs text-gray-400">
                            = {fmtSGD(previewPlanned)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 text-right">
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
                  <td className="py-2 pr-3 text-gray-600 whitespace-nowrap">{row.month}</td>
                  <td className="py-2 pr-3 font-semibold">{row.ticker}</td>
                  <td className="py-2 pr-3 text-gray-500 max-w-[180px] truncate" title={row.name}>{row.name}</td>
                  <td className="py-2 pr-3 text-right text-gray-500">
                    {priceLocal != null
                      ? <>{priceLocal.toFixed(2)} <span className="text-xs text-gray-400">{currency}</span>{pricesStale && <span className="ml-1 text-amber-400">⚠</span>}</>
                      : <span className="text-gray-300">{nd}</span>}
                  </td>
                  <td className="py-2 pr-3 text-right text-gray-500">
                    {priceSGD != null
                      ? <>{priceSGD.toFixed(2)}{pricesStale && <span className="ml-1 text-amber-400">⚠</span>}</>
                      : <span className="text-gray-300">{nd}</span>}
                  </td>
                  <td className="py-2 pr-3 text-right font-medium">
                    {recUnits != null ? recUnits : <span className="text-gray-300">{nd}</span>}
                  </td>
                  <td className="py-2 pr-3 text-right font-medium">{fmtSGD(row.plannedSGD)}</td>
                  <td className="py-2 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(row)} disabled={isEditing} className="text-xs text-primary hover:underline disabled:opacity-30">Edit</button>
                      <button onClick={() => deleteRow(row._id)} disabled={isEditing} className="text-xs text-loss hover:underline disabled:opacity-30">Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Totals row */}
            {visibleRows.length > 0 && (
              <tr className="font-semibold border-t-2 bg-gray-50 text-gray-700">
                <td className="py-2 pr-3 text-xs uppercase tracking-wide text-gray-400" colSpan={5}>Total</td>
                <td className="py-2 pr-3 text-right">
                  {visibleRows.reduce((s, r) => {
                    const ps = getPriceSGD(r.ticker);
                    return s + (computeRecommendedUnits(r.plannedSGD, ps) ?? 0);
                  }, 0) || nd}
                </td>
                <td className="py-2 pr-3 text-right">{fmtSGD(totalPlanned)}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" variant="secondary" onClick={addRow} disabled={isEditing || isPending}>+ Add row</Button>
        <Button type="button" variant="primary" onClick={handleSave} disabled={isEditing || isPending}>
          {isPending ? 'Saving…' : 'Save schedule'}
        </Button>
        {saveStatus === 'saved' && <span className="text-sm text-gain">✓ Saved</span>}
        {saveStatus === 'error' && <span className="text-sm text-loss">{saveError}</span>}
      </div>
    </Card>
  );
}
