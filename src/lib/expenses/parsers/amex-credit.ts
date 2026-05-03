import { ExpenseTransaction } from '@/types';
import { generateId, parseAmount } from '../utils';

// Transaction date at start of line: "20.03.26MERCHANT NAME"
// Negative lookahead (?!\d) excludes 4-digit years like "19.03.2026"
const TX_DATE_RE = /^(\d{2}\.\d{2}\.\d{2})(?!\d)(.*)/;
// Standalone float line (the amount column, extracted before description column)
const FLOAT_LINE_RE = /^([\d,]+\.\d{2})$/;
// Each PDF page starts with a line containing the masked card number
const PAGE_HEADER_RE = /XXXX-XXXXXX-/;

function extractYear(text: string, filename: string): number {
  // Prefer full DD.MM.YYYY dates in text
  const m = text.match(/\d{2}\.\d{2}\.(20\d{2})/);
  if (m) return parseInt(m[1], 10);
  const fn = filename.match(/(20\d{2})/);
  if (fn) return parseInt(fn[1], 10);
  return new Date().getFullYear();
}

function parseDDMMYY(raw: string, year: number): string {
  const [dd, mm, yy] = raw.split('.').map(Number);
  const century = Math.floor(year / 100) * 100;
  const fullYear = century + yy;
  return `${fullYear}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

function extractAccount(text: string): string {
  if (/KrisFlyer/i.test(text)) return 'Amex KrisFlyer';
  if (/Platinum/i.test(text)) return 'Amex Platinum';
  if (/Gold/i.test(text)) return 'Amex Gold';
  return 'Amex';
}

export function parseAmexCredit(text: string, filename: string): ExpenseTransaction[] {
  const year = extractYear(text, filename);
  const account = extractAccount(text);
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Split into per-page sections on each PAGE_HEADER line
  const sections: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (PAGE_HEADER_RE.test(line) && current.length > 0) {
      sections.push(current);
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) sections.push(current);

  const transactions: ExpenseTransaction[] = [];

  for (const section of sections) {
    // Amex PDF extracts the amount column before the description column.
    // Collect floats until the first date line, then collect date+description lines.
    // Pair them FIFO: floats[i] → txLines[i].
    const floats: number[] = [];
    const txLines: { date: string; description: string }[] = [];
    let seenDateLine = false;

    for (const line of section) {
      if (PAGE_HEADER_RE.test(line)) continue;

      const txMatch = line.match(TX_DATE_RE);
      if (txMatch) {
        seenDateLine = true;
        const description = txMatch[2].trim();
        if (description) {
          txLines.push({ date: parseDDMMYY(txMatch[1], year), description });
        }
        continue;
      }

      if (!seenDateLine) {
        const floatMatch = line.match(FLOAT_LINE_RE);
        if (floatMatch) floats.push(parseAmount(floatMatch[1]));
      }
    }

    for (let i = 0; i < Math.min(floats.length, txLines.length); i++) {
      const { date, description } = txLines[i];
      const amount = floats[i];
      const direction = /payment\s+(received|thank)|refund|reversal/i.test(description) ? 'credit' : 'debit';
      transactions.push({
        id: generateId(date, description, amount, account),
        date,
        postDate: date,
        description,
        amount,
        direction,
        balance: null,
        account,
        category: 'Other',
        sourceFile: filename,
      });
    }
  }

  return transactions;
}
