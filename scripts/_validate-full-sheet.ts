import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env.local') });
import { getExpenses } from '../src/lib/expenses/sheets';
import { validateBalanceContinuity } from '../src/lib/expenses/validate';

async function run() {
  const txs = await getExpenses();
  console.log('Total rows in sheet:', txs.length);
  const issues = validateBalanceContinuity(txs);
  console.log('Continuity issues:', issues.length);
  for (const i of issues) {
    console.log(`  ${i.account} ${i.date} "${i.description}" expected ${i.expectedBalance.toFixed(2)} got ${i.actualBalance.toFixed(2)}`);
  }
}
run().catch(console.error);
