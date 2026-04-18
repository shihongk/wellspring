import { google } from 'googleapis';
import { Holding, Transaction, CashPosition, CashAccount, TargetAllocationRow, InvestmentScheduleRow, FxRates, PortfolioHistoryEntry } from '@/types';
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

export async function getSheetIdByName(name: string): Promise<number> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = res.data.sheets?.find((s) => s.properties?.title === name);
  
  if (sheet?.properties?.sheetId == null) {
    throw new Error(`Sheet ${name} not found`);
  }
  return sheet.properties.sheetId;
}

export async function getHoldings(): Promise<Holding[]> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.HOLDINGS}!A:E`,
  });
  
  const rows = res.data.values || [];
  if (rows.length <= 1) return []; // Only header or empty

  return rows.slice(1).map((row) => ({
    ticker: row[0],
    name: row[1],
    shares: parseFloat(row[2]),
    avgCostLocal: parseFloat(row[3]),
    currency: row[4] as Holding['currency'],
  }));
}

export async function upsertHolding(holding: Holding): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.HOLDINGS}!A:E`,
  });
  
  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === holding.ticker);
  
  const rowData = [
    holding.ticker,
    holding.name,
    holding.shares.toString(),
    holding.avgCostLocal.toString(),
    holding.currency,
  ];

  if (rowIndex >= 0) {
    // Update existing row (1-based index in sheets + 1 for array to sheet alignment)
    const rowNumber = rowIndex + 1;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAMES.HOLDINGS}!A${rowNumber}:E${rowNumber}`,
      valueInputOption: 'RAW',
      requestBody: { values: [rowData] },
    });
  } else {
    // Append new row
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET_NAMES.HOLDINGS}!A:E`,
      valueInputOption: 'RAW',
      requestBody: { values: [rowData] },
    });
  }
}

export async function deleteHolding(ticker: string): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient();
  
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.HOLDINGS}!A:A`,
  });
  
  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === ticker);
  
  if (rowIndex === -1) return;

  const sheetId = await getSheetIdByName(SHEET_NAMES.HOLDINGS);
  
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex, // 0-based inclusive
              endIndex: rowIndex + 1, // 0-based exclusive
            },
          },
        },
      ],
    },
  });
}

export async function getCash(): Promise<CashPosition> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.CASH}!A:C`,
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return { accounts: [], SGD: 0 };

  // Support both old format (currency | amount) and new (account | currency | amount)
  const dataRows = rows.slice(1).filter((r) => r.length >= 2);
  const isNewFormat = rows[0]?.[0] === 'account';

  const accounts: CashAccount[] = dataRows.map((row) => {
    if (isNewFormat) {
      return { account: row[0], currency: 'SGD', amount: parseFloat(row[2]) || 0 };
    }
    // Legacy: row[0] = currency, row[1] = amount — treat as single "Default" account
    return { account: 'Default', currency: 'SGD', amount: parseFloat(row[1]) || 0 };
  });

  const SGD = accounts.reduce((sum, a) => sum + a.amount, 0);
  return { accounts, SGD };
}

export async function upsertCashAccount(account: string, amount: number): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.CASH}!A:C`,
  });

  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((r, i) => i > 0 && r[0] === account);
  const rowData = [account, 'SGD', amount.toString()];

  if (rowIndex >= 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAMES.CASH}!A${rowIndex + 1}:C${rowIndex + 1}`,
      valueInputOption: 'RAW',
      requestBody: { values: [rowData] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET_NAMES.CASH}!A:C`,
      valueInputOption: 'RAW',
      requestBody: { values: [rowData] },
    });
  }
}

export async function deleteCashAccount(account: string): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.CASH}!A:A`,
  });

  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((r, i) => i > 0 && r[0] === account);
  if (rowIndex === -1) return;

  const sheetId = await getSheetIdByName(SHEET_NAMES.CASH);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 },
        },
      }],
    },
  });
}

// Keep for backwards compat (used by API route)
export async function updateCash(amount: number): Promise<void> {
  return upsertCashAccount('Default', amount);
}

