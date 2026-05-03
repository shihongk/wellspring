export const dynamic = 'force-dynamic';

import { google } from 'googleapis';

const TABS = [
  { title: 'Holdings',     headers: ['ticker', 'name', 'shares', 'avg_cost_local', 'currency'] },
  { title: 'Cash',         headers: ['account', 'currency', 'amount'] },
  { title: 'Transactions', headers: ['id', 'date', 'ticker', 'type', 'shares', 'price_local', 'currency'] },
  { title: 'TargetAllocation',   headers: ['ticker', 'target_pct'] },
  { title: 'InvestmentSchedule', headers: ['month', 'ticker', 'name', 'planned_sgd'] },
  { title: 'FxRates',            headers: ['pair', 'rate', 'fetched_at'] },
  { title: 'PortfolioHistory',   headers: ['date', 'total_value_sgd', 'fx_usdsgd', 'fx_hkdsgd', 'recorded_at'] },
  { title: 'Expenses',     headers: ['id', 'date', 'post_date', 'description', 'amount', 'direction', 'balance', 'account', 'category', 'source_file', 'imported_at', 'excluded'] },
  { title: 'ExpenseRules', headers: ['merchant', 'category'] },
];

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

    // Get existing sheets
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const existing = meta.data.sheets?.map((s) => s.properties?.title ?? '') ?? [];

    const created: string[] = [];
    const skipped: string[] = [];

    for (const tab of TABS) {
      if (existing.includes(tab.title)) {
        skipped.push(tab.title);
        continue;
      }

      // Add the sheet tab
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: tab.title } } }],
        },
      });

      // Write the header row
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tab.title}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [tab.headers] },
      });

      created.push(tab.title);
    }

    // Seed Cash tab with a Default SGD row if it was just created
    if (created.includes('Cash')) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Cash!A2',
        valueInputOption: 'RAW',
        requestBody: { values: [['Default', 'SGD', '0']] },
      });
    }

    return Response.json({ success: true, created, skipped });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 400 });
  }
}
