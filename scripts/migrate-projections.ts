import { config } from 'dotenv';
import { resolve } from 'path';
import { google } from 'googleapis';

config({ path: resolve(__dirname, '../.env.local') });

async function main() {
  const { GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY } = process.env;

  if (!GOOGLE_SHEETS_SPREADSHEET_ID || !GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    console.error('Missing env vars: GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY');
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
  const spreadsheetId = GOOGLE_SHEETS_SPREADSHEET_ID;

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = meta.data.sheets?.map(s => s.properties?.title ?? '') ?? [];

  if (existing.includes('ExpenseProjections')) {
    console.log('ExpenseProjections tab already exists — nothing to do.');
    return;
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

  console.log('Created ExpenseProjections tab with headers.');
}

main().catch(err => { console.error(err); process.exit(1); });
