import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env.local') });

import pdfParse from 'pdf-parse';
import { readFileSync } from 'fs';
import { detectStatementType } from '../src/lib/expenses/detect';

async function run() {
  const file = process.argv[2];
  const buf = readFileSync(file);
  const { text } = await pdfParse(buf);
  const type = detectStatementType(file, text);
  console.log('Type:', type);
  console.log('--- full text ---');
  console.log(text);
}

run().catch(console.error);
