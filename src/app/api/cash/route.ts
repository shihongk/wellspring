export const dynamic = 'force-dynamic';

import { getCash, updateCash } from '@/lib/google-sheets';

export async function GET() {
  try {
    const cash = await getCash();
    return Response.json(cash);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    if (body.amount == null || typeof body.amount !== 'number' || body.amount < 0) {
      return Response.json({ error: 'amount must be a non-negative number' }, { status: 400 });
    }
    await updateCash(body.amount);
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
