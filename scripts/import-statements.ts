import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env.local') });

import { importStatements } from '../src/lib/expenses/pipeline';

async function run() {
  const folder = process.argv[2] || process.env.STATEMENTS_FOLDER;

  if (!folder) {
    console.error('Usage: npx tsx scripts/import-statements.ts <folder>');
    console.error('       or set STATEMENTS_FOLDER in .env.local');
    process.exit(1);
  }

  const result = await importStatements(folder);

  console.log(`Import complete: ${result.imported} new, ${result.skipped} duplicates skipped`);

  for (const f of result.files) {
    if (f.error) {
      console.error(`  ERROR  ${f.file} — ${f.error}`);
    } else if (f.parsed === 0) {
      console.warn(`  WARN   ${f.file} — 0 transactions parsed (type=${f.type}), left in Pending`);
    } else {
      console.log(`  OK     ${f.file} — ${f.parsed} parsed, ${f.newRows} new, ${f.duplicates} dup`);
    }
  }
}

run().catch((err) => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
