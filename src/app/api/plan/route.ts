export const dynamic = 'force-dynamic';

import { getMonthlyPlan, replaceMonthlyPlan } from '@/lib/google-sheets';
import { MonthlyPlanRow } from '@/types';

export async function GET() {
  try {
    const plan = await getMonthlyPlan();
    return Response.json(plan);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as { plan: MonthlyPlanRow[] };
    if (!Array.isArray(body.plan)) {
      return Response.json({ error: 'body.plan must be an array' }, { status: 400 });
    }
    await replaceMonthlyPlan(body.plan);
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
