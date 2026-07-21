import { ExpenseTransaction } from '@/types';
import { generateId, parseDDMMMYYYY, directionFromDelta, parseAmount } from '../utils';

const DATE_ANCHOR_RE = /^\d{2}[A-Z][a-z]{2}\d{4}/;
const CARRY_RE = /BALANCE\s*(?:BROUGHT|CARRIED)\s*FORWARD/i;
const SAVINGS_START_RE = /EVERYDAY\s+GLOBAL\s+ACC|Premier\s+Savings|Current\s+and\s+Savings/i;
const SECURITIES_START_RE = /^SECURITIES\s*[&\s]*UNIT\s*TRUSTS(?!\s*\(see)/i;
// CLOSING BALANCE / Transaction Turnover / Transaction Count are end-of-account summary
// rows, not transactions — Transaction Turnover in particular has two floats (period
// totals) and would otherwise be mistaken for a transaction's (amount, balance) pair.
const SKIP_RE = /TOTAL\s+RELATIONSHIP\s+BALANCE|END\s+OF\s+STATEMENT|CLOSING\s+BALANCE|Transaction\s+Turnover|Transaction\s+Count/i;
// Page-break boilerplate HSBC repeats between pages of a composite statement (deposit
// insurance disclaimer, branch letterhead, statement header) — never part of a transaction.
const PAGE_BREAK_RE = /Deposit Insurance Scheme|insured by the Singapore Deposit Insurance|structured deposits and other investment products|Issued by HSBC Bank|Composite Statement|Branch Name:|^Page \d+ of \d+|Statement Date|Customer Number|Sequence Number|MR KHOR SHIHONG|Statement Details|EVERYDAY GLOBAL ACC|Transaction Details\s+Deposits\s+Withdrawals|Wh\.?\s*HSBC|\bPremier\b(?!\s+Savings)/i;

export function parseHSBCComposite(text: string, filename: string): ExpenseTransaction[] {
  const account = 'HSBC Savings';
  const allLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let savingsStart = 0;
  let securitiesStart = allLines.length;
  let savingsFound = false;

  for (let i = 0; i < allLines.length; i++) {
    if (!savingsFound && SAVINGS_START_RE.test(allLines[i])) { savingsStart = i + 1; savingsFound = true; }
    if (SECURITIES_START_RE.test(allLines[i]) && i > savingsStart) { securitiesStart = i; break; }
  }

  const lines = allLines.slice(savingsStart, securitiesStart);

  // Opening balance from BALANCE BROUGHT FORWARD block
  let prevBalance: number | null = null;
  for (let i = 0; i < lines.length; i++) {
    if (CARRY_RE.test(lines[i]) && /BROUGHT/i.test(lines[i])) {
      const inline = lines[i].match(/[\d,]+\.\d{2}/g);
      if (inline) { prevBalance = parseAmount(inline[inline.length - 1]); break; }
      if (i + 1 < lines.length) {
        const nextFloats = lines[i + 1].match(/[\d,]+\.\d{2}/g);
        if (nextFloats) { prevBalance = parseAmount(nextFloats[nextFloats.length - 1]); break; }
      }
    }
  }

  // Group lines by date anchor. A single date anchor can cover several same-day
  // transactions — HSBC only prints the date once per day, not once per row.
  const groups: { date: string; lines: string[] }[] = [];
  let currentDate: string | null = null;
  let currentLines: string[] | null = null;
  for (const line of lines) {
    if (CARRY_RE.test(line) || SKIP_RE.test(line) || PAGE_BREAK_RE.test(line)) continue;
    if (DATE_ANCHOR_RE.test(line)) {
      if (currentDate) groups.push({ date: currentDate, lines: currentLines! });
      currentDate = parseDDMMMYYYY(line.slice(0, 9));
      currentLines = [];
      // OCR often runs real transaction content onto the same line as the date
      // (e.g. "11May2026 |TO 4835 8500 2021 9896") — don't silently drop it.
      const rest = line.slice(9).replace(/^[\s|]+/, '').trim();
      if (rest) currentLines.push(rest);
    } else if (currentDate) {
      currentLines!.push(line);
    }
  }
  if (currentDate) groups.push({ date: currentDate, lines: currentLines! });

  const transactions: ExpenseTransaction[] = [];

  for (const { date, lines: contentLines } of groups) {
    // Within a date block, each transaction ends at the line carrying its
    // (amount, balance) pair — split the block wherever that occurs.
    let buffer: string[] = [];
    for (const line of contentLines) {
      buffer.push(line);
      const floatMatches = line.match(/[\d,]+\.\d{2}/g);
      if (!floatMatches || floatMatches.length < 2) continue;

      const balance = parseAmount(floatMatches[floatMatches.length - 1]);
      const amount = parseAmount(floatMatches[floatMatches.length - 2]);
      const description = buffer.slice(0, -1).join(' ').trim();
      buffer = [];
      if (!description) continue;

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
  }

  return transactions;
}
