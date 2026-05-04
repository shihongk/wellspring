export const dynamic = 'force-dynamic';

import { getExpenses, getExpenseRules, getProjectionOverrides } from '@/lib/expenses/sheets';
import { ExpensesClient } from '@/components/expenses/ExpensesClient';

export default async function ExpensesPage() {
  const [transactions, rules, overrides] = await Promise.all([
    getExpenses(), getExpenseRules(), getProjectionOverrides(),
  ]);
  return (
    <main className="ml-48 p-8 min-h-screen" style={{ backgroundColor: '#f0f9ff' }}>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Expenses</h1>
      <ExpensesClient transactions={transactions} rules={rules} overrides={overrides} />
    </main>
  );
}
