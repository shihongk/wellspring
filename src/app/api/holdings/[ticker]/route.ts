export const dynamic = 'force-dynamic';

import { getHoldings, upsertHolding, deleteHolding } from '@/lib/google-sheets';

export async function GET(_req: Request, { params }: { params: Promise<{ ticker: string }> }) {
  try {
    const { ticker } = await params;
    const holdings = await getHoldings();
    const holding = holdings.find((h) => h.ticker === ticker);
    if (!holding) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(holding);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ ticker: string }> }) {
  try {
    const { ticker } = await params;
    const holdings = await getHoldings();
    const existing = holdings.find((h) => h.ticker === ticker);
    if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });
    const body = await request.json();
    await upsertHolding({ ...existing, ...body, ticker });
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ ticker: string }> }) {
  try {
    const { ticker } = await params;
    const holdings = await getHoldings();
    const existing = holdings.find((h) => h.ticker === ticker);
    if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });
    await deleteHolding(ticker);
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
