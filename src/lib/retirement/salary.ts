import { CpfTransaction } from '@/types';
import { getCpfContributionRate } from './cpf';

export function deriveGrossMonthlySalary(cpfTransactions: CpfTransaction[], userAge: number): number | null {
  const conRows = cpfTransactions.filter(t => t.code === 'CON');
  if (conRows.length === 0) return null;

  const byMonth = new Map<string, number>();
  for (const t of conRows) {
    const month = t.date.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + t.oaChange + t.saChange + t.maChange);
  }

  // Median over recent months, not the latest month — a bonus/AWS month carries extra
  // CON contributions that would overstate the steady-state salary.
  const recentMonths = [...byMonth.keys()].sort().slice(-6);
  const totals = recentMonths.map(m => byMonth.get(m)!).sort((a, b) => a - b);
  const mid = Math.floor(totals.length / 2);
  const monthlyContribution = totals.length % 2 === 1
    ? totals[mid]
    : (totals[mid - 1] + totals[mid]) / 2;
  const { total } = getCpfContributionRate(userAge);

  // Dividing by the contribution rate recovers a salary that is itself ceiling-capped
  // (CON contributions are already capped at the CPF salary ceiling). That's fine here —
  // the projection only uses gross salary to compute CPF contributions, which apply the
  // same ceiling anyway.
  return Math.round(monthlyContribution / total);
}
