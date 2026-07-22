export const dynamic = 'force-dynamic';

import { getExpenses } from '@/lib/expenses/sheets';
import { validateBalanceContinuity } from '@/lib/expenses/validate';

export async function GET() {
  try {
    const txs = await getExpenses();
    const issues = validateBalanceContinuity(txs);
    return Response.json({ issues });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
