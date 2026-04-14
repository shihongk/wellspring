export const dynamic = 'force-dynamic';

import { writeFile } from 'fs/promises';
import { join } from 'path';

export async function POST(request: Request) {
  try {
    const { spreadsheetId, serviceAccountEmail, privateKey } = await request.json();

    if (!spreadsheetId || !serviceAccountEmail || !privateKey) {
      return Response.json({ error: 'All fields are required.' }, { status: 400 });
    }

    // Normalise the private key: accept both literal \n and real newlines,
    // then store as literal \n inside double-quoted value so Next.js loads it correctly.
    const normalisedKey = privateKey
      .replace(/\\n/g, '\n')   // expand any escaped newlines first
      .replace(/\n/g, '\\n');  // then re-encode as literal \n for .env.local

    const envContent = [
      `GOOGLE_SHEETS_SPREADSHEET_ID="${spreadsheetId}"`,
      `GOOGLE_SERVICE_ACCOUNT_EMAIL="${serviceAccountEmail}"`,
      `GOOGLE_PRIVATE_KEY="${normalisedKey}"`,
      '',
    ].join('\n');

    const envPath = join(process.cwd(), '.env.local');
    await writeFile(envPath, envContent, 'utf-8');

    return Response.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
