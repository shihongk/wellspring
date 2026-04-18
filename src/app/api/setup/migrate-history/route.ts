export const dynamic = 'force-dynamic';

import { google } from 'googleapis';

const TAB = { title: 'PortfolioHistory', headers: ['date', 'total_value_sgd', 'fx_usdsgd', 'fx_hkdsgd', 'recorded_at'] };

export async function POST() {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!spreadsheetId || !serviceAccountEmail || !privateKey) {
      return Response.json({ error: 'Google Sheets credentials are not configured. Complete setup first.' }, { status: 400 });
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
    const existing = meta.data.sheets?.map((s) => s.properties?.title ?? '') ?? [];

    if (existing.includes(TAB.title)) {
      return Response.json({ alreadyExists: true });
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: TAB.title } } }],
      },
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${TAB.title}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [TAB.headers] },
    });

    return Response.json({ success: true, created: [TAB.title] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 400 });
  }
}
