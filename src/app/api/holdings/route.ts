export const dynamic = 'force-dynamic';

import { getHoldings, upsertHolding } from '@/lib/google-sheets';
import { Holding } from '@/types';

export async function GET() {
  try {
    const holdings = await getHoldings();
    return Response.json(holdings);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Partial<Holding>;
    if (!body.ticker || !body.name || body.shares == null || body.avgCostLocal == null || !body.currency) {
      return Response.json({ error: 'Missing required fields: ticker, name, shares, avgCostLocal, currency' }, { status: 400 });
    }
    await upsertHolding(body as Holding);
    return Response.json({ success: true, ticker: body.ticker });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
