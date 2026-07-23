export const dynamic = 'force-dynamic';

import CashForm from '@/components/cash-form';
import MarginForm from '@/components/margin-form';
import { getCash, getMargin } from '@/lib/google-sheets';
import { upsertCashAccountAction, deleteCashAccountAction, renameCashAccountAction, repayMarginAction } from '@/app/lib/actions';

export default async function CashPage() {
  const [cash, margin] = await Promise.all([getCash(), getMargin()]);
  const outstandingSGD = margin.accounts.find((a) => a.account === 'Default')?.outstandingSGD ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Cash Balances</h1>
      <CashForm
        accounts={cash.accounts}
        upsertAction={upsertCashAccountAction}
        deleteAction={deleteCashAccountAction}
        renameAction={renameCashAccountAction}
      />
      <MarginForm
        outstandingSGD={outstandingSGD}
        cashAccounts={cash.accounts.map((a) => a.account)}
        repayAction={repayMarginAction}
      />
    </div>
  );
}
