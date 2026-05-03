import { ExpenseTransaction } from '@/types';
import { generateId, parseDDMMM, inferYear, directionFromDelta, parseAmount } from '../utils';

const DATE_ANCHOR = /^\d{2}\s+[A-Z][a-z]{2}$/;
const FLOAT_RE = /^[\d,]+\.\d{2}$/;
const CONCAT_FLOATS = /^([\d,]+\.\d{2})([\d,]+\.\d{2})\s*$/;
const REF_LINE = /^x+\d+$/i;
const BALANCE_BF = /^BALANCE\s+B\/F$/i;
const FOOTER = 'United Overseas Bank Limited';
const SECTION_START = 'Account Transaction Details';
const DISCLAIMER_START = 'Pleasenotethat';
// Column headers, page numbers, account section headers, totals row
const SKIP_LINE = /^(DateDescription|Withdrawals|Deposits|Balance|SGD|Account Transaction Details)\s*$|^Page \d+ of \d+$|^Total\d/i;
const ACCOUNT_SECTION_HEADER = /A\/c\s+\d/;

const MONTH_NUM: Record<string, number> = {
  jan:1, feb:2, mar:3, apr:4, may:5, jun:6,
  jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
};

function extractYear(text: string): number {
  const m = text.match(/\bto\s+\d{1,2}\s+[A-Za-z]{3}\s+(20\d{2})\b/i)
          ?? text.match(/\b\d{1,2}\s+[A-Za-z]{3}\s+(20\d{2})\b/);
  return m ? parseInt(m[1], 10) : new Date().getFullYear();
}

function extractEndMonth(text: string): number {
  const m = text.match(/\bto\s+\d{1,2}\s+([A-Za-z]{3})\s+20\d{2}\b/i)
          ?? text.match(/\b\d{1,2}\s+([A-Za-z]{3})\s+20\d{2}\b/);
  return m ? (MONTH_NUM[m[1].toLowerCase()] ?? 12) : 12;
}

function extractAccount(text: string): string {
  if (/One Account/i.test(text)) return 'UOB One Account';
  if (/Lady/i.test(text)) return "UOB Lady's Savings";
  return 'UOB Deposit';
}

export function parseUOBDeposit(text: string, filename: string): ExpenseTransaction[] {
  const year = extractYear(text);
  const endMonth = extractEndMonth(text);
  const account = extractAccount(text);

  // Collect transaction sections from each page, stopping before footer/disclaimer
  const sections: string[] = [];
  let searchFrom = 0;
  while (true) {
    const start = text.indexOf(SECTION_START, searchFrom);
    if (start < 0) break;
    const footerIdx = text.indexOf(FOOTER, start);
    const disclaimerIdx = text.indexOf(DISCLAIMER_START, start);
    const candidates = [footerIdx, disclaimerIdx].filter(i => i >= 0);
    const end = candidates.length > 0 ? Math.min(...candidates) : -1;
    sections.push(end >= 0 ? text.slice(start, end) : text.slice(start));
    searchFrom = end >= 0 ? end + 1 : text.length;
    if (end < 0) break;
  }
  const relevant = sections.length > 0 ? sections.join('\n') : text;

  const lines = relevant.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !SKIP_LINE.test(l) && !ACCOUNT_SECTION_HEADER.test(l));

  // Extract opening balance from BALANCE B/F row
  let prevBalance: number | null = null;
  const bfIdx = lines.findIndex(l => BALANCE_BF.test(l));
  if (bfIdx >= 0) {
    for (let i = bfIdx + 1; i < Math.min(bfIdx + 5, lines.length); i++) {
      if (FLOAT_RE.test(lines[i])) { prevBalance = parseAmount(lines[i]); break; }
      const cm = CONCAT_FLOATS.exec(lines[i]);
      if (cm) { prevBalance = parseAmount(cm[2]); break; }
    }
  }

  // Group lines into transactions by date anchor
  const groups: string[][] = [];
  let current: string[] | null = null;
  for (const line of lines) {
    if (DATE_ANCHOR.test(line)) {
      if (current) groups.push(current);
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) groups.push(current);

  const transactions: ExpenseTransaction[] = [];

  for (const group of groups) {
    const [dateLine, ...rest] = group;

    // Skip BALANCE B/F groups
    if (rest.some(l => BALANCE_BF.test(l))) continue;

    // Extract amount + balance — handle both real-PDF (concatenated) and test-fixture (separate lines)
    const lastLine = rest[rest.length - 1] ?? '';
    const concatMatch = CONCAT_FLOATS.exec(lastLine);

    let balance: number;
    let amount: number;
    let usedConcat: boolean;

    if (concatMatch) {
      amount = parseAmount(concatMatch[1]);
      balance = parseAmount(concatMatch[2]);
      usedConcat = true;
    } else {
      const floats = rest.filter(l => FLOAT_RE.test(l));
      if (floats.length < 2) continue;
      balance = parseAmount(floats[floats.length - 1]);
      amount = parseAmount(floats[floats.length - 2]);
      usedConcat = false;
    }

    const descLines = rest.filter(l =>
      !REF_LINE.test(l) &&
      !(usedConcat ? l === lastLine : FLOAT_RE.test(l)),
    );
    const description = descLines.join(' ').trim();
    if (!description) continue;

    const nominalDate = parseDDMMM(dateLine, year);
    const txMonth = parseInt(nominalDate.split('-')[1], 10);
    const txYear = inferYear(txMonth, endMonth, year);
    const date = txYear !== year ? parseDDMMM(dateLine, txYear) : nominalDate;

    const direction = prevBalance !== null ? directionFromDelta(balance, prevBalance) : 'debit';
    prevBalance = balance;

    transactions.push({
      id: generateId(date, description, amount, account),
      date,
      postDate: date,
      description,
      amount,
      direction,
      balance,
      account,
      category: 'Other',
      sourceFile: filename,
    });
  }

  return transactions;
}
