export const dynamic = 'force-dynamic';

import TransactionForm from '@/components/transaction-form';
import { logTransactionAction } from '@/app/lib/actions';

export default function NewTransactionPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Log Transaction</h1>
      <TransactionForm action={logTransactionAction} />
    </div>
  );
}
