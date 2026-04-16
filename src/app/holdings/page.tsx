export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getHoldings } from '@/lib/google-sheets';
import { deleteHoldingAction } from '@/app/lib/actions';
import { formatShares } from '@/lib/fx';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default async function HoldingsPage() {
  const holdings = await getHoldings();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Holdings</h1>
        <Link href="/holdings/new">
          <Button variant="primary">Add Holding</Button>
        </Link>
      </div>

      {holdings.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          No holdings found. Add your first holding.
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-700 border-b">
              <tr>
                <th className="px-4 py-3 font-semibold">Ticker</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold text-right">Shares</th>
                <th className="px-4 py-3 font-semibold text-right">Avg Cost</th>
                <th className="px-4 py-3 font-semibold">Currency</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {holdings.map((h) => (
                <tr key={h.ticker} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{h.ticker}</td>
                  <td className="px-4 py-3">{h.name}</td>
                  <td className="px-4 py-3 text-right">{formatShares(h.shares)}</td>
                  <td className="px-4 py-3 text-right">{h.avgCostLocal.toFixed(4)}</td>
                  <td className="px-4 py-3 text-gray-500">{h.currency}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <Link href={`/holdings/${h.ticker}`}>
                        <Button variant="secondary" className="text-xs py-1 px-2">Edit</Button>
                      </Link>
                      <form action={deleteHoldingAction.bind(null, h.ticker)}>
                        <Button type="submit" variant="danger" className="text-xs py-1 px-2">Delete</Button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
