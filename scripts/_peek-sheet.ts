import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env.local') });

import { getExpenses } from '../src/lib/expenses/sheets';

async function run() {
  const txs = await getExpenses();
  console.log(`Total rows: ${txs.length}`);
  console.log('\nFirst 5:');
  txs.slice(0, 5).forEach(t => console.log(`  ${t.date} | ${t.account} | ${t.description.slice(0, 30)} | ${t.direction} | ${t.amount}`));
  console.log('\nLast 5:');
  txs.slice(-5).forEach(t => console.log(`  ${t.date} | ${t.account} | ${t.description.slice(0, 30)} | ${t.direction} | ${t.amount}`));
}

run().catch(console.error);
