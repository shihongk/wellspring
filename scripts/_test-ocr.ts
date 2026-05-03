import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env.local') });

import { ocrPdf } from '../src/lib/expenses/parsers/ocr-utils';
import { detectStatementType } from '../src/lib/expenses/detect';

async function run() {
  const file = process.argv[2];
  console.log('Running OCR on:', file);
  const text = await ocrPdf(file);
  console.log('OCR length:', text.length);
  const type = detectStatementType(file, text);
  console.log('Detected type:', type);
  console.log('--- OCR text ---');
  console.log(text);
}
run().catch(console.error);
