import { google } from 'googleapis';
import { CpfBalance, RetirementOneOff, CpfTransaction, Holding, ExpenseTransaction, ExpenseProjectionOverride, PortfolioHistoryEntry } from '@/types';
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

export async function getCpfBalances(): Promise<CpfBalance[]> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.CPF_BALANCES}!A2:D`,
  });
  const rows = res.data.values ?? [];
  return rows
    .filter(r => r[0])
    .map(r => ({
      date: r[0],
      oa: parseFloat(r[1]) || 0,
      sa: parseFloat(r[2]) || 0,
      ma: parseFloat(r[3]) || 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getLatestCpfBalance(): Promise<CpfBalance | null> {
  const balances = await getCpfBalances();
  return balances.length > 0 ? balances[balances.length - 1] : null;
}

export async function upsertCpfBalance(balance: CpfBalance): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.CPF_BALANCES}!A2:A`,
  });
  const rows = res.data.values ?? [];
  const rowIndex = rows.findIndex(r => r[0] === balance.date);

  const values = [[balance.date, balance.oa, balance.sa, balance.ma]];
  if (rowIndex >= 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAMES.CPF_BALANCES}!A${rowIndex + 2}`,
      valueInputOption: 'RAW',
      requestBody: { values },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET_NAMES.CPF_BALANCES}!A1`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });
  }
}

export async function getRetirementOneOffs(): Promise<RetirementOneOff[]> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.RETIREMENT_ONE_OFFS}!A2:E`,
  });
  const rows = res.data.values ?? [];
  return rows
    .filter(r => r[0])
    .map(r => ({
      id: r[0],
      year: parseInt(r[1], 10),
      description: r[2] ?? '',
      amountSGD: parseFloat(r[3]) || 0,
      inTodaysPrices: r[4] === 'TRUE',
    }));
}

export async function upsertRetirementOneOff(item: RetirementOneOff): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.RETIREMENT_ONE_OFFS}!A2:A`,
  });
  const rows = res.data.values ?? [];
  const rowIndex = rows.findIndex(r => r[0] === item.id);

  const values = [[item.id, item.year, item.description, item.amountSGD, item.inTodaysPrices ? 'TRUE' : 'FALSE']];
  if (rowIndex >= 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAMES.RETIREMENT_ONE_OFFS}!A${rowIndex + 2}`,
      valueInputOption: 'RAW',
      requestBody: { values },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET_NAMES.RETIREMENT_ONE_OFFS}!A1`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });
  }
}

export async function deleteRetirementOneOff(id: string): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.RETIREMENT_ONE_OFFS}!A2:A`,
  });
  const rows = res.data.values ?? [];
  const rowIndex = rows.findIndex(r => r[0] === id);
  if (rowIndex < 0) return;

  const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetId = sheetMeta.data.sheets?.find(
    s => s.properties?.title === SHEET_NAMES.RETIREMENT_ONE_OFFS
  )?.properties?.sheetId;

  if (sheetId == null) throw new Error('RetirementOneOffs sheet not found');

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex + 1,
            endIndex: rowIndex + 2,
          },
        },
      }],
    },
  });
}

export async function getCpfTransactionKeys(): Promise<Set<string>> {
  const { sheets, spreadsheetId } = getSheetsClient();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAMES.CPF_TRANSACTIONS}!A:C`,
    });
    const rows = res.data.values ?? [];
    const keys = new Set<string>();
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (r[0] && r[1] != null && r[2] != null) keys.add(`${r[0]}|${r[1]}|${r[2]}`);
    }
    return keys;
  } catch {
    return new Set();
  }
}

