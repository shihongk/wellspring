/**
 * Standalone daily snapshot script.
 * Run with: npx tsx scripts/snapshot.ts
 * Called by macOS launchd — no Next.js server required.
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local from the project root (Next.js convention)
config({ path: resolve(__dirname, '../.env.local') });

// Resolve src/ aliases manually since this runs outside Next.js
import { fetchPricesAndFx } from '../src/lib/yahoo-finance';
import { getHoldings, getCash, upsertHistoryEntry } from '../src/lib/google-sheets';
import { computePortfolioSnapshot } from '../src/lib/portfolio';

async function run() {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`[wellspring] Running snapshot for ${today}…`);

  // 1. Fetch live prices + FX
  const { fxRates, prices, stale } = await fetchPricesAndFx();

  if (stale) {
    console.error('[wellspring] Prices are stale — Yahoo Finance may be unreachable. Snapshot not recorded.');
    process.exit(1);
  }

  // 2. Fetch holdings + cash from Sheets
  const [holdings, cash] = await Promise.all([getHoldings(), getCash()]);

  // 3. Compute total portfolio value
  const snapshot = computePortfolioSnapshot(
    holdings,
    prices,
    fxRates,
    cash,
    false,
    new Date().toISOString(),
  );

  if (snapshot.totalValueSGD === null) {
    console.error('[wellspring] Could not compute total value. Snapshot not recorded.');
    process.exit(1);
  }

  // 4. Upsert row into PortfolioHistory sheet
  await upsertHistoryEntry({
    date: today,
    totalValueSGD: snapshot.totalValueSGD,
    fxUSDSGD: fxRates.USDSGD,
    fxHKDSGD: fxRates.HKDSGD,
    recordedAt: new Date().toISOString(),
  });

  const formatted = snapshot.totalValueSGD.toLocaleString('en-SG', {
    style: 'currency',
    currency: 'SGD',
    minimumFractionDigits: 2,
  });
  console.log(`[wellspring] Snapshot recorded: ${today} ${formatted}`);
}

run().catch((err) => {
  console.error('[wellspring] Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
