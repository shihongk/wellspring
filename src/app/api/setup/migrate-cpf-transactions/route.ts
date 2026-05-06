export const dynamic = 'force-dynamic';

import { google } from 'googleapis';

const TAB = { title: 'CpfTransactions', headers: ['date', 'code', 'ref', 'oa_change', 'sa_change', 'ma_change'] };

export async function POST(_request: Request) {
  try {
    const {
      GOOGLE_SHEETS_SPREADSHEET_ID: spreadsheetId,
      GOOGLE_SERVICE_ACCOUNT_EMAIL: serviceAccountEmail,
      GOOGLE_PRIVATE_KEY: privateKey,
    } = process.env;

    if (!spreadsheetId || !serviceAccountEmail || !privateKey) {
      return Response.json({ error: 'Missing Google Sheets credentials.' }, { status: 400 });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: serviceAccountEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const existing = meta.data.sheets?.map(s => s.properties?.title ?? '') ?? [];

    if (existing.includes(TAB.title)) {
      return Response.json({ created: [], skipped: [TAB.title] });
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: TAB.title } } }] },
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${TAB.title}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [TAB.headers] },
    });

    return Response.json({ created: [TAB.title], skipped: [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
