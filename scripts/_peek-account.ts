import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env.local') });
import { getExpenses } from '../src/lib/expenses/sheets';

async function run() {
  const account = process.argv[2];
  const rows = await getExpenses();
  const filtered = account ? rows.filter(r => r.account === account) : rows;
  for (const r of filtered) console.log(r.date, r.amount, r.direction, r.account, '|', r.description.slice(0, 60));
}
run().catch(console.error);
