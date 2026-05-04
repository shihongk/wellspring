export const dynamic = 'force-dynamic';

import { google } from 'googleapis';

export async function POST(): Promise<Response> {
  try {
    const { GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY } = process.env;

    if (!GOOGLE_SHEETS_SPREADSHEET_ID || !GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
      return Response.json({ error: 'Missing Google Sheets credentials.' }, { status: 400 });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = GOOGLE_SHEETS_SPREADSHEET_ID;

    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const existing = meta.data.sheets?.map(s => s.properties?.title ?? '') ?? [];

    if (existing.includes('ExpenseProjections')) {
      return Response.json({ alreadyExists: true });
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: 'ExpenseProjections' } } }] },
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'ExpenseProjections!A1',
      valueInputOption: 'RAW',
      requestBody: { values: [['month', 'category', 'amount']] },
    });

    return Response.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
