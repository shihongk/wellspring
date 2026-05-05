import type { ExpenseTransaction, ExpenseProjectionOverride, InflationSettings, CategoryProjectionSetting } from '@/types';

export const INCOME_CATEGORIES = ['Salary', 'Interest', 'Other Income', 'Income'];
const INCOME_CATS = new Set(INCOME_CATEGORIES);
const EXCLUDED_FROM_BASELINE = new Set(['Transfer', 'Investment']);

export interface ProjectionRow {
  month: string;    // YYYY-MM
  category: string;
  amount: number;
}

export interface CashFlowSummary {
  next1M: number;
  next3M: number;
  next6M: number;
  next12M: number;
}

function monthsBetween(startMonth: string, endMonth: string): number {
  const [sy, sm] = startMonth.split('-').map(Number);
  const [ey, em] = endMonth.split('-').map(Number);
  return (ey - sy) * 12 + (em - sm);
}

function subtractMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 - n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function computeBaselineAverages(
  transactions: ExpenseTransaction[],
  startMonth: string,
  endMonth: string,
  categoryModes: Record<string, CategoryProjectionSetting> = {},
): Record<string, number> {
  const totalRollingMonths = monthsBetween(startMonth, endMonth) + 1;
  const annualStart = subtractMonths(endMonth, 11);
  const semiannualStart = subtractMonths(endMonth, 5);

  const rollingSums: Record<string, number> = {};
  const annualSums: Record<string, number> = {};
  const semiannualSums: Record<string, number> = {};
  const monthlyTotals: Record<string, Record<string, number>> = {};

  for (const tx of transactions) {
    const txMonth = tx.date.slice(0, 7);
    if (tx.excluded || tx.oneOff) continue;
    if (EXCLUDED_FROM_BASELINE.has(tx.category)) continue;

    const isIncome = INCOME_CATS.has(tx.category);
    if (isIncome && tx.direction !== 'credit') continue;
    if (!isIncome && tx.direction !== 'debit') continue;

    if (txMonth <= endMonth) {
      if (!monthlyTotals[tx.category]) monthlyTotals[tx.category] = {};
      monthlyTotals[tx.category][txMonth] = (monthlyTotals[tx.category][txMonth] ?? 0) + tx.amount;
    }
    if (txMonth >= startMonth && txMonth <= endMonth) {
      rollingSums[tx.category] = (rollingSums[tx.category] ?? 0) + tx.amount;
    }
    if (txMonth >= annualStart && txMonth <= endMonth) {
      annualSums[tx.category] = (annualSums[tx.category] ?? 0) + tx.amount;
    }
    if (txMonth >= semiannualStart && txMonth <= endMonth) {
      semiannualSums[tx.category] = (semiannualSums[tx.category] ?? 0) + tx.amount;
    }
  }

  const allCategories = new Set([
    ...Object.keys(rollingSums),
    ...Object.keys(annualSums),
    ...Object.keys(semiannualSums),
    ...Object.keys(monthlyTotals),
  ]);

  const averages: Record<string, number> = {};
  for (const cat of allCategories) {
    const mode = categoryModes[cat]?.mode ?? 'rolling';

    if (mode === 'fixed') {
      const amt = categoryModes[cat]?.fixedAmount;
      if (amt !== undefined && amt > 0) averages[cat] = amt;
      continue;
    }
    if (mode === 'annual') {
      if (annualSums[cat] !== undefined) averages[cat] = annualSums[cat] / 12;
      continue;
    }
    if (mode === 'semiannual') {
      if (semiannualSums[cat] !== undefined) averages[cat] = semiannualSums[cat] / 6;
      continue;
    }
    if (mode === 'latest') {
      const months = Object.keys(monthlyTotals[cat] ?? {}).sort();
      if (months.length > 0) averages[cat] = monthlyTotals[cat][months[months.length - 1]];
      continue;
    }
    // rolling (default)
    if (rollingSums[cat] !== undefined) averages[cat] = rollingSums[cat] / totalRollingMonths;
  }

  return averages;
}

export function generateProjections(
  baselineAverages: Record<string, number>,
  overrides: ExpenseProjectionOverride[],
  targetMonths: string[],
  inflationSettings: InflationSettings,
): ProjectionRow[] {
  if (targetMonths.length === 0) return [];

  const firstYear = parseInt(targetMonths[0].slice(0, 4));
  const overrideMap = new Map(overrides.map(o => [`${o.month}|${o.category}`, o.amount]));

  const rows: ProjectionRow[] = [];
  for (const month of targetMonths) {
    const year = parseInt(month.slice(0, 4));
    const yearsAhead = year - firstYear;

    for (const [category, baselineAvg] of Object.entries(baselineAverages)) {
      const key = `${month}|${category}`;
      if (overrideMap.has(key)) {
        rows.push({ month, category, amount: overrideMap.get(key)! });
      } else {
        const isIncome = INCOME_CATS.has(category);
        const rate = isIncome
          ? inflationSettings.incomeGrowthRate / 100
          : inflationSettings.expenseInflationRate / 100;
        const factor = Math.pow(1 + rate, yearsAhead);
        rows.push({ month, category, amount: baselineAvg * factor });
      }
    }
  }
  return rows;
}

export function aggregateCashFlow(
  projections: ProjectionRow[],
  incomeCategories: string[],
): CashFlowSummary {
  const incomeCatSet = new Set<string>(incomeCategories);
  const months = [...new Set(projections.map(p => p.month))].sort();

  function netForMonths(count: number): number {
    const target = new Set(months.slice(0, count));
    let income = 0;
    let expense = 0;
    for (const p of projections) {
      if (!target.has(p.month)) continue;
      if (incomeCatSet.has(p.category)) {
        income += p.amount;
      } else {
        expense += p.amount;
      }
    }
    return income - expense;
  }

  return {
    next1M: netForMonths(1),
    next3M: netForMonths(3),
    next6M: netForMonths(6),
    next12M: netForMonths(12),
  };
}
