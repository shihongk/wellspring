export const dynamic = 'force-dynamic';

import { google } from 'googleapis';

export async function POST(request: Request) {
  try {
    const { spreadsheetId, serviceAccountEmail, privateKey } = await request.json();

    if (!spreadsheetId || !serviceAccountEmail || !privateKey) {
      return Response.json({ error: 'All fields are required.' }, { status: 400 });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: serviceAccountEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Just fetch spreadsheet metadata — lightweight, proves auth + access
    const res = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetNames = res.data.sheets?.map((s) => s.properties?.title) ?? [];

    const required = ['Holdings', 'Cash', 'Transactions', 'MonthlyPlan', 'FxRates'];
    const missing = required.filter((name) => !sheetNames.includes(name));

    return Response.json({
      success: true,
      title: res.data.properties?.title ?? 'Untitled',
      sheetNames,
      missingTabs: missing,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 400 });
  }
}
