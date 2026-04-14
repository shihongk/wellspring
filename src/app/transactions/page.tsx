export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getTransactions } from '@/lib/google-sheets';
import { formatShares, formatDate } from '@/lib/fx';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default async function TransactionsPage() {
  const transactions = await getTransactions();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <Link href="/transactions/new">
          <Button variant="primary">Log Transaction</Button>
        </Link>
      </div>

      {transactions.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          No transactions found. Log your first trade.
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-700 border-b">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Ticker</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold text-right">Shares</th>
                <th className="px-4 py-3 font-semibold text-right">Price</th>
                <th className="px-4 py-3 font-semibold">Currency</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(t.date)}</td>
                  <td className="px-4 py-3 font-medium">{t.ticker}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        t.type === 'BUY'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {t.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{formatShares(t.shares)}</td>
                  <td className="px-4 py-3 text-right">{t.priceLocal.toFixed(4)}</td>
                  <td className="px-4 py-3 text-gray-500">{t.currency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
