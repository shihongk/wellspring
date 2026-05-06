import { readdirSync, readFileSync, mkdirSync, renameSync, writeFileSync } from 'fs';
import { join } from 'path';
import pdfParse from 'pdf-parse';
import { ExpenseTransaction } from '@/types';
import { detectStatementType } from './detect';
import { categorize } from './categorize';
import { getExpenseIds, getExpenseRules, appendExpenses } from './sheets';
import { upsertCpfBalance, getCpfTransactionKeys, appendCpfTransactions } from '@/lib/retirement/sheets';
import { ocrPdf } from './parsers/ocr-utils';
import { parseCpfAnnual, parseCpfTransactions } from './parsers/cpf-annual';
import { parseUOBDeposit } from './parsers/uob-deposit';
import { parseUOBCredit } from './parsers/uob-credit';
import { parseCitiCredit } from './parsers/citi-credit';
import { parseHSBCCredit } from './parsers/hsbc-credit';
import { parseHSBCComposite } from './parsers/hsbc-composite';
import { parseAmexCredit } from './parsers/amex-credit';

export interface FileResult {
  file: string;
  type: string;
  parsed: number;
  newRows: number;
  duplicates: number;
  moved: boolean;
  error?: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  cpfImported: number;
  errors: { file: string; message: string }[];
  files: FileResult[];
}

async function extractText(filePath: string): Promise<string> {
  const buffer = readFileSync(filePath);
  const { text } = await pdfParse(buffer);
  if (text.trim().length > 0) return text;
  return ocrPdf(filePath);
}

function dispatch(type: string, text: string, filename: string): ExpenseTransaction[] {
  switch (type) {
    case 'uob-deposit':           return parseUOBDeposit(text, filename);
    case 'uob-credit':            return parseUOBCredit(text, filename);
    case 'citi-credit':           return parseCitiCredit(text, filename);
    case 'hsbc-credit-premier':
    case 'hsbc-credit-revolution': return parseHSBCCredit(text, filename);
    case 'hsbc-composite':        return parseHSBCComposite(text, filename);
    case 'amex-credit':           return parseAmexCredit(text, filename);
    default:                      return [];
  }
}

export async function importStatements(folder: string): Promise<ImportResult> {
  const files = readdirSync(folder)
    .filter((f): f is string => typeof f === 'string' && f.toLowerCase().endsWith('.pdf'));

  const processedDir = join(folder, 'Processed');
  mkdirSync(processedDir, { recursive: true });

  const [existingIds, userRules, cpfTxKeys] = await Promise.all([
    getExpenseIds(),
    getExpenseRules(),
    getCpfTransactionKeys(),
  ]);

  const newRows: ExpenseTransaction[] = [];
  let skipped = 0;
  let cpfImported = 0;
  const errors: { file: string; message: string }[] = [];
  const fileResults: FileResult[] = [];

  for (const filename of files) {
    const filePath = join(folder, filename);
    const fileResult: FileResult = { file: filename, type: 'unknown', parsed: 0, newRows: 0, duplicates: 0, moved: false };

    try {
      const text = await extractText(filePath);
      const type = detectStatementType(filename, text);
      fileResult.type = type;

      if (type === 'cpf-annual') {
        const balance = parseCpfAnnual(text);
        await upsertCpfBalance(balance);

        const allTxs = parseCpfTransactions(text);
        const newTxs = allTxs.filter(tx => !cpfTxKeys.has(`${tx.date}|${tx.code}|${tx.ref}`));
        await appendCpfTransactions(newTxs);
        newTxs.forEach(tx => cpfTxKeys.add(`${tx.date}|${tx.code}|${tx.ref}`));

        cpfImported++;
        fileResult.parsed = allTxs.length + 1;
        try { renameSync(filePath, join(processedDir, filename)); fileResult.moved = true; } catch { /* ignore */ }
        fileResults.push(fileResult);
        continue;
      }

      const txs = dispatch(type, text, filename);
      fileResult.parsed = txs.length;

      for (const tx of txs) {
        // Preserve parser-assigned categories (e.g. Bank Charges from Citi CCY fee)
        if (tx.category === 'Other') {
          tx.category = categorize(tx.description, userRules);
        }

        if (existingIds.has(tx.id)) {
          skipped++;
          fileResult.duplicates++;
        } else {
          newRows.push(tx);
          existingIds.add(tx.id);
          fileResult.newRows++;
        }
      }

      if (txs.length > 0) {
        try { renameSync(filePath, join(processedDir, filename)); fileResult.moved = true; } catch { /* ignore */ }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ file: filename, message });
      fileResult.error = message;
    }

    fileResults.push(fileResult);
  }

  await appendExpenses(newRows);

  // Write log
  const logLines = fileResults.map(r => {
    const status = r.error ? `ERROR: ${r.error}`
      : r.parsed === 0 ? `WARN: 0 transactions parsed (type=${r.type}) — file left in Pending`
      : `OK: ${r.parsed} parsed, ${r.newRows} new, ${r.duplicates} duplicates`;
    return `${r.file}: ${status}`;
  });
  writeFileSync(join(folder, 'import.log'), logLines.join('\n') + '\n');

  return { imported: newRows.length, skipped, cpfImported, errors, files: fileResults };
}
