import { ExpenseTransaction } from '@/types';
import { generateId, parseDDMMM, inferYear, directionFromDelta, parseAmount } from '../utils';

const DATE_ANCHOR = /^\d{2}\s+[A-Z][a-z]{2}$/;
const FLOAT_RE = /^[\d,]+\.\d{2}$/;
const CONCAT_FLOATS = /^([\d,]+\.\d{2})([\d,]+\.\d{2})\s*$/;
const REF_LINE = /^x+\d+$/i;
// Foreign-currency wallet sub-accounts (JPY, USD, ...) print both the local-currency
// figure and this SGD-converted reference — prefer it over the local-currency float.
const SGD_EQUIVALENT = /^SGD\s+([\d,]+\.\d{2})$/;
const BALANCE_BF = /^BALANCE\s+B\/F$/i;
const FOOTER = 'United Overseas Bank Limited';
const SECTION_START = 'Account Transaction Details';
const DISCLAIMER_START = 'Pleasenotethat';
// Column headers, page numbers, account section headers, totals row
const SKIP_LINE = /^(DateDescription|Withdrawals|Deposits|Balance|SGD|Account Transaction Details)\s*$|^Page \d+ of \d+$|^Total\d/i;
// Matches both the fixture-style "A/c 779-XXX-XXX-X" and the real statement's repeated
// per-page header "One Account   779-358-006-5 (continued)" — the latter reappears while
// a transaction group from the previous page is still open (no date anchor has closed it
// yet), so left unfiltered it becomes the trailing line of that group and corrupts its
// amount/balance parse, silently dropping the whole transaction.
const ACCOUNT_SECTION_HEADER = /A\/c\s+\d|^(One Account|Lady's (Savings|Card))\s+\d{3}-\d{3}-\d{3}-\d\b/;

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

// Scans forward from a "BALANCE B/F" line for its printed balance figure.
function extractBFBalance(seq: string[], fromIdx: number): number | null {
  for (let i = fromIdx + 1; i < Math.min(fromIdx + 5, seq.length); i++) {
    if (FLOAT_RE.test(seq[i])) return parseAmount(seq[i]);
    const cm = CONCAT_FLOATS.exec(seq[i]);
    if (cm) return parseAmount(cm[2]);
  }
  return null;
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
    const extracted = extractBFBalance(lines, bfIdx);
    if (extracted !== null) prevBalance = extracted;
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

    // BALANCE B/F groups reseed the delta chain instead of emitting a transaction —
    // each sub-account section (e.g. a JPY wallet) prints its own opening balance,
    // so the chain must restart in that section's currency at the boundary.
    const bfInGroupIdx = rest.findIndex(l => BALANCE_BF.test(l));
    if (bfInGroupIdx >= 0) {
      const extracted = extractBFBalance(rest, bfInGroupIdx);
      if (extracted !== null) prevBalance = extracted;
      continue;
    }

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

    // Foreign-currency section (e.g. JPY wallet) — the concat/float logic above just
    // captured local-currency figures; use the printed SGD equivalent instead.
    const sgdLine = rest.find(l => SGD_EQUIVALENT.test(l));
    const isWallet = !!sgdLine;
    if (sgdLine) {
      amount = parseAmount(SGD_EQUIVALENT.exec(sgdLine)![1]);
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

    // Direction is computed from the raw (section-currency) balance so JPY wallet
    // deltas stay internally consistent; only the emitted balance is nulled for wallets
    // to keep them out of the SGD balance-continuity chain (they're a different ledger).
    const direction = prevBalance !== null ? directionFromDelta(balance, prevBalance) : 'debit';
    prevBalance = balance;

    transactions.push({
      id: generateId(date, description, amount, account),
      date,
      postDate: date,
      description,
      amount,
      direction,
      balance: isWallet ? null : balance,
      account,
      category: 'Other',
      sourceFile: filename,
    });
  }

  return transactions;
}
