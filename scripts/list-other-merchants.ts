/**
 * Groups all 'Other'-category expenses by a normalized description prefix,
 * so recurring uncategorized merchants can be picked for new built-in rules.
 *
 * Run with: npx tsx scripts/list-other-merchants.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env.local') });

import { getExpenses } from '../src/lib/expenses/sheets';

// Same trailing-reference-number heuristic used for rule-merchant suggestions in the UI
// (ExpensesClient.tsx's suggestMerchant) — strips trailing ref codes/numbers.
function normalize(description: string): string {
  return description
    .replace(/\s+[A-Z0-9]{6,}\s*$/i, '')
    .replace(/\s+\d+\s*$/, '')
    .trim()
    .toUpperCase();
}

async function run() {
  const expenses = await getExpenses();
  const others = expenses.filter(tx => tx.category === 'Other');

  const groups = new Map<string, { count: number; total: number }>();
  for (const tx of others) {
    const key = normalize(tx.description);
    const g = groups.get(key) ?? { count: 0, total: 0 };
    g.count++;
    g.total += tx.amount;
    groups.set(key, g);
  }

  const sorted = [...groups.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 40);

  console.log(`[list-other-merchants] ${others.length} 'Other' transaction(s) across ${groups.size} group(s). Top ${sorted.length} by count:\n`);
  for (const [desc, { count, total }] of sorted) {
    console.log(`${String(count).padStart(4)}x  S$${total.toFixed(2).padStart(10)}  ${desc}`);
  }
}

run().catch(err => {
  console.error('[list-other-merchants] Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
