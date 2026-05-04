import type { ExpenseTransaction, ExpenseProjectionOverride, InflationSettings } from '@/types';

export const INCOME_CATEGORIES = ['Salary', 'Interest', 'Other Income', 'Income'];
const INCOME_CATS = new Set(INCOME_CATEGORIES);
const EXCLUDED_FROM_BASELINE = new Set(['Transfer', 'Investment']);

export interface ProjectionRow {
  month: string;    // YYYY-MM
  category: string;
  amount: number;
}

export interface CashFlowSummary {
  next3M: number;
  next6M: number;
  next12M: number;
}

function monthsBetween(startMonth: string, endMonth: string): number {
  const [sy, sm] = startMonth.split('-').map(Number);
  const [ey, em] = endMonth.split('-').map(Number);
  return (ey - sy) * 12 + (em - sm);
}

export function computeBaselineAverages(
  transactions: ExpenseTransaction[],
  startMonth: string,
  endMonth: string,
): Record<string, number> {
  const totalMonths = monthsBetween(startMonth, endMonth) + 1;
  const sums: Record<string, number> = {};

  for (const tx of transactions) {
    const txMonth = tx.date.slice(0, 7);
    if (txMonth < startMonth || txMonth > endMonth) continue;
    if (tx.excluded || tx.oneOff) continue;
    if (EXCLUDED_FROM_BASELINE.has(tx.category)) continue;

    const isIncome = INCOME_CATS.has(tx.category);
    if (isIncome && tx.direction !== 'credit') continue;
    if (!isIncome && tx.direction !== 'debit') continue;

    sums[tx.category] = (sums[tx.category] ?? 0) + tx.amount;
  }

  const averages: Record<string, number> = {};
  for (const [cat, sum] of Object.entries(sums)) {
    averages[cat] = sum / totalMonths;
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
    next3M: netForMonths(3),
    next6M: netForMonths(6),
    next12M: netForMonths(12),
  };
}
