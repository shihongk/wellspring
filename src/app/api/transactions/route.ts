export const dynamic = 'force-dynamic';

import { getTransactions, appendTransaction } from '@/lib/google-sheets';
import { Transaction } from '@/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker') ?? undefined;
    const transactions = await getTransactions(ticker);
    return Response.json(transactions);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Partial<Omit<Transaction, 'id'>>;
    if (!body.date || !body.ticker || !body.type || body.shares == null || body.priceLocal == null || !body.currency) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const id = await appendTransaction(body as Omit<Transaction, 'id'>);
    return Response.json({ success: true, id });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
