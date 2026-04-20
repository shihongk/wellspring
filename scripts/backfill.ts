/**
 * One-off backfill script.
 * Fetches actual historical closing prices for each weekday from FROM_DATE
 * to today, using today's holdings (current units). FX rates are also
 * fetched historically so SGD conversion is accurate per day.
 *
 * Run with: npx tsx scripts/backfill.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env.local') });

import YahooFinance from 'yahoo-finance2';
import { google } from 'googleapis';
import { getHoldings, getCash } from '../src/lib/google-sheets';
import { toSGD } from '../src/lib/fx';
import { SHEET_NAMES } from '../src/lib/constants';

const yf = new YahooFinance();

const FROM_DATE = '2026-01-01';
const FALLBACK_FX = { USDSGD: 1.34, HKDSGD: 0.17 };

// --- Date helpers (UTC-safe, avoids timezone shift) ---

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

function dayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun, 6=Sat
}

function getWeekdays(from: string, to: string): string[] {
  const dates: string[] = [];
  let current = from;
  while (current <= to) {
    const dow = dayOfWeek(current);
    if (dow !== 0 && dow !== 6) dates.push(current);
    current = addDays(current, 1);
  }
  return dates;
}

// --- Fetch historical closing prices for a symbol ---

async function fetchHistory(symbol: string, from: string, to: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    // period2 needs to be one day ahead to include the to date
    const rows = await yf.historical(symbol, {
      period1: from,
      period2: addDays(to, 1),
      interval: '1d',
    });
    for (const row of rows) {
      const dateStr = row.date.toISOString().slice(0, 10);
      if (row.close != null) map.set(dateStr, row.close);
    }
  } catch (err) {
    console.warn(`  [warn] Could not fetch history for ${symbol}:`, err instanceof Error ? err.message : String(err));
  }
  return map;
}

// --- Forward-fill: for a given date, use the most recent available price ---

function closestPrice(map: Map<string, number>, date: string): number | null {
  // Try exact date first, then walk backwards up to 5 days (for holidays/gaps)
  for (let i = 0; i <= 5; i++) {
    const d = addDays(date, -i);
    if (map.has(d)) return map.get(d)!;
  }
  return null;
}

// --- Main ---

function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
      private_key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return {
    sheets: google.sheets({ version: 'v4', auth }),
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
  };
}

async function getExistingDates(): Promise<Set<string>> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.PORTFOLIO_HISTORY}!A:A`,
  });
  const rows = res.data.values ?? [];
  return new Set(rows.slice(1).map((r) => r[0]).filter(Boolean));
}

async function batchAppend(rows: string[][]): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_NAMES.PORTFOLIO_HISTORY}!A:E`,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });
}

async function run() {
  const today = new Date().toISOString().slice(0, 10);
  const dates = getWeekdays(FROM_DATE, today);

  console.log(`[backfill] Date range: ${FROM_DATE} → ${today} (${dates.length} weekdays)`);
  console.log(`[backfill] Fetching holdings, cash & existing history dates…`);
  const [holdings, cash, existingDates] = await Promise.all([getHoldings(), getCash(), getExistingDates()]);

  const tickers = holdings.map((h) => h.ticker);
  console.log(`[backfill] Holdings: ${tickers.join(', ')} + S$${cash.SGD.toFixed(2)} cash`);
  console.log(`[backfill] Already have ${existingDates.size} date(s) in sheet.`);
  console.log(`[backfill] Fetching historical prices…\n`);

  // Fetch all tickers + FX pairs in parallel
  const symbols = [...tickers, 'USDSGD=X', 'HKDSGD=X'];
  const histories = await Promise.all(
    symbols.map((sym) => fetchHistory(sym, FROM_DATE, today))
  );
  const historyMap = Object.fromEntries(symbols.map((sym, i) => [sym, histories[i]]));

  const recordedAt = new Date().toISOString();
  const newRows: string[][] = [];
  let skipped = 0;

  for (const date of dates) {
    if (existingDates.has(date)) {
      console.log(`  ~ ${date}  — already exists, skipped`);
      skipped++;
      continue;
    }

    const usdsgd = closestPrice(historyMap['USDSGD=X'], date) ?? FALLBACK_FX.USDSGD;
    const hkdsgd = closestPrice(historyMap['HKDSGD=X'], date) ?? FALLBACK_FX.HKDSGD;
    const fxRates = { USDSGD: usdsgd, HKDSGD: hkdsgd };

    let totalValueSGD = cash.SGD;
    let anyMissing = false;
    for (const h of holdings) {
      const price = closestPrice(historyMap[h.ticker], date);
      if (price == null) { anyMissing = true; break; }
      totalValueSGD += toSGD(h.shares * price, h.currency, fxRates);
    }

    if (anyMissing) {
      console.log(`  ✗ ${date}  — missing price data, skipped`);
      skipped++;
      continue;
    }

    const formatted = totalValueSGD.toLocaleString('en-SG', { style: 'currency', currency: 'SGD', minimumFractionDigits: 2 });
    console.log(`  ✓ ${date}  ${formatted}`);
    newRows.push([date, totalValueSGD.toString(), usdsgd.toString(), hkdsgd.toString(), recordedAt]);
  }

  if (newRows.length > 0) {
    console.log(`\n[backfill] Writing ${newRows.length} rows in one batch…`);
    await batchAppend(newRows);
  }

  console.log(`[backfill] Done — ${newRows.length} rows written, ${skipped} skipped.`);
}

run().catch((err) => {
  console.error('[backfill] Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
