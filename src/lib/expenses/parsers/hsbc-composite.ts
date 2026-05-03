import { ExpenseTransaction } from '@/types';
import { generateId, parseDDMMMYYYY, directionFromDelta, parseAmount } from '../utils';

// Date at start of line: "19Mar2026" or "19Mar2026 |rest of content"
const DATE_ANCHOR_RE = /^\d{2}[A-Z][a-z]{2}\d{4}/;
const FLOAT_RE = /^[\d,]+\.\d{2}$/;
// Each sub-transaction ends with a REF line: "REF CODE amount balance"
const REF_LINE_RE = /^REF\s+\S+/;
// Carry-forward lines (spaces optional — OCR sometimes merges words)
const CARRY_RE = /BALANCE\s*(?:BROUGHT|CARRIED|CARRED|CARIED)\s*FORWARD/i;
// Lines that are pure boilerplate — page headers, footers, legal text
const BOILERPLATE_RE = /^(TOTAL\s+RELATIONSHIP\s+BALANCE|END\s+OF\s+STATEMENT|CLOSING\s+BALANCE|Deposit\s+Insurance|Singapore\s+dollar\s+deposits|Foreign\s+currency\s+deposits|currency\s+deposits|dual\s+currency|Issued\s+by\s+HSBC|Market\s+value|Transaction\s+(Count|Turnover)|Composite\s+Statement|Branch\s+(Number|Name)|Page\s+\d+\s+of\s+\d+|Statement\s+(Date|Details)|Customer\s+Number|Sequence\s+Number|MR\s+[A-Z]|\d+\s+(?:[A-Z]+\s+)+STREET|#\d+-\d+|SINGAPORE\s+\d{6}|\d{2}$|[-\s]+J\s*$|Wh\.|pd\s+Premier|X\)\s+Premier|^-$)/i;
// Match the actual savings account section header, not the portfolio summary row
const SAVINGS_START_RE = /EVERYDAY\s+GLOBAL\s+ACC|Premier\s+Savings|Current\s+and\s+Savings/i;
// Exclude the portfolio summary row "(see account details)"; match only the page-4 section header
const SECURITIES_START_RE = /^SECURITIES\s*[&\s]*UNIT\s*TRUSTS(?!\s*\(see)/i;
// Continuation page repeats the section header — treat as boilerplate so it doesn't pollute descriptions
const SECTION_HEADER_RE = /^(EVERYDAY\s+GLOBAL\s+ACC|Premier\s+Savings|Date\s+Transaction\s+Details)/i;

export function parseHSBCComposite(text: string, filename: string): ExpenseTransaction[] {
  const account = 'HSBC Savings';
  const allLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Find savings section and securities section boundaries
  let savingsStart = 0;
  let securitiesStart = allLines.length;
  let savingsFound = false;

  for (let i = 0; i < allLines.length; i++) {
    if (!savingsFound && SAVINGS_START_RE.test(allLines[i])) { savingsStart = i + 1; savingsFound = true; }
    if (SECURITIES_START_RE.test(allLines[i]) && i > savingsStart) { securitiesStart = i; break; }
  }

  const lines = allLines.slice(savingsStart, securitiesStart);

  // Opening balance: BALANCE BROUGHT FORWARD may be embedded in a date line
  let prevBalance: number | null = null;
  const bfIdx = lines.findIndex(l => CARRY_RE.test(l) && /BROUGHT/i.test(l));
  if (bfIdx >= 0) {
    for (let i = bfIdx; i < Math.min(bfIdx + 4, lines.length); i++) {
      const tokens = lines[i].split(/\s+/).filter(t => FLOAT_RE.test(t));
      if (tokens.length > 0) { prevBalance = parseAmount(tokens[tokens.length - 1]); break; }
    }
  }

  // Group lines by date anchor, splitting date from any trailing content on the same line
  const groups: string[][] = [];
  let current: string[] | null = null;
  for (const line of lines) {
    if (CARRY_RE.test(line) || BOILERPLATE_RE.test(line) || SECTION_HEADER_RE.test(line)) continue;
    if (DATE_ANCHOR_RE.test(line)) {
      if (current) groups.push(current);
      const datePart = line.slice(0, 9);
      const rest = line.slice(9).replace(/^\s*\|?\s*/, '').trim();
      current = [datePart];
      if (rest) current.push(rest);
    } else if (current) {
      current.push(line);
    }
  }
  if (current) groups.push(current);

  const transactions: ExpenseTransaction[] = [];

  for (const group of groups) {
    const [dateLine, ...content] = group;

    // Split content into sub-transactions: each ends at a REF line
    const subTxns: { descLines: string[]; refLine: string }[] = [];
    let currentDesc: string[] = [];
    for (const line of content) {
      if (REF_LINE_RE.test(line)) {
        subTxns.push({ descLines: currentDesc, refLine: line });
        currentDesc = [];
      } else {
        currentDesc.push(line);
      }
    }

    for (const { descLines, refLine } of subTxns) {
      const floatTokens = refLine.split(/\s+/).filter(t => FLOAT_RE.test(t));
      if (floatTokens.length < 2) continue;

      const balance = parseAmount(floatTokens[floatTokens.length - 1]);
      const amount = parseAmount(floatTokens[floatTokens.length - 2]);

      const description = descLines
        .filter(l => !CARRY_RE.test(l) && !BOILERPLATE_RE.test(l))
        .join(' ')
        .trim();
      if (!description) continue;

      const date = parseDDMMMYYYY(dateLine);
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
