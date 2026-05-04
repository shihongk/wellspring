'use client';

import { useState, useMemo, useTransition } from 'react';
import { ExpenseTransaction, ExpenseRule, ExpenseProjectionOverride } from '@/types';
import { ProjectionsTab } from './ProjectionsTab';
import { EXPENSE_CATEGORIES } from '@/lib/constants';
import {
  updateExpenseCategoryAction,
  setExpenseExcludedAction,
  setExpenseOneOffAction,
  createExpenseRuleAction,
  bulkUpdateCategoryAction,
} from '@/app/lib/actions';
import { ImportButton } from './ImportButton';
import {
  Utensils, TrainFront, ShoppingCart, ShoppingBag, HeartPulse, Ticket, Plane,
  Lightbulb, Repeat, TrendingUp, FileText, Home, Hammer, Landmark, Wallet, Coins, PiggyBank, ArrowRightLeft, HelpCircle, LucideIcon, Calendar,
  Receipt, BookOpen
} from 'lucide-react';

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtSGD(n: number): string {
  return 'S$' + n.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function toMonthKey(d: string) { return d.slice(0, 7); }
function formatMonthLabel(key: string) {
  const [y, m] = key.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('en-SG', { month: 'short', year: 'numeric' });
}
function suggestMerchant(desc: string) {
  return desc.replace(/\s+[A-Z0-9]{6,}\s*$/i, '').replace(/\s+\d+\s*$/, '').trim();
}
function formatDateHeader(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' });
}
function groupTxsByDate(txs: ExpenseTransaction[]) {
  const groups: Record<string, ExpenseTransaction[]> = {};
  for (const tx of txs) {
    if (!groups[tx.date]) groups[tx.date] = [];
    groups[tx.date].push(tx);
  }
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
}

const ANNUAL_FEE_RE = /ANNUAL.*(MEMBER|FEE)/i;

// ─── icon & category colours ──────────────────────────────────────────────────

function getCategoryIconAndColor(cat: string): { Icon: LucideIcon, bg: string, text: string } {
  switch (cat) {
    case 'Food & Drink': return { Icon: Utensils, bg: 'bg-orange-50', text: 'text-orange-600' };
    case 'Transport': return { Icon: TrainFront, bg: 'bg-blue-50', text: 'text-blue-600' };
    case 'Groceries': return { Icon: ShoppingCart, bg: 'bg-emerald-50', text: 'text-emerald-600' };
    case 'Shopping': return { Icon: ShoppingBag, bg: 'bg-purple-50', text: 'text-purple-600' };
    case 'Healthcare': return { Icon: HeartPulse, bg: 'bg-pink-50', text: 'text-pink-600' };
    case 'Entertainment': return { Icon: Ticket, bg: 'bg-yellow-50', text: 'text-yellow-600' };
    case 'Travel': return { Icon: Plane, bg: 'bg-cyan-50', text: 'text-cyan-600' };
    case 'Utilities': return { Icon: Lightbulb, bg: 'bg-slate-50', text: 'text-slate-600' };
    case 'Subscriptions': return { Icon: Repeat, bg: 'bg-indigo-50', text: 'text-indigo-600' };
    case 'Investment': return { Icon: TrendingUp, bg: 'bg-teal-50', text: 'text-teal-600' };
    case 'Tax': return { Icon: FileText, bg: 'bg-red-50', text: 'text-red-600' };
    case 'Mortgage': return { Icon: Home, bg: 'bg-amber-50', text: 'text-amber-600' };
    case 'Home Improvement': return { Icon: Hammer, bg: 'bg-sky-50', text: 'text-sky-600' };
    case 'Bank Charges': return { Icon: Landmark, bg: 'bg-slate-100', text: 'text-slate-600' };
    case 'Fees & Charges': return { Icon: Receipt, bg: 'bg-rose-50', text: 'text-rose-600' };
    case 'Books & Stationery': return { Icon: BookOpen, bg: 'bg-fuchsia-50', text: 'text-fuchsia-600' };
    case 'Salary': return { Icon: Wallet, bg: 'bg-emerald-50', text: 'text-emerald-600' };
    case 'Interest': return { Icon: Coins, bg: 'bg-blue-50', text: 'text-blue-600' };
    case 'Other Income': return { Icon: PiggyBank, bg: 'bg-lime-50', text: 'text-lime-600' };
    case 'Income': return { Icon: Wallet, bg: 'bg-lime-50', text: 'text-lime-600' };
    case 'Transfer': return { Icon: ArrowRightLeft, bg: 'bg-slate-100', text: 'text-slate-600' };
    default: return { Icon: HelpCircle, bg: 'bg-slate-50', text: 'text-slate-400' };
  }
}

const CAT_COLOR: Record<string, string> = {
  'Food & Drink':     '#FF7E67',
  'Transport':        '#4D96FF',
  'Groceries':        '#6BCB77',
  'Shopping':         '#9D4EDD',
  'Healthcare':       '#FF70A6',
  'Entertainment':    '#FFD166',
  'Travel':           '#00B4D8',
  'Utilities':        '#7D8597',
  'Subscriptions':    '#8338EC',
  'Investment':       '#06D6A0',
  'Tax':              '#EF476F',
  'Mortgage':         '#E07A5F',
  'Home Improvement': '#118AB2',
  'Bank Charges':     '#94A3B8',
  'Fees & Charges':   '#F43F5E',
  'Books & Stationery': '#D946EF',
  'Salary':           '#06D6A0',
  'Interest':         '#118AB2',
  'Other Income':     '#FFD166',
  'Income':           '#6BCB77',
  'Transfer':         '#CBD5E1',
  'Other':            '#E2E8F0',
};
const DEFAULT_COLOR = '#E2E8F0';

// ─── donut chart ─────────────────────────────────────────────────────────────

function pt(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg - 90) * (Math.PI / 180);
  return [+(cx + r * Math.cos(rad)).toFixed(3), +(cy + r * Math.sin(rad)).toFixed(3)];
}

