export const dynamic = 'force-dynamic';

import CashForm from '@/components/cash-form';
import { getCash } from '@/lib/google-sheets';
import { upsertCashAccountAction, deleteCashAccountAction, renameCashAccountAction } from '@/app/lib/actions';

export default async function CashPage() {
  const cash = await getCash();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Cash Balances</h1>
      <CashForm
        accounts={cash.accounts}
        upsertAction={upsertCashAccountAction}
        deleteAction={deleteCashAccountAction}
        renameAction={renameCashAccountAction}
      />
    </div>
  );
}
