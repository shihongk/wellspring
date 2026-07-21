'use client';

import { Fragment, useState, useEffect, useMemo, useTransition, useRef } from 'react';
import { ExpenseTransaction, ExpenseProjectionOverride, InflationSettings, CategoryProjectionSetting, ProjectionMode } from '@/types';
import {
  computeBaselineAverages,
  generateProjections,
  aggregateCashFlow,
  INCOME_CATEGORIES,
  ProjectionRow,
} from '@/lib/expenses/projections';
import { saveProjectionOverrideAction, deleteProjectionOverrideAction } from '@/app/lib/actions';

const INCOME_CATS = new Set<string>(INCOME_CATEGORIES);
const EXCLUDED_CATS = new Set(['Transfer', 'Investment']);

type Range = '3M' | '6M' | '12M' | '3Y' | '5Y' | '10Y' | 'MAX';
type ViewMode = 'both' | 'income' | 'expense' | 'net';

const RANGE_MONTHS: Record<Range, number> = {
  '3M': 3, '6M': 6, '12M': 12, '3Y': 36, '5Y': 60, '10Y': 120, 'MAX': 600,
};

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  both: 'Income + Expense', income: 'Income', expense: 'Expense', net: 'Net',
};

// Sub-group definitions for expense categories
const EXPENSE_SUBGROUP_MAP: Record<string, string> = {
  'Food & Drink': 'Living', 'Groceries': 'Living', 'Healthcare': 'Living',
  'Mortgage': 'Living', 'Transport': 'Living', 'Utilities': 'Living',
  'Books & Stationery': 'Lifestyle', 'Entertainment': 'Lifestyle',
  'Home Improvement': 'Lifestyle', 'Shopping': 'Lifestyle',
  'Subscriptions': 'Lifestyle', 'Travel': 'Lifestyle', 'Personal Care': 'Lifestyle',
  'Electronics': 'Lifestyle', 'Sports': 'Lifestyle',
  'Bank Charges': 'Financial', 'Fees & Charges': 'Financial', 'Tax': 'Financial',
  'Insurance': 'Financial',
};
const SUBGROUP_ORDER = ['Living', 'Lifestyle', 'Financial', 'Other'] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSGD(n: number): string {
  return 'S$' + Math.abs(n).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtYLabel(v: number): string {
  const abs = Math.abs(v);
  const prefix = v < 0 ? '-' : '';
  if (abs >= 1000) return `${prefix}S$${(abs / 1000).toFixed(0)}k`;
  return `${prefix}S$${abs.toFixed(0)}`;
}

function fmtMonthShort(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const month = new Date(y, m - 1, 1).toLocaleDateString('en-SG', { month: 'short' });
  return `${month} '${String(y).slice(2)}`;
}

function addMonths(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getNextFullMonth(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getDefaultBaseline(): { start: string; end: string } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return { start: fmt(start), end: fmt(end) };
}

function makeTargetMonths(range: Range): string[] {
  const start = getNextFullMonth();
  const count = RANGE_MONTHS[range];
  return Array.from({ length: count }, (_, i) => addMonths(start, i));
}

function getAllMonthsBetween(start: string, end: string): string[] {
  if (!start || !end || start > end) return [];
  const months: string[] = [];
  let cur = start;
  while (cur <= end) {
    months.push(cur);
    cur = addMonths(cur, 1);
  }
  return months;
}

function computeActualIncomeExpense(
  txs: ExpenseTransaction[],
  month: string,
  excludedCats: Set<string>,
): { income: number; expense: number } {
  let income = 0, expense = 0;
  for (const tx of txs) {
    if (tx.date.slice(0, 7) !== month) continue;
    if (tx.excluded || tx.oneOff) continue;
    if (EXCLUDED_CATS.has(tx.category)) continue;
    if (excludedCats.has(tx.category)) continue;
    if (INCOME_CATS.has(tx.category) && tx.direction === 'credit') income += tx.amount;
    else if (!INCOME_CATS.has(tx.category) && tx.direction === 'debit') expense += tx.amount;
  }
  return { income, expense };
}

function incomeExpenseFromRows(rows: ProjectionRow[]): { income: number; expense: number } {
  let income = 0, expense = 0;
  for (const r of rows) {
    if (INCOME_CATS.has(r.category)) income += r.amount;
    else expense += r.amount;
  }
  return { income, expense };
}

// ─── Category Mode Card ───────────────────────────────────────────────────────

const MODE_LABELS: Record<ProjectionMode, string> = {
  rolling: 'Rolling avg',
  annual: 'Annual avg',
  semiannual: '6-monthly avg',
  latest: 'Latest month',
  fixed: 'Fixed amount',
};

const MODE_BADGE: Record<ProjectionMode, string> = {
  rolling: '',
  annual: '12m',
  semiannual: '6m',
  latest: 'latest',
  fixed: 'fixed',
};

interface CategoryModeCardProps {
  category: string;
  setting: CategoryProjectionSetting;
  onChange: (s: CategoryProjectionSetting) => void;
  baselineStart: string;
  baselineEnd: string;
  latestMonth: string | undefined;
}

function CategoryModeCard({ category, setting, onChange, baselineStart, baselineEnd, latestMonth }: CategoryModeCardProps) {
  const mode = setting.mode;
  const isCustom = mode !== 'rolling';

  let descriptor = '';
  if (mode === 'rolling') descriptor = `${fmtMonthShort(baselineStart)}–${fmtMonthShort(baselineEnd)} avg`;
  else if (mode === 'annual') descriptor = 'Last 12m ÷ 12';
  else if (mode === 'semiannual') descriptor = 'Last 6m ÷ 6';
  else if (mode === 'latest') descriptor = latestMonth ? `${fmtMonthShort(latestMonth)} value` : 'No data';
  else if (mode === 'fixed') descriptor = 'Manual monthly amount';

  return (
    <div className={`rounded-lg border p-3 transition-colors ${isCustom ? 'border-amber-200 bg-amber-50/40' : 'border-slate-100 bg-white'}`}>
      <div className="text-xs font-medium text-slate-700 mb-2 truncate" title={category}>{category}</div>
      <select
        value={mode}
        onChange={e => onChange({ ...setting, mode: e.target.value as ProjectionMode })}
        className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 bg-white"
      >
        {(Object.keys(MODE_LABELS) as ProjectionMode[]).map(m => (
          <option key={m} value={m}>{MODE_LABELS[m]}</option>
        ))}
      </select>
      {mode === 'fixed' && (
        <input
          type="number" min="0" step="1" placeholder="Monthly S$"
          value={setting.fixedAmount ?? ''}
          onChange={e => onChange({ mode: 'fixed', fixedAmount: parseFloat(e.target.value) || 0 })}
          className="mt-2 w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
      )}
      <div className="mt-1.5 text-[10px] text-slate-400">{descriptor}</div>
    </div>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────

interface ChartBar {
  key: string;
  label: string;
  income: number;
  expense: number;
  net: number;
  isActual: boolean;
}

const CW = 700, CH = 240, PL = 75, PR = 16, PT = 16, PB = 48;
const PW = CW - PL - PR;
const PH = CH - PT - PB;

function BarChart({ bars, viewMode }: { bars: ChartBar[]; viewMode: ViewMode }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ bar: ChartBar; x: number; y: number } | null>(null);

  if (bars.length === 0) {
    return <div className="flex items-center justify-center h-40 text-slate-400 text-sm">No data to display.</div>;
  }

  let yMax = 0, yMin = 0;
  for (const b of bars) {
    if (viewMode === 'net') { yMax = Math.max(yMax, b.net); yMin = Math.min(yMin, b.net); }
    else if (viewMode === 'income') { yMax = Math.max(yMax, b.income); }
    else if (viewMode === 'expense') { yMin = Math.min(yMin, -b.expense); }
    else { yMax = Math.max(yMax, b.income); yMin = Math.min(yMin, -b.expense); }
  }

  yMax = yMax <= 0 ? 100 : yMax * 1.15;
  yMin = yMin >= 0 ? 0 : yMin * 1.15;
  const yRange = (yMax - yMin) || 1;
  const toY = (v: number) => PT + ((yMax - v) / yRange) * PH;
  const zeroY = toY(0);

  const gridValues: number[] = [];
  const step = yRange / 4;
  for (let i = 0; i <= 4; i++) gridValues.push(yMin + step * i);

  const barSlot = PW / bars.length;
  const barW = Math.max(barSlot * 0.65, 2);
  const labelStep = Math.max(1, Math.ceil(bars.length / 8));

  function handleBarHover(bar: ChartBar, e: React.MouseEvent) {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ bar, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }
  function handleBarMove(bar: ChartBar, e: React.MouseEvent) {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip(prev => prev ? { ...prev, bar, x: e.clientX - rect.left, y: e.clientY - rect.top } : null);
  }

  // Net line points for 'both' mode
  const netLinePoints = viewMode === 'both'
    ? bars.map((bar, i) => `${PL + barSlot * i + barSlot / 2},${toY(bar.net)}`).join(' ')
    : null;
  const firstProjectedIdx = bars.findIndex(b => !b.isActual);
  const splitIdx = firstProjectedIdx >= 0 ? firstProjectedIdx : bars.length;

  return (
    <div ref={wrapperRef} className="relative">
      <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full" preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => setTooltip(null)}>
        {gridValues.map((v, i) => {
          const y = toY(v);
          return (
            <g key={i}>
              <line x1={PL} y1={y} x2={PL + PW} y2={y}
                stroke={Math.abs(v) < 0.01 ? '#64748b' : '#e2e8f0'}
                strokeWidth={Math.abs(v) < 0.01 ? 1 : 0.5}
                strokeDasharray={Math.abs(v) < 0.01 ? '' : '4,4'} />
              <text x={PL - 6} y={y} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="#94a3b8">
                {fmtYLabel(v)}
              </text>
            </g>
          );
        })}

        {bars.map((bar, i) => {
          const x = PL + barSlot * i + (barSlot - barW) / 2;
          const alpha = bar.isActual ? 1 : 0.4;

          if (viewMode === 'net') {
            const isPos = bar.net >= 0;
            const bh = Math.max(Math.abs((bar.net / yRange) * PH), 1);
            return <rect key={bar.key} x={x} y={isPos ? zeroY - bh : zeroY} width={barW} height={bh}
              fill={isPos ? '#16a34a' : '#dc2626'} opacity={alpha} rx="1" />;
          }
          if (viewMode === 'income') {
            const bh = Math.max((bar.income / yRange) * PH, bar.income > 0 ? 1 : 0);
            return <rect key={bar.key} x={x} y={zeroY - bh} width={barW} height={bh}
              fill="#16a34a" opacity={alpha} rx="1" />;
          }
          if (viewMode === 'expense') {
            const bh = Math.max((bar.expense / yRange) * PH, bar.expense > 0 ? 1 : 0);
            return <rect key={bar.key} x={x} y={zeroY} width={barW} height={bh}
              fill="#dc2626" opacity={alpha} rx="1" />;
          }
          // 'both'
          const incomeH = Math.max((bar.income / yRange) * PH, bar.income > 0 ? 1 : 0);
          const expenseH = Math.max((bar.expense / yRange) * PH, bar.expense > 0 ? 1 : 0);
          return (
            <g key={bar.key}>
              {bar.income > 0 && <rect x={x} y={zeroY - incomeH} width={barW} height={incomeH} fill="#16a34a" opacity={alpha} rx="1" />}
              {bar.expense > 0 && <rect x={x} y={zeroY} width={barW} height={expenseH} fill="#dc2626" opacity={alpha} rx="1" />}
            </g>
          );
        })}

        {/* Net line (both mode only): solid for actuals, dashed for projected */}
        {netLinePoints && bars.length > 1 && (() => {
          const actualPts = bars.slice(0, splitIdx + 1).map((b, i) => `${PL + barSlot * i + barSlot / 2},${toY(b.net)}`).join(' ');
          const projPts = splitIdx < bars.length
            ? bars.slice(splitIdx).map((b, i) => `${PL + barSlot * (splitIdx + i) + barSlot / 2},${toY(b.net)}`).join(' ')
            : '';
          return (
            <g>
              {splitIdx > 0 && <polyline points={actualPts} fill="none" stroke="#0e7490" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />}
              {projPts && <polyline points={projPts} fill="none" stroke="#0e7490" strokeWidth="1.5" strokeDasharray="4,3" strokeLinejoin="round" strokeLinecap="round" opacity="0.6" />}
              {bars.map((bar, i) => (
                <circle key={`dot-${bar.key}`} cx={PL + barSlot * i + barSlot / 2} cy={toY(bar.net)} r={2.5}
                  fill={bar.isActual ? '#0e7490' : 'white'} stroke="#0e7490" strokeWidth="1.5" opacity={bar.isActual ? 0.85 : 0.7} />
              ))}
            </g>
          );
        })()}

        {bars.map((bar, i) => {
          if (i % labelStep !== 0) return null;
          return (
            <text key={bar.key} x={PL + barSlot * i + barSlot / 2} y={CH - PB + 14}
              textAnchor="middle" fontSize="9" fill="#94a3b8">{bar.label}</text>
          );
        })}

        {/* Invisible hover overlay rects */}
        {bars.map((bar, i) => (
          <rect key={`ov-${bar.key}`}
            x={PL + barSlot * i} y={PT} width={barSlot} height={PH}
            fill="transparent"
            onMouseEnter={e => handleBarHover(bar, e)}
            onMouseMove={e => handleBarMove(bar, e)}
            onMouseLeave={() => setTooltip(null)}
          />
        ))}

        <g transform={`translate(${CW / 2 - (viewMode === 'both' ? 130 : 60)}, ${CH - PB + 28})`}>
          {viewMode === 'both' ? (
            <>
              <rect x={0} y={0} width={10} height={10} fill="#16a34a" rx="1" />
              <text x={14} y={9} fontSize="9" fill="#64748b">Income</text>
              <rect x={60} y={0} width={10} height={10} fill="#dc2626" rx="1" />
              <text x={74} y={9} fontSize="9" fill="#64748b">Expense</text>
              <rect x={130} y={0} width={10} height={10} fill="#94a3b8" opacity={0.4} rx="1" />
              <text x={144} y={9} fontSize="9" fill="#64748b">Projected</text>
              <line x1={195} y1={5} x2={215} y2={5} stroke="#0e7490" strokeWidth="1.5" opacity="0.85" />
              <circle cx={205} cy={5} r={2.5} fill="#0e7490" opacity="0.85" />
              <text x={219} y={9} fontSize="9" fill="#64748b">Net</text>
            </>
          ) : (
            <>
              <rect x={0} y={0} width={10} height={10} fill={viewMode === 'expense' ? '#dc2626' : '#16a34a'} rx="1" />
              <text x={14} y={9} fontSize="9" fill="#64748b">Actual</text>
              <rect x={55} y={0} width={10} height={10} fill={viewMode === 'expense' ? '#dc2626' : '#16a34a'} opacity={0.4} rx="1" />
              <text x={69} y={9} fontSize="9" fill="#64748b">Projected</text>
            </>
          )}
        </g>
      </svg>

      {/* Hover tooltip */}
      {tooltip && (
        <div
          style={{
            left: Math.min(tooltip.x + 14, (wrapperRef.current?.offsetWidth ?? 999) - 160),
            top: Math.max(tooltip.y - 80, 4),
          }}
          className="absolute z-10 pointer-events-none bg-white border border-slate-200 rounded-xl shadow-lg px-3.5 py-2.5 text-xs min-w-[150px]"
        >
          <div className="font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
            {tooltip.bar.label}
            {!tooltip.bar.isActual && <span className="text-[9px] font-normal text-slate-400 bg-slate-100 px-1.5 rounded">proj</span>}
          </div>
          <div className="flex justify-between gap-6 mb-0.5">
            <span className="text-slate-400">Income</span>
            <span className="text-emerald-600 font-medium tabular-nums">{fmtSGD(tooltip.bar.income)}</span>
          </div>
          <div className="flex justify-between gap-6 mb-0.5">
            <span className="text-slate-400">Expense</span>
            <span className="text-red-500 font-medium tabular-nums">{fmtSGD(tooltip.bar.expense)}</span>
          </div>
          <div className="flex justify-between gap-6 pt-1.5 mt-1 border-t border-slate-100">
            <span className="text-slate-500 font-medium">Net</span>
            <span className={`font-semibold tabular-nums ${tooltip.bar.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {tooltip.bar.net < 0 ? '-' : '+'}{fmtSGD(tooltip.bar.net)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  transactions: ExpenseTransaction[];
  overrides: ExpenseProjectionOverride[];
}

export function ProjectionsTab({ transactions, overrides: initialOverrides }: Props) {
  const [isMounted, setIsMounted] = useState(false);
  const [baselineStart, setBaselineStart] = useState('');
  const [baselineEnd, setBaselineEnd] = useState('');
  const [inflation, setInflation] = useState<InflationSettings>({ expenseInflationRate: 2, incomeGrowthRate: 3 });
  const [categoryModes, setCategoryModes] = useState<Record<string, CategoryProjectionSetting>>({});
  const [modesExpanded, setModesExpanded] = useState(false);
  const [range, setRange] = useState<Range>('12M');
  const [viewMode, setViewMode] = useState<ViewMode>('both');
  const [localOverrides, setLocalOverrides] = useState<ExpenseProjectionOverride[]>(initialOverrides);
  const [editingCell, setEditingCell] = useState<{ month: string; category: string; value: string } | null>(null);
  const [excludedCategories, setExcludedCategories] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  useEffect(() => {
    const defaults = getDefaultBaseline();
    try {
      const stored = localStorage.getItem('wellspring_projection_settings');
      if (stored) {
        const p = JSON.parse(stored);
        setBaselineStart(p.baselineStart ?? defaults.start);
        setBaselineEnd(p.baselineEnd ?? defaults.end);
        if (p.inflation) setInflation(p.inflation);
        if (p.categoryModes) setCategoryModes(p.categoryModes);
        if (Array.isArray(p.excludedCategories)) setExcludedCategories(new Set(p.excludedCategories));
      } else {
        setBaselineStart(defaults.start);
        setBaselineEnd(defaults.end);
      }
    } catch {
      setBaselineStart(defaults.start);
      setBaselineEnd(defaults.end);
    }
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    try {
      localStorage.setItem('wellspring_projection_settings', JSON.stringify({ baselineStart, baselineEnd, inflation, categoryModes, excludedCategories: [...excludedCategories] }));
    } catch {}
  }, [isMounted, baselineStart, baselineEnd, inflation, categoryModes, excludedCategories]);

  const baselineAverages = useMemo(() => {
    if (!baselineStart || !baselineEnd || baselineStart > baselineEnd) return {};
    return computeBaselineAverages(transactions, baselineStart, baselineEnd, categoryModes);
  }, [transactions, baselineStart, baselineEnd, categoryModes]);

  const allKnownCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const tx of transactions) {
      if (!EXCLUDED_CATS.has(tx.category)) cats.add(tx.category);
    }
    return [...cats].sort();
  }, [transactions]);

  const latestMonthPerCategory = useMemo(() => {
    const result: Record<string, string> = {};
    for (const tx of transactions) {
      if (tx.excluded || tx.oneOff) continue;
      if (EXCLUDED_CATS.has(tx.category)) continue;
      const m = tx.date.slice(0, 7);
      if (baselineEnd && m > baselineEnd) continue;
      if (!result[tx.category] || m > result[tx.category]) result[tx.category] = m;
    }
    return result;
  }, [transactions, baselineEnd]);

  const customModeCount = useMemo(
    () => Object.values(categoryModes).filter(s => s.mode !== 'rolling').length,
    [categoryModes],
  );

  const targetMonths = useMemo(() => makeTargetMonths(range), [range]);

  const projections = useMemo(
    () => generateProjections(baselineAverages, localOverrides, targetMonths, inflation),
    [baselineAverages, localOverrides, targetMonths, inflation],
  );

  const visibleProjections = useMemo(
    () => projections.filter(p => !excludedCategories.has(p.category)),
    [projections, excludedCategories],
  );

  const cashFlow = useMemo(
    () => aggregateCashFlow(visibleProjections, Array.from(INCOME_CATEGORIES)),
    [visibleProjections],
  );

  // Grouped category lists
  const matrixCategories = useMemo(() => Object.keys(baselineAverages).sort(), [baselineAverages]);

  const incomeMatrixCats = useMemo(
    () => matrixCategories.filter(c => INCOME_CATS.has(c)).sort(),
    [matrixCategories],
  );

  const expenseMatrixCats = useMemo(
    () => matrixCategories.filter(c => !INCOME_CATS.has(c)).sort(),
    [matrixCategories],
  );

  const expensesBySubgroup = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const sg of SUBGROUP_ORDER) result[sg] = [];
    for (const cat of expenseMatrixCats) {
      const sg = EXPENSE_SUBGROUP_MAP[cat] ?? 'Other';
      if (!result[sg]) result[sg] = [];
      result[sg].push(cat);
    }
    return result;
  }, [expenseMatrixCats]);

  const matrixMonths = useMemo(() => targetMonths.slice(0, 24), [targetMonths]);

  // Chart bars
  const chartBars = useMemo<ChartBar[]>(() => {
    if (!baselineStart || !baselineEnd) return [];
    const isAnnual = targetMonths.length > 24;
    const baselineMonths = getAllMonthsBetween(baselineStart, baselineEnd);
    const bars: ChartBar[] = [];

    if (isAnnual) {
      const projYears = new Set(targetMonths.map(m => m.slice(0, 4)));
      const baseYears = [...new Set(baselineMonths.map(m => m.slice(0, 4)))].filter(y => !projYears.has(y));
      for (const year of baseYears) {
        const { income, expense } = baselineMonths
          .filter(m => m.startsWith(year))
          .reduce((acc, m) => {
            const ae = computeActualIncomeExpense(transactions, m, excludedCategories);
            return { income: acc.income + ae.income, expense: acc.expense + ae.expense };
          }, { income: 0, expense: 0 });
        bars.push({ key: `a-${year}`, label: year, income, expense, net: income - expense, isActual: true });
      }
      for (const year of [...new Set(targetMonths.map(m => m.slice(0, 4)))]) {
        const { income, expense } = incomeExpenseFromRows(visibleProjections.filter(p => p.month.startsWith(year)));
        bars.push({ key: `p-${year}`, label: year, income, expense, net: income - expense, isActual: false });
      }
    } else {
      for (const month of baselineMonths) {
        const { income, expense } = computeActualIncomeExpense(transactions, month, excludedCategories);
        bars.push({ key: `a-${month}`, label: fmtMonthShort(month), income, expense, net: income - expense, isActual: true });
      }
      for (const month of targetMonths) {
        const { income, expense } = incomeExpenseFromRows(visibleProjections.filter(p => p.month === month));
        bars.push({ key: `p-${month}`, label: fmtMonthShort(month), income, expense, net: income - expense, isActual: false });
      }
    }
    return bars;
  }, [transactions, baselineStart, baselineEnd, targetMonths, visibleProjections, excludedCategories]);

  // Collapse helpers
  function toggleCollapse(key: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  function collapseAll() {
    setCollapsed(new Set(['income', 'expenses', ...SUBGROUP_ORDER.map(sg => `sg:${sg}`)]));
  }
  function expandAll() { setCollapsed(new Set()); }

  // Category exclusion
  function toggleCategory(category: string) {
    setExcludedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category); else next.add(category);
      return next;
    });
  }

  // Cell helpers
  function getCellAmount(month: string, category: string): number {
    return projections.find(p => p.month === month && p.category === category)?.amount ?? 0;
  }
  function hasOverride(month: string, category: string): boolean {
    return localOverrides.some(o => o.month === month && o.category === category);
  }
  function getGroupTotal(cats: string[], month: string): number {
    return cats
      .filter(c => !excludedCategories.has(c))
      .reduce((sum, c) => sum + getCellAmount(month, c), 0);
  }

  function handleCellClick(month: string, category: string) {
    setEditingCell({ month, category, value: getCellAmount(month, category).toFixed(2) });
  }
  function handleCellSave() {
    if (!editingCell) return;
    const amount = parseFloat(editingCell.value);
    if (!isNaN(amount) && amount >= 0) {
      const override: ExpenseProjectionOverride = { month: editingCell.month, category: editingCell.category, amount };
      setLocalOverrides(prev => [
        ...prev.filter(o => !(o.month === override.month && o.category === override.category)),
        override,
      ]);
      startTransition(() => { saveProjectionOverrideAction(override); });
    }
    setEditingCell(null);
  }
  function handleCellClear(month: string, category: string) {
    setLocalOverrides(prev => prev.filter(o => !(o.month === month && o.category === category)));
    startTransition(() => { deleteProjectionOverrideAction(month, category); });
    if (editingCell?.month === month && editingCell?.category === category) setEditingCell(null);
  }

  // Cell renderer (shared between income and expense rows)
  const renderCell = (month: string, category: string, isExcluded: boolean, isIncome: boolean) => {
    const amount = getCellAmount(month, category);
    const isOverride = hasOverride(month, category);
    const isEditing = editingCell?.month === month && editingCell?.category === category;

    if (isEditing) {
      return (
        <div className="flex items-center gap-1 justify-end">
          <input
            type="number" min="0" step="0.01" autoFocus
            value={editingCell!.value}
            onChange={e => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)}
            onKeyDown={e => { if (e.key === 'Enter') handleCellSave(); if (e.key === 'Escape') setEditingCell(null); }}
            onBlur={handleCellSave}
            className="w-20 border border-cyan-400 rounded px-1 py-0.5 text-right text-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
          {isOverride && (
            <button onMouseDown={e => { e.preventDefault(); handleCellClear(month, category); }}
              className="text-slate-300 hover:text-red-500 transition-colors leading-none" title="Clear override">×</button>
          )}
        </div>
      );
    }

    return (
      <button
        onClick={() => !isExcluded && handleCellClick(month, category)}
        disabled={isExcluded}
        className={`w-full text-right px-1 py-0.5 rounded transition-colors ${
          isExcluded ? 'cursor-default'
          : isOverride ? 'text-amber-700 font-semibold hover:bg-slate-100'
          : isIncome ? 'text-emerald-600 hover:bg-slate-100'
          : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        {fmtSGD(amount)}
      </button>
    );
  };

  // Category row renderer (shared)
  const renderCategoryRow = (category: string, indent: string, isIncome: boolean) => {
    const isExcluded = excludedCategories.has(category);
    const modeBadge = MODE_BADGE[categoryModes[category]?.mode ?? 'rolling'];
    return (
      <tr key={category} className={`border-b border-slate-50 ${isExcluded ? 'opacity-40' : 'hover:bg-slate-50/50'}`}>
        <td className={`py-1.5 sticky left-0 bg-white ${indent}`}>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => toggleCategory(category)}
              title={isExcluded ? 'Include in projections' : 'Exclude from projections'}
              className={`text-left font-medium transition-colors hover:text-cyan-600 ${
                isExcluded ? 'text-slate-300 line-through' : 'text-slate-600'
              }`}
            >
              {category}
            </button>
            {modeBadge && (
              <span className="text-[9px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-medium leading-none">{modeBadge}</span>
            )}
          </div>
        </td>
        {matrixMonths.map(month => (
          <td key={month} className="px-2 py-1 text-right">
            {renderCell(month, category, isExcluded, isIncome)}
          </td>
        ))}
      </tr>
    );
  };

  if (!isMounted) {
    return <div className="py-12 text-center text-slate-400 text-sm">Loading...</div>;
  }

  const incomeIsCollapsed = collapsed.has('income');
  const expensesIsCollapsed = collapsed.has('expenses');

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <div className="flex flex-wrap gap-6 items-center">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-600 shrink-0">Rolling baseline</span>
            <input type="month" value={baselineStart} onChange={e => setBaselineStart(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
            <span className="text-slate-400 text-sm">to</span>
            <input type="month" value={baselineEnd} onChange={e => setBaselineEnd(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-600 shrink-0">Expense inflation</span>
            <input type="number" min="0" max="20" step="0.5" value={inflation.expenseInflationRate}
              onChange={e => setInflation(prev => ({ ...prev, expenseInflationRate: parseFloat(e.target.value) || 0 }))}
              className="w-16 text-sm border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
            <span className="text-sm text-slate-400">% / yr</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-600 shrink-0">Income growth</span>
            <input type="number" min="0" max="20" step="0.5" value={inflation.incomeGrowthRate}
              onChange={e => setInflation(prev => ({ ...prev, incomeGrowthRate: parseFloat(e.target.value) || 0 }))}
              className="w-16 text-sm border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
            <span className="text-sm text-slate-400">% / yr</span>
          </div>
        </div>
        {matrixCategories.length === 0 && (
          <p className="mt-3 text-xs text-amber-600">No data in baseline period. Adjust the dates above.</p>
        )}
      </div>

      {/* Category Projection Modes */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setModesExpanded(prev => !prev)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-700">Category Projection Modes</span>
            {customModeCount > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                {customModeCount} custom
              </span>
            )}
          </div>
          <span className="text-slate-400 text-xs select-none">{modesExpanded ? '▲' : '▼'}</span>
        </button>
        {modesExpanded && (
          <div className="px-5 pb-5 border-t border-slate-50">
            <p className="text-xs text-slate-400 mt-3 mb-4">
              <span className="font-medium text-slate-500">Rolling baseline:</span>{' '}
              {baselineStart && baselineEnd ? `${fmtMonthShort(baselineStart)} – ${fmtMonthShort(baselineEnd)}` : 'not set'}
              {' · '}Applies only to categories set to &ldquo;Rolling avg&rdquo;.
            </p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {allKnownCategories.map(cat => (
                <CategoryModeCard
                  key={cat}
                  category={cat}
                  setting={categoryModes[cat] ?? { mode: 'rolling' }}
                  onChange={s => setCategoryModes(prev => ({ ...prev, [cat]: s }))}
                  baselineStart={baselineStart}
                  baselineEnd={baselineEnd}
                  latestMonth={latestMonthPerCategory[cat]}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        {([
          { label: 'Net 1M', value: cashFlow.next1M },
          { label: 'Net 3M', value: cashFlow.next3M },
          { label: 'Net 6M', value: cashFlow.next6M },
          { label: 'Net 12M', value: cashFlow.next12M },
        ] as const).map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <div className="text-sm font-medium text-slate-500 mb-1">{label}</div>
            <div className={`text-2xl font-semibold ${value >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {value < 0 ? '-' : ''}{fmtSGD(value)}
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-slate-700">Cash Flow Projection</h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              {(['both', 'income', 'expense', 'net'] as const).map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                    viewMode === mode ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  {VIEW_MODE_LABELS[mode]}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {(['3M', '6M', '12M', '3Y', '5Y', '10Y', 'MAX'] as const).map(r => (
                <button key={r} onClick={() => setRange(r)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                    range === r ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                  }`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
        <BarChart bars={chartBars} viewMode={viewMode} />
      </div>

      {/* Category Matrix */}
      {matrixCategories.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          <div className="px-5 pt-5 pb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-700">Monthly Projections</h3>
            <div className="flex flex-wrap items-center gap-3">
              {excludedCategories.size > 0 && (
                <span className="text-xs text-amber-600">
                  {excludedCategories.size} categor{excludedCategories.size === 1 ? 'y' : 'ies'} excluded
                </span>
              )}
              <div className="flex gap-1">
                <button onClick={expandAll}
                  className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded hover:bg-slate-100 transition-colors">
                  Expand all
                </button>
                <button onClick={collapseAll}
                  className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded hover:bg-slate-100 transition-colors">
                  Collapse all
                </button>
              </div>
              {targetMonths.length > 24 && <span className="text-xs text-slate-400">First 24 months</span>}
              <span className="text-xs text-slate-400">Click amount to override · click category to exclude</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="text-xs w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-2 text-slate-500 font-medium sticky left-0 bg-white min-w-[200px]">
                    Category
                  </th>
                  {matrixMonths.map(m => (
                    <th key={m} className="px-2 py-2 text-slate-400 font-medium whitespace-nowrap text-right min-w-[84px]">
                      {fmtMonthShort(m)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* ─── INCOME ─── */}
                <tr className="bg-slate-100 border-b border-slate-200 select-none">
                  <td className="sticky left-0 bg-slate-100 px-4 py-2">
                    <button onClick={() => toggleCollapse('income')}
                      className="flex items-center gap-2 font-semibold text-slate-600 hover:text-slate-800 w-full text-left">
                      <span className="text-slate-400 text-[10px] w-2.5">{incomeIsCollapsed ? '▶' : '▼'}</span>
                      <span className="text-xs tracking-widest uppercase">Income</span>
                    </button>
                  </td>
                  {matrixMonths.map(m => (
                    <td key={m} className="px-2 py-2 text-right font-semibold text-emerald-600 text-xs">
                      {incomeIsCollapsed ? fmtSGD(getGroupTotal(incomeMatrixCats, m)) : ''}
                    </td>
                  ))}
                </tr>

                {!incomeIsCollapsed && incomeMatrixCats.map(cat => renderCategoryRow(cat, 'px-4 pl-8', true))}

                {!incomeIsCollapsed && (
                  <tr className="border-b border-emerald-100 bg-emerald-50/40">
                    <td className="sticky left-0 bg-emerald-50/40 px-4 py-1.5 pl-8 font-semibold text-emerald-700">
                      Total Income
                    </td>
                    {matrixMonths.map(m => (
                      <td key={m} className="px-2 py-1.5 text-right font-semibold text-emerald-700">
                        {fmtSGD(getGroupTotal(incomeMatrixCats, m))}
                      </td>
                    ))}
                  </tr>
                )}

                {/* ─── EXPENSES ─── */}
                <tr className="bg-slate-100 border-b border-slate-200 border-t border-t-slate-300 select-none">
                  <td className="sticky left-0 bg-slate-100 px-4 py-2">
                    <button onClick={() => toggleCollapse('expenses')}
                      className="flex items-center gap-2 font-semibold text-slate-600 hover:text-slate-800 w-full text-left">
                      <span className="text-slate-400 text-[10px] w-2.5">{expensesIsCollapsed ? '▶' : '▼'}</span>
                      <span className="text-xs tracking-widest uppercase">Expenses</span>
                    </button>
                  </td>
                  {matrixMonths.map(m => (
                    <td key={m} className="px-2 py-2 text-right font-semibold text-red-600 text-xs">
                      {expensesIsCollapsed ? fmtSGD(getGroupTotal(expenseMatrixCats, m)) : ''}
                    </td>
                  ))}
                </tr>

                {!expensesIsCollapsed && SUBGROUP_ORDER
                  .filter(sg => (expensesBySubgroup[sg]?.length ?? 0) > 0)
                  .map(sg => {
                    const sgCats = expensesBySubgroup[sg];
                    const sgIsCollapsed = collapsed.has(`sg:${sg}`);
                    return (
                      <Fragment key={sg}>
                        {/* Sub-group header */}
                        <tr className="bg-slate-50 border-b border-slate-100 select-none">
                          <td className="sticky left-0 bg-slate-50 px-4 py-1.5 pl-7">
                            <button onClick={() => toggleCollapse(`sg:${sg}`)}
                              className="flex items-center gap-1.5 font-medium text-slate-500 hover:text-slate-700 w-full text-left">
                              <span className="text-slate-400 text-[10px] w-2.5">{sgIsCollapsed ? '▶' : '▼'}</span>
                              <span>{sg}</span>
                            </button>
                          </td>
                          {matrixMonths.map(m => (
                            <td key={m} className="px-2 py-1.5 text-right text-slate-500 font-medium">
                              {sgIsCollapsed ? fmtSGD(getGroupTotal(sgCats, m)) : ''}
                            </td>
                          ))}
                        </tr>

                        {/* Category rows */}
                        {!sgIsCollapsed && sgCats.map(cat => renderCategoryRow(cat, 'px-4 pl-11', false))}
                      </Fragment>
                    );
                  })}

                {!expensesIsCollapsed && (
                  <tr className="border-b border-red-100 bg-red-50/30">
                    <td className="sticky left-0 bg-red-50/30 px-4 py-1.5 pl-8 font-semibold text-red-700">
                      Total Expenses
                    </td>
                    {matrixMonths.map(m => (
                      <td key={m} className="px-2 py-1.5 text-right font-semibold text-red-700">
                        {fmtSGD(getGroupTotal(expenseMatrixCats, m))}
                      </td>
                    ))}
                  </tr>
                )}

                {/* ─── NET ─── */}
                <tr className="bg-slate-100 border-t-2 border-slate-300">
                  <td className="sticky left-0 bg-slate-100 px-4 py-2">
                    <span className="font-bold text-slate-700 text-xs tracking-widest uppercase">Net</span>
                  </td>
                  {matrixMonths.map(m => {
                    const net = getGroupTotal(incomeMatrixCats, m) - getGroupTotal(expenseMatrixCats, m);
                    return (
                      <td key={m} className={`px-2 py-2 text-right font-bold ${net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {net < 0 ? '-' : ''}{fmtSGD(net)}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
