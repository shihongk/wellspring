import { getExpenses, getExpenseRules, getProjectionOverrides } from '@/lib/expenses/sheets';
import { getLatestCpfBalance, getCpfTransactions } from '@/lib/retirement/sheets';
import { deriveGrossMonthlySalary } from '@/lib/retirement/salary';
import { ExpensesClient } from '@/components/expenses/ExpensesClient';

export const dynamic = 'force-dynamic';

export default async function ExpensesPage() {
  const [transactions, rules, overrides, cpfBalance, cpfTransactions] = await Promise.all([
    getExpenses(), getExpenseRules(), getProjectionOverrides(), getLatestCpfBalance(), getCpfTransactions()
  ]);

  const userAge = new Date().getFullYear() - 1984;
  const derivedGrossMonthlySalary = deriveGrossMonthlySalary(cpfTransactions, userAge);

  return (
    <main className="ml-48 p-8 min-h-screen" style={{ backgroundColor: '#f0f9ff' }}>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Expenses</h1>
      <ExpensesClient
        transactions={transactions}
        rules={rules}
        overrides={overrides}
        cpfBalance={cpfBalance}
        cpfTransactions={cpfTransactions}
        userAge={userAge}
        grossMonthlySalary={derivedGrossMonthlySalary ?? 9000}
      />
    </main>
  );
}