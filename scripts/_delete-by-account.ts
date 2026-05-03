import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env.local') });

import { google } from 'googleapis';
import { SHEET_NAMES } from '../src/lib/constants';

function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
      private_key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return { sheets: google.sheets({ version: 'v4', auth }), spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID! };
}

async function run() {
  const account = process.argv[2];
  if (!account) { console.error('Usage: npx tsx scripts/_delete-by-account.ts <account>'); process.exit(1); }

  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${SHEET_NAMES.EXPENSES}!A:H` });
  const rows = res.data.values ?? [];

  // Find 1-indexed row numbers (row 1 = header) for matching account (col H = index 7)
  const toDelete: number[] = [];
  rows.forEach((row, i) => { if (i > 0 && row[7] === account) toDelete.push(i + 1); });

  if (toDelete.length === 0) { console.log('No rows found for account:', account); return; }
  console.log(`Deleting ${toDelete.length} rows for account "${account}"`);

  // Delete in reverse order so row numbers stay valid
  const sheetRes = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetId = sheetRes.data.sheets?.find(s => s.properties?.title === SHEET_NAMES.EXPENSES)?.properties?.sheetId;

  const requests = [...toDelete].reverse().map(rowNum => ({
    deleteDimension: {
      range: { sheetId, dimension: 'ROWS', startIndex: rowNum - 1, endIndex: rowNum },
    },
  }));

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  console.log('Done.');
}
run().catch(console.error);
