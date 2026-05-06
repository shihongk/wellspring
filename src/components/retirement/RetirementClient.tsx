'use client';

import React, { useState, useEffect, useMemo, useTransition, useRef } from 'react';
import { CpfBalance, RetirementOneOff, RetirementSettings, ExpenseTransaction, ExpenseProjectionOverride, InflationSettings, CategoryProjectionSetting } from '@/types';
import { projectRetirement } from '@/lib/retirement/projections';
import { computeBaselineAverages, generateProjections, INCOME_CATEGORIES } from '@/lib/expenses/projections';
import { saveRetirementOneOffAction, deleteRetirementOneOffAction } from '@/app/lib/actions';
import { Settings, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

const INCOME_CAT_SET = new Set(INCOME_CATEGORIES);

function fmtSGD(n: number): string {
  return 'S$' + Math.round(n).toLocaleString('en-SG');
}

export interface RetirementClientProps {
  cpfBalance: CpfBalance | null;
  oneOffs: RetirementOneOff[];
  currentPortfolioByTicker: Record<string, number>;
  tickerWeights: Record<string, number>;
  initialGrossMonthlySalary: number;
  initialNetMonthlyCashFlow: number;
  expenseTransactions: ExpenseTransaction[];
  projectionOverrides: ExpenseProjectionOverride[];
}

export function RetirementClient({
  cpfBalance,
  oneOffs: initialOneOffs,
  currentPortfolioByTicker,
  tickerWeights,
  initialGrossMonthlySalary,
  initialNetMonthlyCashFlow,
  expenseTransactions,
  projectionOverrides,
}: RetirementClientProps) {
  const [settings, setSettings] = useState<RetirementSettings>({
    dob: '1984-06',
    retirementAge: 65,
    payoutStartAge: 65,
    tickerReturns: Object.keys(currentPortfolioByTicker).reduce((acc, t) => { acc[t] = 5; return acc; }, {} as Record<string, number>),
    grossMonthlySalaryOverride: null,
    inflationRate: 2.5,
  });
  const [netMonthlyCashFlowOverride, setNetMonthlyCashFlowOverride] = useState<number | null>(null);

  const [localOneOffs, setLocalOneOffs] = useState(initialOneOffs);
  const [isPending, startTransition] = useTransition();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [chartMode, setChartMode] = useState<'net-worth' | 'stacked'>('stacked');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [newOneOffYear, setNewOneOffYear] = useState<string>(new Date().getFullYear().toString());
  const [newOneOffDesc, setNewOneOffDesc] = useState('');
  const [newOneOffAmt, setNewOneOffAmt] = useState('');
  const [newOneOffInTodaysPrices, setNewOneOffInTodaysPrices] = useState(true);

  const [expProjSettings, setExpProjSettings] = useState<{
    baselineStart: string;
    baselineEnd: string;
    inflation: InflationSettings;
    categoryModes: Record<string, CategoryProjectionSetting>;
  }>({
    baselineStart: '',
    baselineEnd: '',
    inflation: { expenseInflationRate: 2, incomeGrowthRate: 3 },
    categoryModes: {},
  });

  // Load/save settings from localStorage
  const [hasLoaded, setHasLoaded] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem('wellspring_retirement_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const tr = { ...settings.tickerReturns, ...(parsed.tickerReturns || {}) };
        Object.keys(currentPortfolioByTicker).forEach(t => {
          if (tr[t] === undefined) tr[t] = 5;
        });
        setSettings({ ...settings, ...parsed, tickerReturns: tr });
        setNetMonthlyCashFlowOverride(parsed.netMonthlyCashFlowOverride ?? null);
      } catch {}
    }

    // Load expense projection settings (shared with the Expenses tab)
    try {
      const expSaved = localStorage.getItem('wellspring_projection_settings');
      if (expSaved) {
        const p = JSON.parse(expSaved);
        const now = new Date();
        const defEnd = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const defStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        setExpProjSettings({
          baselineStart: p.baselineStart ?? fmt(defStart),
          baselineEnd: p.baselineEnd ?? fmt(defEnd),
          inflation: p.inflation ?? { expenseInflationRate: 2, incomeGrowthRate: 3 },
          categoryModes: p.categoryModes ?? {},
        });
      }
    } catch {}

    setHasLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hasLoaded) {
      localStorage.setItem('wellspring_retirement_settings', JSON.stringify({ ...settings, netMonthlyCashFlowOverride }));
    }
  }, [settings, netMonthlyCashFlowOverride, hasLoaded]);

  const currentYear = new Date().getFullYear();
  const birthYear = parseInt(settings.dob.slice(0, 4), 10) || 1984;
  const currentAge = currentYear - birthYear;
  const horizonYears = Math.max(10, settings.retirementAge - currentAge + 10);

  const projected = useMemo(() => {
    if (!cpfBalance) return [];
    return projectRetirement({
      cpfStartBalances: cpfBalance,
      dob: settings.dob,
      retirementAge: settings.retirementAge,
      payoutStartAge: settings.payoutStartAge,
      grossMonthlySalary: settings.grossMonthlySalaryOverride ?? initialGrossMonthlySalary,
      netMonthlyCashFlow: netMonthlyCashFlowOverride ?? initialNetMonthlyCashFlow,
      currentPortfolioByTicker,
      tickerReturns: settings.tickerReturns,
      tickerWeights,
      oneOffs: localOneOffs,
      horizonYears,
      inflationRate: settings.inflationRate,
    });
  }, [cpfBalance, settings, netMonthlyCashFlowOverride, currentPortfolioByTicker, tickerWeights, localOneOffs, horizonYears, initialGrossMonthlySalary, initialNetMonthlyCashFlow]);

  // Yearly income/expense projections from the expense tab's baseline
  const yearlyExpenseProjections = useMemo(() => {
    if (!hasLoaded || !expProjSettings.baselineStart || expenseTransactions.length === 0) return {};
    const startYear = projected[0]?.year ?? currentYear;
    const endYear = projected[projected.length - 1]?.year ?? currentYear + horizonYears;
    const targetMonths: string[] = [];
    for (let y = startYear; y <= endYear; y++) {
      for (let m = 1; m <= 12; m++) {
        targetMonths.push(`${y}-${String(m).padStart(2, '0')}`);
      }
    }
    const baseline = computeBaselineAverages(
      expenseTransactions,
      expProjSettings.baselineStart,
      expProjSettings.baselineEnd,
      expProjSettings.categoryModes,
    );
    const rows = generateProjections(baseline, projectionOverrides, targetMonths, expProjSettings.inflation);
    const byYear: Record<number, { income: number; expenses: number }> = {};
    for (const row of rows) {
      const y = parseInt(row.month.slice(0, 4));
      if (!byYear[y]) byYear[y] = { income: 0, expenses: 0 };
      if (INCOME_CAT_SET.has(row.category)) byYear[y].income += row.amount;
      else byYear[y].expenses += row.amount;
    }
    return byYear;
  }, [hasLoaded, expProjSettings, expenseTransactions, projectionOverrides, projected, currentYear, horizonYears]);

  const atRetirement = projected.find(p => p.age === settings.retirementAge) || projected[projected.length - 1];

  const kpiNetWorth = atRetirement?.netWorth ?? 0;
  const kpiInvestments = atRetirement?.investments ?? 0;
  const kpiCpf = atRetirement?.cpf.totalCpf ?? 0;
  const kpiCpfLife = projected.find(p => p.age === settings.payoutStartAge)?.cpf.cpfLifeMonthlyPayout ?? 0;

  const handleAddOneOff = () => {
    const yr = parseInt(newOneOffYear, 10);
    const amt = parseFloat(newOneOffAmt);
    if (isNaN(yr) || isNaN(amt) || !newOneOffDesc) return;

    const newRow: RetirementOneOff = {
      id: 'oo_' + Date.now(),
      year: yr,
      description: newOneOffDesc,
      amountSGD: amt,
      inTodaysPrices: newOneOffInTodaysPrices,
    };

    setLocalOneOffs(prev => [...prev, newRow].sort((a, b) => a.year - b.year));
    setNewOneOffDesc('');
    setNewOneOffAmt('');
    
    startTransition(() => {
      saveRetirementOneOffAction(newRow);
    });
  };

  const handleDeleteOneOff = (id: string) => {
    setLocalOneOffs(prev => prev.filter(o => o.id !== id));
    startTransition(() => {
      deleteRetirementOneOffAction(id);
    });
  };

  const LAYERS = [
    { key: 'investments', color: '#0ea5e9', label: 'Investments' },
    { key: 'oa', color: '#3b82f6', label: 'CPF OA' },
    { key: 'sara', color: '#8b5cf6', label: 'CPF SA/RA' },
    { key: 'ma', color: '#ec4899', label: 'CPF MA' },
    { key: 'cashReserve', color: '#10b981', label: 'Cash Reserve' },
  ];

  const width = 600;
  const height = 280;
  const pTop = 20, pRight = 20, pBottom = 40, pLeft = 70;
  const plotW = width - pLeft - pRight;
  const plotH = height - pTop - pBottom;

  const xMin = projected[0]?.year || currentYear;
  const xMax = projected[projected.length - 1]?.year || currentYear + 10;
  const xRange = Math.max(1, xMax - xMin);

  let maxY = 0;
  for (const pt of projected) {
    if (pt.netWorth > maxY) maxY = pt.netWorth;
  }
  maxY = Math.max(100000, maxY * 1.1);

  const getX = (yr: number) => pLeft + ((yr - xMin) / xRange) * plotW;
  const getY = (val: number) => pTop + plotH - (val / maxY) * plotH;

  const layerPaths: { key: string; color: string; d: string }[] = [];
  const bottoms = projected.map(() => 0);

  if (chartMode === 'stacked' && projected.length > 0) {
    for (const layer of LAYERS) {
      const ptsTop = [];
      const ptsBottom = [];
      for (let i = 0; i < projected.length; i++) {
        const pt = projected[i];
        let val = 0;
        if (layer.key === 'investments') val = pt.investments;
        else if (layer.key === 'oa') val = pt.cpf.oa;
        else if (layer.key === 'sara') val = pt.cpf.sa + pt.cpf.ra;
        else if (layer.key === 'ma') val = pt.cpf.ma;
        else if (layer.key === 'cashReserve') val = Math.max(0, pt.cashReserve);
        
        const topVal = bottoms[i] + val;
        ptsTop.push({ x: getX(pt.year), y: getY(topVal) });
        ptsBottom.unshift({ x: getX(pt.year), y: getY(bottoms[i]) });
        bottoms[i] = topVal;
      }
      
      const d = `M ${ptsTop[0].x} ${ptsTop[0].y} ` +
        ptsTop.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ') + ' ' +
        ptsBottom.map(p => `L ${p.x} ${p.y}`).join(' ') + ' Z';
      
      layerPaths.push({ key: layer.key, color: layer.color, d });
    }
  }

  let netWorthD = '';
  if (chartMode === 'net-worth' && projected.length > 0) {
    const pts = projected.map(pt => ({ x: getX(pt.year), y: getY(pt.netWorth) }));
    netWorthD = `M ${pts[0].x} ${getY(0)} ` +
      pts.map(p => `L ${p.x} ${p.y}`).join(' ') +
      ` L ${pts[pts.length - 1].x} ${getY(0)} Z`;
  }

  const retYear = birthYear + settings.retirementAge;
  const payoutYear = birthYear + settings.payoutStartAge;

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || projected.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * width;
    const yearFloat = xMin + (svgX - pLeft) / plotW * xRange;
    let best = 0, bestDist = Infinity;
    projected.forEach((p, i) => {
      const d = Math.abs(p.year - yearFloat);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    setHoverIdx(bestDist < 1.5 ? best : null);
  };

  if (!cpfBalance) {
    return (
      <div className="py-12 text-center text-slate-500 bg-white rounded-xl shadow-sm border border-slate-200">
        Please add your initial CPF balances in the Expenses tab before viewing projections.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 max-w-6xl">
      {/* Settings Panel */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors">
          <div className="flex items-center gap-2 font-semibold text-slate-700"><Settings size={18} /> Projection Settings</div>
          {isSettingsOpen ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
        </button>
        {isSettingsOpen && (
          <div className="p-5 border-t border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-500">Date of Birth</label>
                <input type="month" value={settings.dob} onChange={e => setSettings(s => ({...s, dob: e.target.value}))} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 outline-none" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-500">Retirement Age</label>
                <input type="number" value={settings.retirementAge} onChange={e => setSettings(s => ({...s, retirementAge: parseInt(e.target.value) || 65}))} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 outline-none" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-500">CPF LIFE Start Age</label>
                <input type="number" min={65} max={70} value={settings.payoutStartAge} onChange={e => setSettings(s => ({...s, payoutStartAge: parseInt(e.target.value) || 65}))} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 outline-none" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-500">Gross Monthly Salary</label>
                <input type="number" placeholder={initialGrossMonthlySalary.toString()} value={settings.grossMonthlySalaryOverride ?? ''} onChange={e => setSettings(s => ({...s, grossMonthlySalaryOverride: e.target.value ? parseFloat(e.target.value) : null}))} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 outline-none" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-500">Net Monthly Cash Flow</label>
                <input type="number" placeholder={initialNetMonthlyCashFlow.toString()} value={netMonthlyCashFlowOverride ?? ''} onChange={e => setNetMonthlyCashFlowOverride(e.target.value ? parseFloat(e.target.value) : null)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 outline-none" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-500">Inflation Rate (%)</label>
                <input type="number" step="0.1" value={settings.inflationRate} onChange={e => setSettings(s => ({...s, inflationRate: parseFloat(e.target.value) || 0}))} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 outline-none" />
              </div>
            </div>
            <div className="mt-6">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Ticker Returns (Annual %)</h4>
              <div className="flex flex-wrap gap-4">
                {Object.keys(currentPortfolioByTicker).map(ticker => (
                  <div key={ticker} className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                    <label className="text-sm font-medium text-slate-700">{ticker}</label>
                    <input type="number" step="0.1" value={settings.tickerReturns[ticker] ?? 5} onChange={e => setSettings(s => ({...s, tickerReturns: {...s.tickerReturns, [ticker]: parseFloat(e.target.value) || 0}}))} className="w-16 text-right px-2 py-1 bg-white border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-emerald-500" />
                    <span className="text-slate-400 text-sm">%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mt-8 mb-2">At Age {settings.retirementAge} (Retirement)</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col"><span className="text-sm font-medium text-slate-500 mb-1">Total Net Worth</span><span className="text-2xl font-bold text-slate-800">{fmtSGD(kpiNetWorth)}</span></div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col"><span className="text-sm font-medium text-slate-500 mb-1">Investments</span><span className="text-2xl font-bold text-sky-600">{fmtSGD(kpiInvestments)}</span></div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col"><span className="text-sm font-medium text-slate-500 mb-1">Total CPF (OA+SA/RA+MA)</span><span className="text-2xl font-bold text-indigo-600">{fmtSGD(kpiCpf)}</span></div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col"><span className="text-sm font-medium text-slate-500 mb-1">Monthly CPF LIFE</span><span className="text-2xl font-bold text-emerald-600">{fmtSGD(kpiCpfLife)} <span className="text-sm font-medium text-slate-400">from {settings.payoutStartAge}</span></span></div>
      </div>

      {/* Main Chart */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col h-[400px]">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-slate-800">Projection Chart</h3>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setChartMode('net-worth')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${chartMode === 'net-worth' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Net Worth</button>
            <button onClick={() => setChartMode('stacked')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${chartMode === 'stacked' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Stacked Breakdown</button>
          </div>
        </div>
        <div className="flex-1 relative min-h-0 w-full overflow-x-auto custom-scrollbar">
          <div className="min-w-[600px] h-full relative">
            <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-full cursor-crosshair" onMouseMove={handleSvgMouseMove} onMouseLeave={() => setHoverIdx(null)}>
              {[...Array(6)].map((_, i) => (<line key={i} x1={pLeft} y1={pTop + i * (plotH / 5)} x2={width - pRight} y2={pTop + i * (plotH / 5)} stroke="#f1f5f9" strokeWidth="1" />))}
              {chartMode === 'stacked' ? layerPaths.map(layer => (<path key={layer.key} d={layer.d} fill={layer.color} opacity={0.8} className="transition-all duration-300" />)) : (<><path d={netWorthD} fill="#0ea5e9" opacity={0.15} /><path d={netWorthD.replace('Z', '').replace(/L \d+ 220.*/, '')} fill="none" stroke="#0ea5e9" strokeWidth="2" /></>)}
              <line x1={pLeft} y1={pTop + plotH} x2={width - pRight} y2={pTop + plotH} stroke="#cbd5e1" strokeWidth="1" />
              {retYear >= xMin && retYear <= xMax && (<line x1={getX(retYear)} y1={pTop} x2={getX(retYear)} y2={pTop + plotH} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 4" />)}
              {payoutYear > retYear && payoutYear >= xMin && payoutYear <= xMax && (<line x1={getX(payoutYear)} y1={pTop} x2={getX(payoutYear)} y2={pTop + plotH} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 4" />)}
              {hoverIdx !== null && projected[hoverIdx] && (
                <line x1={getX(projected[hoverIdx].year)} y1={pTop} x2={getX(projected[hoverIdx].year)} y2={pTop + plotH} stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />
              )}
            </svg>
            {hoverIdx !== null && projected[hoverIdx] && (
              <div className="absolute w-2.5 h-2.5 rounded-full bg-white border-2 border-sky-400 pointer-events-none -translate-x-1/2 -translate-y-1/2" style={{
                left: `${getX(projected[hoverIdx].year) / width * 100}%`,
                top: `${getY(projected[hoverIdx].netWorth) / height * 100}%`,
              }} />
            )}
            <div className="absolute top-[20px] bottom-[40px] left-0 w-[60px] flex flex-col justify-between text-[10px] text-slate-400 text-right pointer-events-none" style={{ height: plotH }}>
              {[...Array(6)].map((_, i) => i < 5 && (<span key={i} className="leading-none transform translate-y-[5px]">{fmtSGD(maxY * (5 - i) / 5).replace('S$', '')}</span>))}
            </div>
            <div className="absolute bottom-[20px] left-[70px] right-[20px] text-[10px] text-slate-400 pointer-events-none" style={{ height: 16 }}>
              {[0, 0.25, 0.5, 0.75, 1].map(pct => (
                <span key={pct} style={{ position: 'absolute', left: `${pct * 100}%`, transform: pct === 0 ? 'none' : pct === 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}>
                  {Math.round(xMin + pct * xRange)}
                </span>
              ))}
            </div>
            {payoutYear > retYear && payoutYear >= xMin && payoutYear <= xMax && (<div className="absolute top-[0px] text-[10px] font-semibold text-slate-500 bg-white/80 px-1 rounded" style={{ left: getX(payoutYear), transform: 'translateX(-50%)' }}>CPF LIFE</div>)}
            {hoverIdx !== null && projected[hoverIdx] && (() => {
              const pt = projected[hoverIdx];
              const xPct = (getX(pt.year) / width) * 100;
              const onRight = xPct < 55;
              const expYear = yearlyExpenseProjections[pt.year];
              const annualIncome = expYear?.income ?? 0;
              const annualExpenses = expYear?.expenses ?? 0;
              return (
                <div className="absolute top-[20px] z-10 bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs pointer-events-none w-52"
                  style={{ ...(onRight ? { left: `calc(${xPct}% + 10px)` } : { right: `calc(${100 - xPct}% + 10px)` }) }}>
                  <div className="font-semibold text-slate-700 mb-2">{pt.year} · Age {pt.age}</div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-slate-500"><span>Income</span><span className="font-medium text-slate-700">{fmtSGD(annualIncome)}</span></div>
                    <div className="flex justify-between text-slate-500"><span>Expenses</span><span className="font-medium text-slate-700">−{fmtSGD(annualExpenses)}</span></div>
                    {(pt.cpf.cpfLifeMonthlyPayout ?? 0) > 0 && <div className="flex justify-between text-slate-500"><span>CPF LIFE</span><span className="font-medium text-slate-700">+{fmtSGD((pt.cpf.cpfLifeMonthlyPayout ?? 0) * 12)}/yr</span></div>}
                    <div className="border-t border-slate-100 pt-1 mt-1 space-y-1">
                      <div className="flex justify-between"><span style={{ color: '#0ea5e9' }}>Investments</span><span className="font-medium text-slate-700">{fmtSGD(pt.investments)}</span></div>
                      <div className="flex justify-between"><span style={{ color: '#3b82f6' }}>CPF OA</span><span className="font-medium text-slate-700">{fmtSGD(pt.cpf.oa)}</span></div>
                      <div className="flex justify-between"><span style={{ color: '#8b5cf6' }}>CPF SA/RA</span><span className="font-medium text-slate-700">{fmtSGD(pt.cpf.sa + pt.cpf.ra)}</span></div>
                      <div className="flex justify-between"><span style={{ color: '#ec4899' }}>CPF MA</span><span className="font-medium text-slate-700">{fmtSGD(pt.cpf.ma)}</span></div>
                      {pt.cashReserve !== 0 && <div className="flex justify-between"><span style={{ color: '#10b981' }}>Cash Reserve</span><span className="font-medium text-slate-700">{fmtSGD(pt.cashReserve)}</span></div>}
                    </div>
                    <div className="border-t border-slate-100 pt-1 mt-1 flex justify-between font-semibold text-slate-800"><span>Net Worth</span><span>{fmtSGD(pt.netWorth)}</span></div>
                    {pt.oneOffExpenses > 0 && <div className="flex justify-between text-red-500"><span>One-offs</span><span>−{fmtSGD(pt.oneOffExpenses)}</span></div>}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
        {chartMode === 'stacked' && (
          <div className="flex flex-wrap items-center justify-center gap-4 mt-4 pt-4 border-t border-slate-100">
            {LAYERS.map(l => (<div key={l.key} className="flex items-center gap-1.5 text-xs text-slate-600 font-medium"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: l.color, opacity: 0.8 }}></div>{l.label}</div>))}
          </div>
        )}
      </div>

      {/* One-offs */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mt-8">
        <h3 className="font-semibold text-slate-800 mb-4">One-off Expenses</h3>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 px-3 font-medium text-slate-500">Year</th>
                <th className="py-2 px-3 font-medium text-slate-500">Description</th>
                <th className="py-2 px-3 font-medium text-slate-500 text-right">Today's $</th>
                <th className="py-2 px-3 font-medium text-slate-500 text-right">Projected</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {localOneOffs.length === 0 ? (
                <tr><td colSpan={5} className="py-4 text-center text-slate-400 italic">No one-off expenses recorded.</td></tr>
              ) : (
                localOneOffs.map(o => {
                  const projected = o.inTodaysPrices
                    ? o.amountSGD * Math.pow(1 + settings.inflationRate / 100, o.year - currentYear)
                    : o.amountSGD;
                  return (
                    <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-700">{o.year}</td>
                      <td className="py-2 px-3 text-slate-700">{o.description}</td>
                      <td className="py-2 px-3 text-right font-medium text-slate-800">
                        {o.inTodaysPrices ? fmtSGD(o.amountSGD) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-slate-800">
                        {o.inTodaysPrices
                          ? <span className="text-slate-500">{fmtSGD(projected)}</span>
                          : fmtSGD(projected)}
                      </td>
                      <td className="py-2 px-3 text-right"><button onClick={() => handleDeleteOneOff(o.id)} disabled={isPending} className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"><Trash2 size={16} /></button></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 flex-wrap">
          <input type="number" value={newOneOffYear} onChange={e => setNewOneOffYear(e.target.value)} placeholder="Year" className="w-24 px-3 py-1.5 border border-slate-300 bg-white rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 outline-none" />
          <input type="text" value={newOneOffDesc} onChange={e => setNewOneOffDesc(e.target.value)} placeholder="Description (e.g. Renovation)" className="flex-1 min-w-[150px] px-3 py-1.5 border border-slate-300 bg-white rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 outline-none" />
          <input type="number" value={newOneOffAmt} onChange={e => setNewOneOffAmt(e.target.value)} placeholder="Amount (today's $)" className="w-36 px-3 py-1.5 border border-slate-300 bg-white rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 outline-none" />
          <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer select-none">
            <input type="checkbox" checked={newOneOffInTodaysPrices} onChange={e => setNewOneOffInTodaysPrices(e.target.checked)} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            Today's prices
          </label>
          <button onClick={handleAddOneOff} disabled={isPending || !newOneOffYear || !newOneOffDesc || !newOneOffAmt} className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"><Plus size={16} /> Add</button>
        </div>
      </div>
    </div>
  );
}