export async function getTransactions(ticker?: string): Promise<Transaction[]> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.TRANSACTIONS}!A:G`,
  });
  
  const rows = res.data.values || [];
  if (rows.length <= 1) return [];

  let transactions: Transaction[] = rows.slice(1).map((row) => ({
    id: row[0],
    date: row[1],
    ticker: row[2],
    type: row[3] as Transaction['type'],
    shares: parseFloat(row[4]),
    priceLocal: parseFloat(row[5]),
    currency: row[6] as Transaction['currency'],
  }));

  if (ticker) {
    transactions = transactions.filter((t) => t.ticker === ticker);
  }

  // Sort descending by date
  return transactions.sort((a, b) => (new Date(b.date).getTime()) - (new Date(a.date).getTime()));
}

export async function appendTransaction(t: Omit<Transaction, 'id'>): Promise<string> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const id = `txn_${Date.now()}`;
  
  const rowData = [id, t.date, t.ticker, t.type, t.shares.toString(), t.priceLocal.toString(), t.currency];
  
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_NAMES.TRANSACTIONS}!A:G`,
    valueInputOption: 'RAW',
    requestBody: { values: [rowData] },
  });
  
  return id;
}

export async function getTargetAllocations(): Promise<TargetAllocationRow[]> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.TARGET_ALLOCATION}!A:B`,
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return [];

  return rows.slice(1).map((row) => ({
    ticker: row[0],
    targetPct: parseFloat(row[1] || '0'),
  }));
}

export async function replaceTargetAllocations(rows: TargetAllocationRow[]): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient();

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${SHEET_NAMES.TARGET_ALLOCATION}!A2:B`,
  });

  if (rows.length === 0) return;

  const values = rows.map((r) => [r.ticker, r.targetPct.toString()]);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAMES.TARGET_ALLOCATION}!A2:B${values.length + 1}`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
}

export async function replaceInvestmentSchedule(rows: InvestmentScheduleRow[]): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient();

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${SHEET_NAMES.INVESTMENT_SCHEDULE}!A2:D`,
  });

  if (rows.length === 0) return;

  const values = rows.map((r) => [r.month, r.ticker, r.name, r.plannedSGD.toString()]);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAMES.INVESTMENT_SCHEDULE}!A2:D${values.length + 1}`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
}

export async function getInvestmentSchedule(): Promise<InvestmentScheduleRow[]> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.INVESTMENT_SCHEDULE}!A:D`,
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return [];

  return rows.slice(1).map((row) => ({
    month: row[0],
    ticker: row[1],
    name: row[2],
    plannedSGD: parseFloat(row[3] || '0'),
  }));
}

export async function getFxRates(): Promise<FxRates | null> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.FX_RATES}!A:B`,
  });
  
  const rows = res.data.values || [];
  if (rows.length <= 1) return null;

  const rates: Partial<FxRates> = {};
  for (const row of rows.slice(1)) {
    if (row[0] === 'USDSGD=X') rates.USDSGD = parseFloat(row[1]);
    if (row[0] === 'HKDSGD=X') rates.HKDSGD = parseFloat(row[1]);
  }

  if (rates.USDSGD == null || rates.HKDSGD == null) return null;
  return rates as FxRates;
}

export async function getPortfolioHistory(): Promise<PortfolioHistoryEntry[]> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.PORTFOLIO_HISTORY}!A:E`,
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return [];

  return rows
    .slice(1)
    .map((row) => ({
      date: row[0],
      totalValueSGD: parseFloat(row[1]),
      fxUSDSGD: parseFloat(row[2]),
      fxHKDSGD: parseFloat(row[3]),
      recordedAt: row[4],
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function findHistoryRowByDate(date: string): Promise<number | null> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.PORTFOLIO_HISTORY}!A:A`,
  });

  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((row, i) => i > 0 && row[0] === date);
  return rowIndex === -1 ? null : rowIndex + 1; // 1-based sheet row number
}

export async function upsertHistoryEntry(entry: PortfolioHistoryEntry): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const rowData = [
    entry.date,
    entry.totalValueSGD.toString(),
    entry.fxUSDSGD.toString(),
    entry.fxHKDSGD.toString(),
    entry.recordedAt,
  ];

  const existingRow = await findHistoryRowByDate(entry.date);

  if (existingRow !== null) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAMES.PORTFOLIO_HISTORY}!A${existingRow}:E${existingRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: [rowData] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET_NAMES.PORTFOLIO_HISTORY}!A:E`,
      valueInputOption: 'RAW',
      requestBody: { values: [rowData] },
    });
  }
}

export async function writeFxRates(rates: FxRates): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const fetchedAt = new Date().toISOString();
  
  const values = [
    ['USDSGD=X', rates.USDSGD.toString(), fetchedAt],
    ['HKDSGD=X', rates.HKDSGD.toString(), fetchedAt],
  ];
  
  // Using update to overwrite strictly from A2 downwards
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAMES.FX_RATES}!A2:C3`,
    valueInputOption: 'RAW',
    requestBody: { values },
  }).catch(() => {
    // Fire and forget: absorb write errors silently
  });
}