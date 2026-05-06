import { config } from 'dotenv';
import { resolve } from 'path';
import { google } from 'googleapis';

config({ path: resolve(__dirname, '../.env.local') });

const NEW_TABS = [
  { title: 'CpfBalances',       headers: ['date', 'oa', 'sa', 'ma'] },
  { title: 'RetirementOneOffs', headers: ['id', 'year', 'description', 'amount_sgd'] },
];

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

  for (const tab of NEW_TABS) {
    if (existing.includes(tab.title)) {
      console.log(`${tab.title} already exists — skipping.`);
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

    console.log(`Created ${tab.title} tab with headers: ${tab.headers.join(', ')}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
