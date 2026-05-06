export const dynamic = 'force-dynamic';

import { google } from 'googleapis';

const NEW_TABS = [
  { title: 'CpfBalances',       headers: ['date', 'oa', 'sa', 'ma'] },
  { title: 'RetirementOneOffs', headers: ['id', 'year', 'description', 'amount_sgd'] },
];

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

    const created: string[] = [];
    const skipped: string[] = [];

    for (const tab of NEW_TABS) {
      if (existing.includes(tab.title)) {
        skipped.push(tab.title);
        continue;
      }

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: tab.title } } }] },
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tab.title}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [tab.headers] },
      });

      created.push(tab.title);
    }

    return Response.json({ created, skipped });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