function computeArcs(slices: { cat: string; pct: number }[], gap: number) {
  let currentAngle = 0;
  return slices.map(slice => {
    const sweep = (slice.pct / 100) * 360;
    const start = currentAngle + gap / 2;
    const end = currentAngle + sweep - gap / 2;
    currentAngle += sweep;
    return { ...slice, sweep, start, end };
  });
}

function DonutChart({ slices, selected, onSelect, centerText }: {
  slices: { cat: string; pct: number }[];
  selected: string | null;
  onSelect: (cat: string | null) => void;
  centerText?: string;
}) {
  const cx = 160, cy = 160, R = 140, ri = 85;
  const gap = slices.length > 1 ? 2 : 0;
  
  const arcs = computeArcs(slices, gap);

  return (
    <svg viewBox="0 0 320 320" className="w-64 h-64 md:w-80 md:h-80 shrink-0 drop-shadow-sm">
      {arcs.map(({ cat, pct, sweep, start, end }) => {
        if (pct < 0.5) return null;

        const [ox1, oy1] = pt(cx, cy, R, start);
        const [ox2, oy2] = pt(cx, cy, R, end);
        const [ix2, iy2] = pt(cx, cy, ri, end);
        const [ix1, iy1] = pt(cx, cy, ri, start);
        const large = sweep - gap > 180 ? 1 : 0;
        const d = `M${ox1} ${oy1} A${R} ${R} 0 ${large} 1 ${ox2} ${oy2} L${ix2} ${iy2} A${ri} ${ri} 0 ${large} 0 ${ix1} ${iy1}Z`;
        const isSelected = selected === cat;
        return (
          <path
            key={cat}
            d={d}
            fill={CAT_COLOR[cat] ?? DEFAULT_COLOR}
            opacity={selected && !isSelected ? 0.3 : 1}
            stroke="white"
            strokeWidth="3"
            className="cursor-pointer transition-all duration-300 hover:opacity-90"
            onClick={() => onSelect(isSelected ? null : cat)}
          />
        );
      })}
      <circle cx={cx} cy={cy} r={ri} fill="white" />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="18" fill="#64748b" fontWeight="500">
        {selected ? selected : (centerText || 'Total')}
      </text>
    </svg>
  );
}

// ─── category dropdown ────────────────────────────────────────────────────────

