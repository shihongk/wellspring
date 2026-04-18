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
import { getHoldings, getCash, upsertHistoryEntry } from '../src/lib/google-sheets';
import { toSGD } from '../src/lib/fx';

const yf = new YahooFinance();

const FROM_DATE = '2026-04-01';
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

async function run() {
  const today = new Date().toISOString().slice(0, 10);
  const dates = getWeekdays(FROM_DATE, today);

  console.log(`[backfill] Date range: ${FROM_DATE} → ${today} (${dates.length} weekdays)`);
  console.log(`[backfill] Fetching holdings & cash…`);
  const [holdings, cash] = await Promise.all([getHoldings(), getCash()]);

  const tickers = holdings.map((h) => h.ticker);
  console.log(`[backfill] Holdings: ${tickers.join(', ')} + S$${cash.SGD.toFixed(2)} cash`);
  console.log(`[backfill] Fetching historical prices…\n`);

  // Fetch all tickers + FX pairs in parallel
  const symbols = [...tickers, 'USDSGD=X', 'HKDSGD=X'];
  const histories = await Promise.all(
    symbols.map((sym) => fetchHistory(sym, FROM_DATE, today))
  );
  const historyMap = Object.fromEntries(symbols.map((sym, i) => [sym, histories[i]]));

  let written = 0;
  let skipped = 0;

  for (const date of dates) {
    // Build FX rates for this date
    const usdsgd = closestPrice(historyMap['USDSGD=X'], date) ?? FALLBACK_FX.USDSGD;
    const hkdsgd = closestPrice(historyMap['HKDSGD=X'], date) ?? FALLBACK_FX.HKDSGD;
    const fxRates = { USDSGD: usdsgd, HKDSGD: hkdsgd };

    // Compute total value: sum all holdings + cash
    let totalValueSGD = cash.SGD;
    let anyMissing = false;

    for (const h of holdings) {
      const price = closestPrice(historyMap[h.ticker], date);
      if (price == null) {
        anyMissing = true;
        break;
      }
      totalValueSGD += toSGD(h.shares * price, h.currency, fxRates);
    }

    if (anyMissing) {
      console.log(`  ✗ ${date}  — missing price data, skipped`);
      skipped++;
      continue;
    }

    await upsertHistoryEntry({
      date,
      totalValueSGD,
      fxUSDSGD: usdsgd,
      fxHKDSGD: hkdsgd,
      recordedAt: new Date().toISOString(),
    });

    const formatted = totalValueSGD.toLocaleString('en-SG', {
      style: 'currency', currency: 'SGD', minimumFractionDigits: 2,
    });
    console.log(`  ✓ ${date}  ${formatted}`);
    written++;
  }

  console.log(`\n[backfill] Done — ${written} rows written, ${skipped} skipped.`);
}

run().catch((err) => {
  console.error('[backfill] Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
