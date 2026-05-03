export const dynamic = 'force-dynamic';

import { importStatements } from '@/lib/expenses/pipeline';

export async function POST(request: Request) {
  const { folder } = await request.json();

  if (!folder) {
    return Response.json({ error: 'No folder specified' }, { status: 400 });
  }

  try {
    const result = await importStatements(folder);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
