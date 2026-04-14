export const dynamic = 'force-dynamic';

import { google } from 'googleapis';

function getAuth(body: Record<string, string>) {
  // Prefer body params (setup flow), fall back to saved env vars
  const spreadsheetId = body.spreadsheetId || process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '';
  const serviceAccountEmail = body.serviceAccountEmail || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  const privateKey = (body.privateKey || process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (!spreadsheetId || !serviceAccountEmail || !privateKey) {
    throw new Error('No credentials available. Fill in the form above or ensure .env.local is configured.');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: serviceAccountEmail, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return { sheets: google.sheets({ version: 'v4', auth }), spreadsheetId };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { sheets, spreadsheetId } = getAuth(body);

    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Cash!A:C' });
    const rows = res.data.values ?? [];

    if (rows.length === 0) {
      return Response.json({ error: 'Cash tab is empty.' }, { status: 400 });
    }

    if (rows[0]?.[0] === 'account') {
      return Response.json({ alreadyMigrated: true });
    }

    const dataRows = rows.slice(1);
    const newData: string[][] = dataRows
      .filter((r) => r[0] === 'SGD')
      .map((r) => ['Default', 'SGD', r[1] ?? '0']);

    await sheets.spreadsheets.values.clear({ spreadsheetId, range: 'Cash!A:C' });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Cash!A1',
      valueInputOption: 'RAW',
      requestBody: { values: [['account', 'currency', 'amount'], ...newData] },
    });

    return Response.json({ success: true, migratedRows: newData.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 400 });
  }
}
