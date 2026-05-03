import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env.local') });

import { google } from 'googleapis';

const TABS = [
  {
    title: 'Expenses',
    headers: ['id', 'date', 'post_date', 'description', 'amount', 'direction', 'balance', 'account', 'category', 'source_file', 'imported_at'],
  },
  {
    title: 'ExpenseRules',
    headers: ['merchant', 'category'],
  },
];

async function run() {
  const { GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY } = process.env;

  if (!GOOGLE_SHEETS_SPREADSHEET_ID || !GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    console.error('Missing Google Sheets credentials in .env.local');
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  const meta = await sheets.spreadsheets.get({ spreadsheetId: GOOGLE_SHEETS_SPREADSHEET_ID });
  const existing = meta.data.sheets?.map((s) => s.properties?.title ?? '') ?? [];

  for (const tab of TABS) {
    if (existing.includes(tab.title)) {
      console.log(`Skipped: ${tab.title} (already exists)`);
      continue;
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: GOOGLE_SHEETS_SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: tab.title } } }] },
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SHEETS_SPREADSHEET_ID,
      range: `${tab.title}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [tab.headers] },
    });

    console.log(`Created: ${tab.title}`);
  }
}

run().catch((err) => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
