import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env.local') });
import { getExpenses } from '../src/lib/expenses/sheets';

async function run() {
  const txs = await getExpenses();
  const matches = txs.filter(t =>
    t.account === 'UOB One Account' &&
    t.date.startsWith('2026-06') &&
    /Misc DR-Debit Card/.test(t.description)
  );
  const files = new Set(matches.map(t => t.sourceFile));
  console.log('Matching wallet rows:', matches.length);
  console.log('Distinct sourceFiles:', [...files]);
  for (const f of files) {
    const all = txs.filter(t => t.sourceFile === f);
    console.log(`  ${f}: ${all.length} total rows, account(s): ${[...new Set(all.map(t => t.account))].join(',')}`);
  }
}
run().catch(console.error);
