export const dynamic = 'force-dynamic';

import { getTargetAllocations, replaceTargetAllocations } from '@/lib/google-sheets';
import { TargetAllocationRow } from '@/types';

export async function GET() {
  try {
    const allocations = await getTargetAllocations();
    return Response.json(allocations);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as { allocations: TargetAllocationRow[] };
    if (!Array.isArray(body.allocations)) {
      return Response.json({ error: 'body.allocations must be an array' }, { status: 400 });
    }
    await replaceTargetAllocations(body.allocations);
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
