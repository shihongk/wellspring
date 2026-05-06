import { ExpenseTransaction } from '@/types';
import { generateId, parseDDMMMYYYY, directionFromDelta, parseAmount } from '../utils';

const DATE_ANCHOR_RE = /^\d{2}[A-Z][a-z]{2}\d{4}/;
const CARRY_RE = /BALANCE\s*(?:BROUGHT|CARRIED)\s*FORWARD/i;
const SAVINGS_START_RE = /EVERYDAY\s+GLOBAL\s+ACC|Premier\s+Savings|Current\s+and\s+Savings/i;
const SECURITIES_START_RE = /^SECURITIES\s*[&\s]*UNIT\s*TRUSTS(?!\s*\(see)/i;
const SKIP_RE = /TOTAL\s+RELATIONSHIP\s+BALANCE|END\s+OF\s+STATEMENT/i;

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

  // Group lines by date anchor
  const groups: string[][] = [];
  let current: string[] | null = null;
  for (const line of lines) {
    if (CARRY_RE.test(line) || SKIP_RE.test(line)) continue;
    if (DATE_ANCHOR_RE.test(line)) {
      if (current) groups.push(current);
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) groups.push(current);

  const transactions: ExpenseTransaction[] = [];

  for (const group of groups) {
    const [dateLine, ...contentLines] = group;
    if (!contentLines.length) continue;

    // Last line contains: amount balance (two floats at end)
    const lastLine = contentLines[contentLines.length - 1];
    const floatMatches = lastLine.match(/[\d,]+\.\d{2}/g);
    if (!floatMatches || floatMatches.length < 2) continue;

    const balance = parseAmount(floatMatches[floatMatches.length - 1]);
    const amount = parseAmount(floatMatches[floatMatches.length - 2]);

    const description = contentLines.slice(0, -1).join(' ').trim();
    if (!description) continue;

    const date = parseDDMMMYYYY(dateLine.slice(0, 9));
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
