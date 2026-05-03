import { ExpenseTransaction } from '@/types';
import { generateId, parseDDMMM, inferYear, parseAmount, isCreditFromSuffix } from '../utils';

const MONTHS: Record<string, number> = {
  jan:1, feb:2, mar:3, apr:4, may:5, jun:6,
  jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
};

// Matches start of a line with a date: "31Mar", "31 Mar", "04 APR" etc.
const DATE_ANCHOR_RE = /^\d{2}\s?[A-Za-z]{3}/;
// Lines to discard entirely before grouping — sidebar boxes, rewards, boilerplate
const SIDEBAR_RE = /^(Previous\s+Statement\s+Balance|Payments?\s*&?\s*Credits?|Purchases\s*&\s*Debits|GST\s+(Charges|Reversals)|Total\s+Account\s+Balance|REWARDS\s+SUMMARY|Points\s+(Carried|Earned|Redeemed|Expired|Adjusted|Expiring)|Total\s+Points|Log\s+on\s+to|Continued\s+on\s+next|Minimum\s+Payment|MR\s+[A-Z]|\d+\s+[A-Z]+\s+STREET|#\d+-\d+|SINGAPORE\s+\d{6}|Change\s+of\s+personal|Bill\s+payment|Late\s+charge|Overlimit|Cash\s+advance\s+charge|HSBC\s+Singapore\s+(Fraud|app)|Important\s+Information|Repayment\s+grace|Cardholder|Please\s+(allow|examine|settle|read|note)|If\s+(the\s+(card|minimum|current)|you\s+do)|You\s+can|Pay\s+(your|with)|www\.|For\s+(more|full|information)|Download|Issued\s+by|This\s+information|Interest\s*\/?\s*Finance|Deposit\s+Insurance|Market\s+value)/i;
// Other non-transaction lines to skip
const SKIP_RE = /^(Total\s+Due|CREDIT\s+LIMIT|POST\s+TRAN|DATE\s+DATE|Statement\s+Date|Account\s+Number|CONTACT\s+US|Customer\s+Service|From\s+Overseas|GST\s+REG)/i;

// Strip rewards/address content that bleeds onto the same OCR line as a transaction
// (two-column layout: transaction on left, rewards summary on right, OCR merges them)
function stripInlineSidebar(s: string): string {
  return s
    .replace(/\s*\bPoints\s+(?:Carried\s+Forward|Earned|Redeemed|Expired|Adjusted|Expiring).*$/i, '')
    .replace(/\s*\bTotal\s+Points.*$/i, '')
    .replace(/\s*\bREWARDS\s+SUMMARY.*$/i, '')
    .replace(/\s*\bContinued\s+on\s+next\s+page.*$/i, '')
    .replace(/\s+(?:Singapore\s+)?SG\s*$/i, '')
    .trim();
}

function extractYear(text: string, filename: string): number {
  // Require year to follow a month name to avoid matching card numbers like 4835-8500-2021-9896
  const m = text.match(/\b[A-Za-z]{3}\s+(20\d{2})\b/);
  if (m) return parseInt(m[1], 10);
  const fn = filename.match(/^(20\d{2})-\d{2}-\d{2}/);
  if (fn) return parseInt(fn[1], 10);
  return new Date().getFullYear();
}

function extractEndMonth(text: string, filename: string): number {
  // Look for the statement end date: "to DD MON YYYY" or last date in header
  const toMatch = text.match(/\bto\s+\d{1,2}\s+([A-Za-z]{3})\s+20\d{2}\b/i);
  if (toMatch) {
    const month = MONTHS[toMatch[1].toLowerCase()];
    if (month) return month;
  }
  const fn = filename.match(/^20\d{2}-(\d{2})-\d{2}/);
  if (fn) return parseInt(fn[1], 10);
  return 12;
}

function extractAccount(text: string): string {
  return /REVOLUTION/i.test(text) ? 'HSBC Revolution' : 'HSBC Premier';
}

export function parseHSBCCredit(text: string, filename: string): ExpenseTransaction[] {
  const year = extractYear(text, filename);
  const endMonth = extractEndMonth(text, filename);
  const account = extractAccount(text);

  const lines = text.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !SIDEBAR_RE.test(l) && !SKIP_RE.test(l));

  const groups: string[][] = [];
  let current: string[] | null = null;
  for (const line of lines) {
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
    // Join all lines, strip sidebar/boilerplate that bleeds in from the two-column layout
    const combined = stripInlineSidebar(group.join(' ').replace(/\s+/g, ' ').trim());

    // Extract post date from start: "31Mar" or "31 Mar"
    const postMatch = combined.match(/^(\d{2})\s?([A-Za-z]{3})\s+/);
    if (!postMatch) continue;
    const postDateStr = `${postMatch[1]} ${postMatch[2]}`;
    let rest = combined.slice(postMatch[0].length);

    // Skip trans date — may be preceded by OCR noise characters (e.g. "~~ 02Apr")
    const transMatch = rest.match(/^[^A-Za-z0-9]*(\d{2})\s?([A-Za-z]{3})\s+/);
    if (transMatch && transMatch.index === 0) rest = rest.slice(transMatch[0].length);

    // Find the first decimal amount — sidebar text often trails after the real amount
    const amountMatch = rest.match(/([\d,]+\.\d{2}(?:CR)?)/i);
    if (!amountMatch || amountMatch.index === undefined) continue;
    const amountRaw = amountMatch[1];
    const description = rest.slice(0, amountMatch.index).trim();
    if (!description) continue;

    const isCredit = isCreditFromSuffix(amountRaw);
    const amount = parseAmount(amountRaw);
    const direction: 'debit' | 'credit' = isCredit ? 'credit' : 'debit';

    const nominal = parseDDMMM(postDateStr, year);
    const txMonth = parseInt(nominal.split('-')[1], 10);
    const txYear = inferYear(txMonth, endMonth, year);
    const date = txYear !== year ? parseDDMMM(postDateStr, txYear) : nominal;

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

  return transactions;
}
