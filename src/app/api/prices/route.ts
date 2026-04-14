export const dynamic = 'force-dynamic';

import { fetchPricesAndFx } from '@/lib/yahoo-finance';

export async function GET() {
  try {
    const result = await fetchPricesAndFx();
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
