import type { ExpenseTransaction, BalanceContinuityIssue } from '@/types';

const TOLERANCE = 0.005;

export function validateBalanceContinuity(txs: ExpenseTransaction[]): BalanceContinuityIssue[] {
  const byAccount = new Map<string, ExpenseTransaction[]>();
  for (const tx of txs) {
    if (tx.balance == null) continue;
    const list = byAccount.get(tx.account);
    if (list) list.push(tx);
    else byAccount.set(tx.account, [tx]);
  }

  const issues: BalanceContinuityIssue[] = [];
  for (const [account, accountTxs] of byAccount) {
    // Stable sort preserves original (statement) order for same-date rows.
    const ordered = [...accountTxs].sort((a, b) => a.date.localeCompare(b.date));

    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1];
      const curr = ordered[i];
      const expected = curr.direction === 'credit'
        ? prev.balance! + curr.amount
        : prev.balance! - curr.amount;

      if (Math.abs(expected - curr.balance!) > TOLERANCE) {
        issues.push({
          account,
          id: curr.id,
          date: curr.date,
          description: curr.description,
          expectedBalance: expected,
          actualBalance: curr.balance!,
          prevId: prev.id,
        });
      }
    }
  }

  return issues;
}
