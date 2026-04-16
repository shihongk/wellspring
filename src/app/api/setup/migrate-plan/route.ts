export const dynamic = 'force-dynamic';

import { google } from 'googleapis';

function getAuth(body: Record<string, string>) {
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

const NEW_TABS = [
  { title: 'TargetAllocation',   headers: ['ticker', 'target_pct'] },
  { title: 'InvestmentSchedule', headers: ['month', 'ticker', 'name', 'planned_sgd'] },
];

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { sheets, spreadsheetId } = getAuth(body);

    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const existing = meta.data.sheets?.map((s) => s.properties?.title ?? '') ?? [];

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

    return Response.json({ success: true, created, skipped });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 400 });
  }
}
