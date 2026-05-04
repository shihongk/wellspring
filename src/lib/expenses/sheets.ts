import { google } from 'googleapis';
import { ExpenseTransaction, ExpenseRule, ExpenseProjectionOverride } from '@/types';
import { SHEET_NAMES } from '@/lib/constants';

function getSheetsClient() {
  const {
    GOOGLE_SHEETS_SPREADSHEET_ID,
    GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_PRIVATE_KEY,
  } = process.env;

  if (!GOOGLE_SHEETS_SPREADSHEET_ID || !GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    throw new Error('Missing Google Sheets credentials in environment variables.');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return {
    sheets: google.sheets({ version: 'v4', auth }),
    spreadsheetId: GOOGLE_SHEETS_SPREADSHEET_ID,
  };
}

function rowToTransaction(row: string[]): ExpenseTransaction {
  return {
    id: row[0],
    date: row[1],
    postDate: row[2],
    description: row[3],
    amount: parseFloat(row[4]),
    direction: row[5] as 'debit' | 'credit',
    balance: row[6] ? parseFloat(row[6]) : null,
    account: row[7],
    category: row[8],
    sourceFile: row[9],
    excluded: row[11] === 'true',
    oneOff: row[12] === 'true',
  };
}

function transactionToRow(tx: ExpenseTransaction): string[] {
  return [
    tx.id,
    tx.date,
    tx.postDate,
    tx.description,
    tx.amount.toString(),
    tx.direction,
    tx.balance != null ? tx.balance.toString() : '',
    tx.account,
    tx.category,
    tx.sourceFile,
    new Date().toISOString(),
    tx.excluded ? 'true' : '',
    tx.oneOff ? 'true' : '',
  ];
}

export async function getExpenses(): Promise<ExpenseTransaction[]> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.EXPENSES}!A:M`,
  });

  const rows = res.data.values ?? [];
  if (rows.length <= 1) return [];
  return rows.slice(1).map(rowToTransaction);
}

export async function getExpenseIds(): Promise<Set<string>> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.EXPENSES}!A:A`,
  });

  const rows = res.data.values ?? [];
  const ids = rows.slice(1).map(r => r[0]).filter(Boolean);
  return new Set(ids);
}

export async function appendExpenses(rows: ExpenseTransaction[]): Promise<void> {
  if (rows.length === 0) return;

  const { sheets, spreadsheetId } = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_NAMES.EXPENSES}!A:M`,
    valueInputOption: 'RAW',
    requestBody: { values: rows.map(transactionToRow) },
  });
}

export async function getExpenseRules(): Promise<ExpenseRule[]> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.EXPENSE_RULES}!A:B`,
  });

  const rows = res.data.values ?? [];
  if (rows.length <= 1) return [];
  return rows.slice(1)
    .filter(row => row[0] && row[1])
    .map(row => ({ merchant: row[0], category: row[1] }));
}

export async function updateExpenseCategory(id: string, category: string): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.EXPENSES}!A:A`,
  });

  const rows = res.data.values ?? [];
  const rowIndex = rows.findIndex((r, i) => i > 0 && r[0] === id);
  if (rowIndex < 1) return;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAMES.EXPENSES}!I${rowIndex + 1}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[category]] },
  });
}

export async function updateExpenseExcluded(id: string, excluded: boolean): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.EXPENSES}!A:A`,
  });

  const rows = res.data.values ?? [];
  const rowIndex = rows.findIndex((r, i) => i > 0 && r[0] === id);
  if (rowIndex < 1) return;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAMES.EXPENSES}!L${rowIndex + 1}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[excluded ? 'true' : '']] },
  });
}