export async function appendCpfTransactions(rows: CpfTransaction[]): Promise<void> {
  if (rows.length === 0) return;
  const { sheets, spreadsheetId } = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_NAMES.CPF_TRANSACTIONS}!A:F`,
    valueInputOption: 'RAW',
    requestBody: {
      values: rows.map(r => [
        r.date,
        r.code,
        r.ref,
        r.oaChange.toString(),
        r.saChange.toString(),
        r.maChange.toString(),
      ]),
    },
  });
}

export async function getCpfTransactions(): Promise<CpfTransaction[]> {
  const { sheets, spreadsheetId } = getSheetsClient();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAMES.CPF_TRANSACTIONS}!A:F`,
    });
    const rows = res.data.values ?? [];
    if (rows.length <= 1) return [];
    return rows.slice(1)
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
  } catch {
    return [];
  }
}

// Duplicated from expenses/sheets.ts's rowToTransaction — importing it here would create
// a circular dependency (expenses/sheets.ts would need to import from this file too if it
// ever needed retirement data). Keep in sync if the Expenses sheet schema changes.
function rowToExpenseTransaction(row: string[]): ExpenseTransaction {
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

export async function getRetirementPageData(): Promise<{
  cpfBalance: CpfBalance | null;
  oneOffs: RetirementOneOff[];
  holdings: Holding[];
  expenseTransactions: ExpenseTransaction[];
  projectionOverrides: ExpenseProjectionOverride[];
  portfolioHistory: PortfolioHistoryEntry[];
  cpfTransactions: CpfTransaction[];
}> {
  const { sheets, spreadsheetId } = getSheetsClient();

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: [
      `${SHEET_NAMES.CPF_BALANCES}!A2:D`,
      `${SHEET_NAMES.RETIREMENT_ONE_OFFS}!A2:E`,
      `${SHEET_NAMES.HOLDINGS}!A:E`,
      `${SHEET_NAMES.EXPENSES}!A:M`,
      `${SHEET_NAMES.EXPENSE_PROJECTIONS}!A:C`,
      `${SHEET_NAMES.PORTFOLIO_HISTORY}!A:E`,
      `${SHEET_NAMES.CPF_TRANSACTIONS}!A:F`,
    ],
  });

  const [
    cpfBalRange,
    oneOffsRange,
    holdingsRange,
    expensesRange,
    projRange,
    historyRange,
    cpfTxRange,
  ] = res.data.valueRanges ?? [];

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

  const oneOffsRows = oneOffsRange?.values ?? [];
  const oneOffs: RetirementOneOff[] = oneOffsRows
    .filter(r => r[0])
    .map(r => ({
      id: r[0],
      year: parseInt(r[1], 10),
      description: r[2] ?? '',
      amountSGD: parseFloat(r[3]) || 0,
      inTodaysPrices: r[4] === 'TRUE',
    }));

  const holdingRows = holdingsRange?.values ?? [];
  const holdings: Holding[] = holdingRows.length <= 1 ? [] : holdingRows.slice(1).map((row) => ({
    ticker: row[0],
    name: row[1],
    shares: parseFloat(row[2]),
    avgCostLocal: parseFloat(row[3]),
    currency: row[4] as Holding['currency'],
  }));

  const expenseRows = expensesRange?.values ?? [];
  const expenseTransactions: ExpenseTransaction[] = expenseRows.length <= 1 ? [] : expenseRows.slice(1).map(rowToExpenseTransaction);

  const projRows = projRange?.values ?? [];
  const projectionOverrides: ExpenseProjectionOverride[] = projRows.length <= 1 ? [] : projRows.slice(1)
    .filter(r => r[0] && r[1] && r[2])
    .map(r => ({ month: r[0], category: r[1], amount: parseFloat(r[2]) }));

  const historyRows = historyRange?.values ?? [];
  const portfolioHistory: PortfolioHistoryEntry[] = historyRows.length <= 1 ? [] : historyRows
    .slice(1)
    .map((row) => ({
      date: row[0],
      totalValueSGD: parseFloat(row[1]),
      fxUSDSGD: parseFloat(row[2]),
      fxHKDSGD: parseFloat(row[3]),
      recordedAt: row[4],
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

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

  return { cpfBalance, oneOffs, holdings, expenseTransactions, projectionOverrides, portfolioHistory, cpfTransactions };
}
