import { google } from 'googleapis';
import { ExpenseTransaction, ExpenseRule, ExpenseProjectionOverride, CpfBalance, CpfTransaction } from '@/types';
import { SHEET_NAMES } from '@/lib/constants';
import { ruleMatches } from './categorize';

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

function rowsToRules(rows: string[][]): ExpenseRule[] {
  if (rows.length <= 1) return [];
  return rows.slice(1)
    .filter(row => row[0] && (row[1] || row[5] === 'true'))
    .map(row => ({
      merchant: row[0],
      ...(row[1] ? { category: row[1] } : {}),
      ...(row[2] ? { account: row[2] } : {}),
      ...(row[3] ? { amount: parseFloat(row[3]) } : {}),
      ...(row[4] === 'debit' || row[4] === 'credit' ? { direction: row[4] as 'debit' | 'credit' } : {}),
      ...(row[5] === 'true' ? { exclude: true } : {}),
    }));
}

export async function getExpenseRules(): Promise<ExpenseRule[]> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.EXPENSE_RULES}!A:F`,
  });

  return rowsToRules(res.data.values ?? []);
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

export async function applyRuleToExisting(rule: ExpenseRule): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.EXPENSES}!A:M`,
  });

  const rows = res.data.values ?? [];
  const updates: Array<{ range: string; values: string[][] }> = [];

  for (let i = 1; i < rows.length; i++) {
    const tx = rowToTransaction(rows[i]);
    if (!ruleMatches(tx, rule)) continue;

    if (rule.category && tx.category === 'Other') {
      updates.push({ range: `${SHEET_NAMES.EXPENSES}!I${i + 1}`, values: [[rule.category]] });
    }
    if (rule.exclude && !tx.excluded) {
      updates.push({ range: `${SHEET_NAMES.EXPENSES}!L${i + 1}`, values: [['true']] });
    }
  }

  if (updates.length === 0) return;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: 'RAW', data: updates },
  });
}

export async function findRuleConflicts(rule: ExpenseRule): Promise<{
  id: string; date: string; description: string; account: string; amount: number; currentCategory: string;
}[]> {
  if (!rule.category) return [];

  const txs = await getExpenses();
  return txs
    .filter(tx => ruleMatches(tx, rule) && tx.category !== 'Other' && tx.category !== rule.category)
    .map(tx => ({
      id: tx.id,
      date: tx.date,
      description: tx.description,
      account: tx.account,
      amount: tx.amount,
      currentCategory: tx.category,
    }));
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

export async function applyCategoryUpdates(updates: { id: string; category: string }[]): Promise<void> {
  if (updates.length === 0) return;
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.EXPENSES}!A:A`,
  });

  const rows = res.data.values ?? [];
  const categoryById = new Map(updates.map(u => [u.id, u.category]));
  const data: Array<{ range: string; values: string[][] }> = [];
  for (let i = 1; i < rows.length; i++) {
    const category = categoryById.get(rows[i][0]);
    if (category !== undefined) {
      data.push({ range: `${SHEET_NAMES.EXPENSES}!I${i + 1}`, values: [[category]] });
    }
  }
  if (data.length === 0) return;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: 'RAW', data },
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
    range: `${SHEET_NAMES.EXPENSE_RULES}!A:F`,
  });

  const rows = res.data.values ?? [];
  const rowIndex = rows.findIndex(
    r => r[0]?.toLowerCase() === rule.merchant.toLowerCase(),
  );
  const rowData = [
    rule.merchant,
    rule.category ?? '',
    rule.account ?? '',
    rule.amount != null ? rule.amount.toString() : '',
    rule.direction ?? '',
    rule.exclude ? 'true' : '',
  ];

  // Target row is computed explicitly and written via `update`, not `append` — this
  // sheet has rows with mixed column widths (2-col legacy rows vs. later 6-col rows),
  // and `append`'s "detect the table, then append after it" heuristic misread that
  // as a table anchored at column F rather than A, silently misfiling every new rule
  // into F:K for several rows in a row until caught (each bad row reinforced the same
  // wrong anchor for the next append). An explicit target range sidesteps the heuristic
  // entirely.
  const targetRow = rowIndex >= 1 ? rowIndex + 1 : rows.length + 1;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAMES.EXPENSE_RULES}!A${targetRow}:F${targetRow}`,
    valueInputOption: 'RAW',
    requestBody: { values: [rowData] },
  });
}

export async function getExpensesPageData(): Promise<{
  transactions: ExpenseTransaction[];
  rules: ExpenseRule[];
  overrides: ExpenseProjectionOverride[];
  cpfBalance: CpfBalance | null;
  cpfTransactions: CpfTransaction[];
}> {
  const { sheets, spreadsheetId } = getSheetsClient();

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: [
      `${SHEET_NAMES.EXPENSES}!A:M`,
      `${SHEET_NAMES.EXPENSE_RULES}!A:F`,
      `${SHEET_NAMES.EXPENSE_PROJECTIONS}!A:C`,
      `${SHEET_NAMES.CPF_BALANCES}!A2:D`,
      `${SHEET_NAMES.CPF_TRANSACTIONS}!A:F`,
    ],
  });

  const [txRange, rulesRange, projRange, cpfBalRange, cpfTxRange] = res.data.valueRanges ?? [];

  const txRows = txRange?.values ?? [];
  const transactions: ExpenseTransaction[] = txRows.length <= 1 ? [] : txRows.slice(1).map(rowToTransaction);

  const rules = rowsToRules(rulesRange?.values ?? []);

  const projRows = projRange?.values ?? [];
  const overrides: ExpenseProjectionOverride[] = projRows.length <= 1 ? [] : projRows.slice(1)
    .filter(r => r[0] && r[1] && r[2])
    .map(r => ({ month: r[0], category: r[1], amount: parseFloat(r[2]) }));

  const cpfBalRows = cpfBalRange?.values ?? [];
  const cpfBalances: CpfBalance[] = cpfBalRows
    .filter(r => r[0])
    .map(r => ({
      date: r[0],
      oa: parseFloat(r[1]) || 0,
      sa: parseFloat(r[2]) || 0,
      ma: parseFloat(r[3]) || 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const cpfBalance = cpfBalances.length > 0 ? cpfBalances[cpfBalances.length - 1] : null;

  // Parsing (not the fetch itself, which is bundled into the batchGet above) is wrapped
  // in try/catch to mirror getCpfTransactions()'s behavior of returning [] on failure.
  let cpfTransactions: CpfTransaction[] = [];
  try {
    const cpfTxRows = cpfTxRange?.values ?? [];
    if (cpfTxRows.length > 1) {
      cpfTransactions = cpfTxRows.slice(1)
        .filter(r => r[0] && r[1] != null && r[2] != null)
        .map(r => ({
          date: r[0],
          code: r[1],
          ref: r[2] ?? '',
          oaChange: parseFloat(r[3] ?? '0'),
          saChange: parseFloat(r[4] ?? '0'),
          maChange: parseFloat(r[5] ?? '0'),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }
  } catch {
    cpfTransactions = [];
  }

  return { transactions, rules, overrides, cpfBalance, cpfTransactions };
}