export async function applyRuleToExisting(merchant: string, category: string): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.EXPENSES}!A:I`,
  });

  const rows = res.data.values ?? [];
  const upper = merchant.toUpperCase();

  const updates: Array<{ rowNum: number }> = [];
  for (let i = 1; i < rows.length; i++) {
    const desc = (rows[i][3] ?? '').toUpperCase();
    const cat = rows[i][8] ?? '';
    if (desc.includes(upper) && cat === 'Other') {
      updates.push({ rowNum: i + 1 });
    }
  }

  if (updates.length === 0) return;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: updates.map(({ rowNum }) => ({
        range: `${SHEET_NAMES.EXPENSES}!I${rowNum}`,
        values: [[category]],
      })),
    },
  });
}

export async function bulkUpdateExpenseCategory(ids: string[], category: string): Promise<void> {
  if (ids.length === 0) return;
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.EXPENSES}!A:A`,
  });

  const rows = res.data.values ?? [];
  const idSet = new Set(ids);
  const updates: Array<{ rowNum: number }> = [];
  for (let i = 1; i < rows.length; i++) {
    if (idSet.has(rows[i][0])) updates.push({ rowNum: i + 1 });
  }
  if (updates.length === 0) return;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: updates.map(({ rowNum }) => ({
        range: `${SHEET_NAMES.EXPENSES}!I${rowNum}`,
        values: [[category]],
      })),
    },
  });
}

export async function updateExpenseOneOff(id: string, oneOff: boolean): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.EXPENSES}!A:A`,
  });

  const rows = res.data.values ?? [];
  const rowIndex = rows.findIndex((r, i) => i > 0 && r[0] === id);
  if (rowIndex < 1) return;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAMES.EXPENSES}!M${rowIndex + 1}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[oneOff ? 'true' : '']] },
  });
}

export async function getProjectionOverrides(): Promise<ExpenseProjectionOverride[]> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.EXPENSE_PROJECTIONS}!A:C`,
  });

  const rows = res.data.values ?? [];
  if (rows.length <= 1) return [];
  return rows.slice(1)
    .filter(r => r[0] && r[1] && r[2])
    .map(r => ({ month: r[0], category: r[1], amount: parseFloat(r[2]) }));
}

export async function upsertProjectionOverride(override: ExpenseProjectionOverride): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.EXPENSE_PROJECTIONS}!A:C`,
  });

  const rows = res.data.values ?? [];
  const rowIndex = rows.findIndex(
    (r, i) => i > 0 && r[0] === override.month && r[1] === override.category,
  );
  const rowData = [override.month, override.category, override.amount.toString()];

  if (rowIndex >= 1) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAMES.EXPENSE_PROJECTIONS}!A${rowIndex + 1}:C${rowIndex + 1}`,
      valueInputOption: 'RAW',
      requestBody: { values: [rowData] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET_NAMES.EXPENSE_PROJECTIONS}!A:C`,
      valueInputOption: 'RAW',
      requestBody: { values: [rowData] },
    });
  }
}

export async function deleteProjectionOverride(month: string, category: string): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.EXPENSE_PROJECTIONS}!A:C`,
  });

  const rows = res.data.values ?? [];
  const rowIndex = rows.findIndex(
    (r, i) => i > 0 && r[0] === month && r[1] === category,
  );
  if (rowIndex < 1) return;

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets?.find(
    s => s.properties?.title === SHEET_NAMES.EXPENSE_PROJECTIONS,
  );
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId == null) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex,
            endIndex: rowIndex + 1,
          },
        },
      }],
    },
  });
}

export async function upsertExpenseRule(rule: ExpenseRule): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.EXPENSE_RULES}!A:B`,
  });

  const rows = res.data.values ?? [];
  const rowIndex = rows.findIndex(
    r => r[0]?.toLowerCase() === rule.merchant.toLowerCase(),
  );
  const rowData = [rule.merchant, rule.category];

  if (rowIndex >= 1) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAMES.EXPENSE_RULES}!A${rowIndex + 1}:B${rowIndex + 1}`,
      valueInputOption: 'RAW',
      requestBody: { values: [rowData] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET_NAMES.EXPENSE_RULES}!A:B`,
      valueInputOption: 'RAW',
      requestBody: { values: [rowData] },
    });
  }
}