const CATEGORY_GROUPS = [
  { label: 'Spending', options: ['Bank Charges','Books & Stationery','Entertainment','Fees & Charges','Food & Drink','Groceries','Healthcare','Home Improvement','Investment','Mortgage','Shopping','Subscriptions','Tax','Transport','Travel','Utilities'] },
  { label: 'Income',   options: ['Income','Interest','Other Income','Salary'] },
  { label: 'Other',    options: ['Other','Transfer'] },
] satisfies { label: string; options: (typeof EXPENSE_CATEGORIES[number])[] }[];

function CategorySelect({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={className}>
      {CATEGORY_GROUPS.map(g => (
        <optgroup key={g.label} label={g.label}>
          {g.options.map(c => <option key={c} value={c}>{c}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ title, amount, amountColor }: { title: string; amount: number; amountColor: string }) {
  return (
    <div className="p-4 rounded-xl border border-slate-100 bg-white shadow-sm flex flex-col">
      <div className="text-sm font-medium text-slate-500 mb-1">{title}</div>
      <div className={`text-2xl font-semibold ${amountColor}`}>{fmtSGD(amount)}</div>
    </div>
  );
}

// ─── unified transaction row ──────────────────────────────────────────────────

function TxRow({
  tx, cat, excluded, oneOff,
  onCategory, onExclude, onOneOff, onRule, onApply, onApplyDismiss,
  ruleOpen, applyOpen,
  ruleForm, setRuleForm, handleSaveRule
}: {
  tx: ExpenseTransaction;
  cat: string;
  excluded: boolean;
  oneOff: boolean;
  onCategory: (v: string) => void;
  onExclude: (v: boolean) => void;
  onOneOff: (v: boolean) => void;
  onRule: () => void;
  onApply: () => void;
  onApplyDismiss: () => void;
  ruleOpen: boolean;
  applyOpen: boolean;
  ruleForm: { id: string; merchant: string; category: string } | null;
  setRuleForm: React.Dispatch<React.SetStateAction<{ id: string; merchant: string; category: string } | null>>;
  handleSaveRule: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { Icon, bg, text } = getCategoryIconAndColor(cat);

  const isCredit = tx.direction === 'credit';
  const amountClass = isCredit ? 'text-emerald-600 font-bold' : 'text-slate-800 font-medium';
  const amountText = isCredit ? `+${fmtSGD(tx.amount)}` : fmtSGD(tx.amount);

  return (
    <div className="flex flex-col">
      <div
        className={`flex items-center gap-4 px-3 py-3 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors ${excluded ? 'opacity-40 grayscale' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Left */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${bg} ${text}`}>
          <Icon size={20} />
        </div>
        {/* Middle */}
        <div className="flex-1 min-w-0 flex flex-col">
          <span className={`text-sm font-semibold text-slate-800 truncate ${excluded ? 'line-through text-slate-500' : ''}`}>
            {tx.description}
          </span>
          <span className="text-xs text-slate-500 truncate">
            {cat} • {tx.account}
          </span>
        </div>
        {/* Right */}
        <div className={`text-right ${amountClass}`}>
          {amountText}
        </div>
      </div>

      {/* Expanded Sub-panel */}
      {expanded && (
        <div className="bg-slate-50 px-4 py-3 ml-12 rounded-lg mb-2 flex flex-col gap-3 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Category</span>
              <CategorySelect value={cat} onChange={onCategory} className="border border-slate-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-slate-300" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer ml-2">
              <input type="checkbox" checked={excluded} onChange={e => onExclude(e.target.checked)} className="rounded border-slate-300 text-slate-600 focus:ring-slate-500" />
              <span className="text-slate-600">Exclude from totals</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={oneOff} onChange={e => onOneOff(e.target.checked)} className="rounded border-slate-300 text-slate-600 focus:ring-slate-500" />
              <span className="text-slate-600">One-off (exclude from projections)</span>
            </label>
            <button onClick={onRule} className="text-indigo-600 font-medium ml-auto hover:text-indigo-800 transition-colors text-sm">
              Create Rule
            </button>
          </div>

          {ruleOpen && ruleForm && (
            <div className="flex items-center gap-2 flex-wrap text-xs bg-indigo-50 p-3 rounded-md border border-indigo-100">
              <span className="text-indigo-700 font-medium">Match description containing:</span>
              <input
                value={ruleForm.merchant}
                onChange={e => setRuleForm(f => f ? { ...f, merchant: e.target.value } : f)}
                className="border border-indigo-200 rounded px-2 py-1.5 w-52 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 bg-white"
              />
              <span className="text-indigo-300">→</span>
              <CategorySelect
                value={ruleForm.category}
                onChange={v => setRuleForm(f => f ? { ...f, category: v } : f)}
                className="border border-indigo-200 rounded px-1.5 py-1.5 bg-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
              />
              <button onClick={handleSaveRule} disabled={!ruleForm.merchant.trim()} className="px-3 py-1.5 bg-indigo-600 text-white font-medium rounded hover:bg-indigo-700 disabled:opacity-40 transition-colors ml-auto">Save rule</button>
            </div>
          )}

          {applyOpen && (
            <div className="flex items-center gap-3 flex-wrap text-xs bg-blue-50 p-3 rounded-md border border-blue-100">
              <span className="text-blue-800">
                Other transactions share this description — apply <strong>{cat}</strong> to all?
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button onClick={onApply} className="px-3 py-1.5 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 transition-colors">Apply to all</button>
                <button onClick={onApplyDismiss} className="px-3 py-1.5 text-blue-600 font-medium hover:bg-blue-100 rounded transition-colors">No thanks</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

interface Props {
  transactions: ExpenseTransaction[];
  rules: ExpenseRule[];
  overrides: ExpenseProjectionOverride[];
}

export function ExpensesClient({ transactions, overrides }: Props) {
  const months = useMemo(() => {
    const keys = [...new Set(transactions.map(t => toMonthKey(t.date)))].sort().reverse();
    return keys;
  }, [transactions]);

  const defaultMonth = months[0] ?? toMonthKey(new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [localCategories, setLocalCategories] = useState<Record<string, string>>({});
  const [localExcluded, setLocalExcluded]   = useState<Record<string, boolean>>({});
  const [localOneOff, setLocalOneOff]       = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  const [hideExcluded, setHideExcluded] = useState(true);
  const [hideInvestment, setHideInvestment] = useState(true);
  const [ruleForm, setRuleForm] = useState<{ id: string; merchant: string; category: string } | null>(null);
  const [applyConfirm, setApplyConfirm] = useState<{ triggeredId: string; category: string; matchIds: string[] } | null>(null);
  
  const [tab, setTab] = useState<'spending' | 'income'>('spending');
  const [mainTab, setMainTab] = useState<'transactions' | 'projections'>('transactions');

  const isExcluded = (tx: ExpenseTransaction) => localExcluded[tx.id] ?? tx.excluded ?? false;
  const isOneOff   = (tx: ExpenseTransaction) => localOneOff[tx.id]   ?? tx.oneOff   ?? false;
  const catOf      = (tx: ExpenseTransaction) => localCategories[tx.id] ?? tx.category;

  const filtered = useMemo(() => transactions.filter(t => toMonthKey(t.date) === selectedMonth), [transactions, selectedMonth]);

  const annualFees = useMemo(() => {
    const allFees = transactions.filter(t => ANNUAL_FEE_RE.test(t.description) && t.direction === 'debit');
    const unique = new Map<string, ExpenseTransaction>();
    for (const t of allFees) {
      if (!unique.has(t.account)) unique.set(t.account, t);
    }
    return Array.from(unique.values());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, localExcluded]);

  const spendingTxs = useMemo(
    () => filtered.filter(t => t.direction === 'debit' && (!hideExcluded || !isExcluded(t)) && (!hideInvestment || catOf(t) !== 'Investment')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, hideExcluded, hideInvestment, localExcluded, localCategories],
  );
  
  const incomeTxs = useMemo(
    () => filtered.filter(t => t.direction === 'credit' && (!hideExcluded || !isExcluded(t)) && (!hideInvestment || catOf(t) !== 'Investment')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, hideExcluded, hideInvestment, localExcluded, localCategories],
  );

  // Breakdown for pie chart (non-excluded debits only)
  const breakdown = useMemo(() => {
    const debits = filtered.filter(t => t.direction === 'debit' && !isExcluded(t) && (!hideInvestment || catOf(t) !== 'Investment'));
    const total = debits.reduce((s, t) => s + t.amount, 0);
    const byCat: Record<string, number> = {};
    for (const t of debits) { const c = catOf(t); byCat[c] = (byCat[c] ?? 0) + t.amount; }
    return Object.entries(byCat)
      .map(([cat, sum]) => ({ cat, sum, pct: total > 0 ? (sum / total) * 100 : 0 }))
      .sort((a, b) => b.sum - a.sum);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, localCategories, localExcluded, hideInvestment]);

  // Breakdown for pie chart (non-excluded credits only)
  const incomeBreakdown = useMemo(() => {
    const credits = filtered.filter(t => t.direction === 'credit' && !isExcluded(t) && (!hideInvestment || catOf(t) !== 'Investment'));
    const total = credits.reduce((s, t) => s + t.amount, 0);
    const byCat: Record<string, number> = {};
    for (const t of credits) { const c = catOf(t); byCat[c] = (byCat[c] ?? 0) + t.amount; }
    return Object.entries(byCat)
      .map(([cat, sum]) => ({ cat, sum, pct: total > 0 ? (sum / total) * 100 : 0 }))
      .sort((a, b) => b.sum - a.sum);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, localCategories, localExcluded, hideInvestment]);

  const spendingTotal = useMemo(() => breakdown.reduce((s, r) => s + r.sum, 0), [breakdown]);
  const incomeTotal   = useMemo(() => incomeBreakdown.reduce((s, r) => s + r.sum, 0), [incomeBreakdown]);
  const netCashflow = incomeTotal - spendingTotal;

  const activeTxs = tab === 'spending' ? spendingTxs : incomeTxs;
  const visibleTxs = useMemo(() =>
    (tab === 'spending' && selectedCategory) ? activeTxs.filter(t => catOf(t) === selectedCategory) : 
    (tab === 'income' && selectedCategory) ? activeTxs.filter(t => catOf(t) === selectedCategory) : activeTxs,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTxs, selectedCategory, localCategories, tab],
  );
  
  const groupedTxs = useMemo(() => groupTxsByDate(visibleTxs), [visibleTxs]);

  function prevMonth() { const i = months.indexOf(selectedMonth); if (i < months.length - 1) setSelectedMonth(months[i + 1]); }
  function nextMonth() { const i = months.indexOf(selectedMonth); if (i > 0) setSelectedMonth(months[i - 1]); }

  function handleCategoryChange(id: string, category: string) {
    setLocalCategories(prev => ({ ...prev, [id]: category }));
    startTransition(() => { updateExpenseCategoryAction(id, category); });

    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    const matchIds = transactions
      .filter(t => t.id !== id && t.description === tx.description && catOf(t) !== category)
      .map(t => t.id);
    if (matchIds.length > 0) {
      setRuleForm(null);
      setApplyConfirm({ triggeredId: id, category, matchIds });
    } else {
      setApplyConfirm(null);
    }
  }

  function handleBulkApply() {
    if (!applyConfirm) return;
    const updates = Object.fromEntries(applyConfirm.matchIds.map(id => [id, applyConfirm.category]));
    setLocalCategories(prev => ({ ...prev, ...updates }));
    startTransition(() => { bulkUpdateCategoryAction(applyConfirm.matchIds, applyConfirm.category); });
    setApplyConfirm(null);
  }

  function handleToggleExcluded(id: string, v: boolean) {
    setLocalExcluded(prev => ({ ...prev, [id]: v }));
    startTransition(() => { setExpenseExcludedAction(id, v); });
  }

  function handleToggleOneOff(id: string, v: boolean) {
    setLocalOneOff(prev => ({ ...prev, [id]: v }));
    startTransition(() => { setExpenseOneOffAction(id, v); });
  }

  function handleOpenRule(tx: ExpenseTransaction) {
    if (ruleForm?.id === tx.id) { setRuleForm(null); return; }
    setApplyConfirm(null);
    setRuleForm({ id: tx.id, merchant: suggestMerchant(tx.description), category: catOf(tx) });
  }

  function handleSaveRule() {
    if (!ruleForm?.merchant.trim()) return;
    startTransition(() => { createExpenseRuleAction(ruleForm.merchant.trim(), ruleForm.category); });
    setRuleForm(null);
  }

  const monthIdx = months.indexOf(selectedMonth);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Bar: main tabs + Import */}
      <div className="flex items-center justify-between">
        <div className="flex p-1 bg-slate-100 rounded-lg shadow-inner">
          <button
            onClick={() => setMainTab('transactions')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${mainTab === 'transactions' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Transactions
          </button>
          <button
            onClick={() => setMainTab('projections')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${mainTab === 'projections' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Projections
          </button>
        </div>
        <ImportButton />
      </div>

      {mainTab === 'projections' ? (
        <ProjectionsTab transactions={transactions} overrides={overrides} />
      ) : (
        <>
      {/* Month Nav */}
      <div className="flex items-center gap-3">
        <button onClick={prevMonth} disabled={monthIdx >= months.length - 1} className="px-2 py-1 rounded text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-colors">&lt;</button>
        <span className="text-base font-semibold w-28 text-center text-slate-800">{formatMonthLabel(selectedMonth)}</span>
        <button onClick={nextMonth} disabled={monthIdx <= 0} className="px-2 py-1 rounded text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-colors">&gt;</button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-4">
        <KPICard title="Total Spend" amount={spendingTotal} amountColor="text-slate-800" />
        <KPICard title="Total Income" amount={incomeTotal} amountColor="text-emerald-600" />
        <KPICard title="Net Cashflow" amount={netCashflow} amountColor={netCashflow >= 0 ? "text-emerald-600" : "text-red-600"} />
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-slate-500">No transactions for this month.</div>
      ) : (
        <div className="flex flex-col gap-8 items-stretch">
          {/* Header: Sub-tabs & Toggles */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex p-1 bg-slate-100 rounded-lg shadow-inner">
              <button
                onClick={() => { setTab('spending'); setSelectedCategory(null); }}
                className={`px-8 py-2 rounded-md text-sm font-medium transition-all ${tab === 'spending' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Spending
              </button>
              <button
                onClick={() => { setTab('income'); setSelectedCategory(null); }}
                className={`px-8 py-2 rounded-md text-sm font-medium transition-all ${tab === 'income' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Income
              </button>
            </div>
            <div className="flex items-center gap-4">
              {selectedCategory && (
                <button onClick={() => setSelectedCategory(null)} className="text-xs text-indigo-600 font-medium hover:text-indigo-800 flex items-center gap-1">
                  Clear filter: {selectedCategory} ✕
                </button>
              )}
              <label className="flex items-center gap-2 text-xs font-medium text-slate-500 cursor-pointer select-none bg-white border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                <input type="checkbox" checked={hideInvestment} onChange={e => setHideInvestment(e.target.checked)} className="rounded border-slate-300 text-slate-600 focus:ring-slate-500" />
                Hide investment
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-500 cursor-pointer select-none bg-white border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                <input type="checkbox" checked={hideExcluded} onChange={e => setHideExcluded(e.target.checked)} className="rounded border-slate-300 text-slate-600 focus:ring-slate-500" />
                Hide excluded
              </label>
            </div>
          </div>

          {/* OVERVIEW SECTION */}
          <div className="bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
            {tab === 'spending' && breakdown.length > 0 && (
               <>
                 <div className="flex-1 flex justify-center w-full max-w-sm">
                   <DonutChart slices={breakdown} selected={selectedCategory} onSelect={setSelectedCategory} centerText="Total Spend" />
                 </div>
                 <div className="flex-1 w-full max-w-sm space-y-1.5 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                   {breakdown.map(({ cat, sum, pct }) => {
                     const isSelected = selectedCategory === cat;
                     const { Icon, text } = getCategoryIconAndColor(cat);
                     return (
                       <button
                         key={cat}
                         onClick={() => setSelectedCategory(isSelected ? null : cat)}
                         className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition-all ${isSelected ? 'bg-slate-50 ring-1 ring-slate-200 shadow-sm' : 'hover:bg-slate-50'}`}
                       >
                         <Icon size={18} className={text} />
                         <span className="flex-1 text-slate-700 truncate font-medium">{cat}</span>
                         <span className="tabular-nums text-slate-400 text-xs">{pct.toFixed(0)}%</span>
                         <span className="tabular-nums text-slate-800 font-semibold text-sm">{fmtSGD(sum)}</span>
                       </button>
                     );
                   })}
                 </div>
               </>
            )}
            {tab === 'income' && incomeBreakdown.length > 0 && (
               <>
                 <div className="flex-1 flex justify-center w-full max-w-sm">
                   <DonutChart slices={incomeBreakdown} selected={selectedCategory} onSelect={setSelectedCategory} centerText="Total Income" />
                 </div>
                 <div className="flex-1 w-full max-w-sm space-y-1.5 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                   {incomeBreakdown.map(({ cat, sum, pct }) => {
                     const isSelected = selectedCategory === cat;
                     const { Icon, text } = getCategoryIconAndColor(cat);
                     return (
                       <button
                         key={cat}
                         onClick={() => setSelectedCategory(isSelected ? null : cat)}
                         className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition-all ${isSelected ? 'bg-slate-50 ring-1 ring-slate-200 shadow-sm' : 'hover:bg-slate-50'}`}
                       >
                         <Icon size={18} className={text} />
                         <span className="flex-1 text-slate-700 truncate font-medium">{cat}</span>
                         <span className="tabular-nums text-slate-400 text-xs">{pct.toFixed(0)}%</span>
                         <span className="tabular-nums text-emerald-600 font-semibold text-sm">{fmtSGD(sum)}</span>
                       </button>
                     );
                   })}
                 </div>
               </>
            )}
            {tab === 'spending' && breakdown.length === 0 && (
              <div className="text-slate-400 text-sm py-12 text-center w-full">No spending data to chart.</div>
            )}
            {tab === 'income' && incomeBreakdown.length === 0 && (
              <div className="text-slate-400 text-sm py-12 text-center w-full">No income data to chart.</div>
            )}
          </div>

          {/* DISCREET ANNUAL FEES */}
          {annualFees.length > 0 && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-sm shadow-sm transition-all hover:border-slate-300">
              <div className="flex items-center gap-2 text-slate-500 font-medium">
                <Landmark size={18} className="text-slate-400" />
                Annual Fees:
              </div>
              <div className="flex-1 flex flex-wrap gap-2">
                {annualFees.map(t => (
                  <div key={t.id} className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-600 shadow-sm">
                    <span className="font-semibold text-slate-700">{t.account}</span>
                    <span className="text-slate-300 mx-1">|</span>
                    <Calendar size={12} className="text-slate-400" />
                    <span className="text-slate-500">{new Date(t.date).toLocaleDateString('en-SG', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                ))}
              </div>
              <div className="text-xs text-indigo-600 font-medium bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg shrink-0">
                Tracked for next year
              </div>
            </div>
          )}

          {/* Feed List */}
          <div className="space-y-6">
            {groupedTxs.map(([date, txs]) => (
              <div key={date}>
                <div className="sticky top-0 bg-white/95 backdrop-blur z-10 py-2 mb-2 border-b border-slate-100">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{formatDateHeader(date)}</h3>
                </div>
                <div className="flex flex-col gap-1">
                  {txs.map(tx => {
                    const cat      = catOf(tx);
                    const excluded = isExcluded(tx);
                    const ruleOpen  = ruleForm?.id === tx.id;
                    const applyOpen = applyConfirm?.triggeredId === tx.id;
                    return (
                      <TxRow
                        key={tx.id}
                        tx={tx} cat={cat} excluded={excluded} oneOff={isOneOff(tx)}
                        ruleOpen={ruleOpen} applyOpen={applyOpen}
                        onCategory={v => handleCategoryChange(tx.id, v)}
                        onExclude={v => handleToggleExcluded(tx.id, v)}
                        onOneOff={v => handleToggleOneOff(tx.id, v)}
                        onRule={() => handleOpenRule(tx)}
                        onApply={handleBulkApply}
                        onApplyDismiss={() => setApplyConfirm(null)}
                        ruleForm={ruleForm}
                        setRuleForm={setRuleForm}
                        handleSaveRule={handleSaveRule}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
            {groupedTxs.length === 0 && (
               <div className="py-8 text-center text-slate-500 text-sm border-2 border-dashed border-slate-200 rounded-xl">No transactions match your filters.</div>
            )}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
