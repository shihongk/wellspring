import { ExpenseTransaction } from '@/types';
import { generateId, parseDDMMM, inferYear, parseAmount, isCreditFromParens } from '../utils';

const DATE_ANCHOR = /^\d{2}\s+[A-Z]{3}$/;
const FLOAT_RE = /^[\d,]+\.\d{2}$/;
const PAREN_FLOAT_RE = /^\([\d,]+\.\d{2}\)$/;
const FOREIGN_AMOUNT = /^FOREIGN\s+AMOUNT/i;
const COUNTRY_CODE = /^[A-Z]{2}$/;
const SKIP_LINE = /^(BALANCE\s+PREVIOUS|FAST\s+INCOMING|SUB-TOTAL|GRAND\s+TOTAL|TRANSACTIONS\s+FOR|ALL\s+TRANSACTIONS)/i;

const CARD_PATTERNS: Array<{ re: RegExp; account: string }> = [
  { re: /^CITI REWARDS WORLD MASTERCARD/i, account: 'Citi Rewards' },
  { re: /^CITI CASH BACK PLUS MASTERCARD/i, account: 'Citi Cash Back Plus' },
];

// Concatenated-format helpers (PDFs where text has no spaces, e.g. "CitibankSingapore")
const CONCAT_CARD_PATTERNS: Array<{ re: RegExp; account: string }> = [
  { re: /CITIREWARDSWORLDMASTERCARD\d/i, account: 'Citi Rewards' },
  { re: /CITICASHBACKPLUSMASTERCARD\d/i, account: 'Citi Cash Back Plus' },
];
const CONCAT_TX_RE = /^(\d{2}[A-Z]{3})(.+?)(\([\d,]+\.\d{2}\)|[\d,]+\.\d{2})\s*$/;
const CONCAT_SKIP_RE = /^(BALANCEPREVIOUSSTATEMENT|TRANSACTIONSFORCITI|ALLTRANSACTIONS|SUB-TOTAL|GRANDTOTAL)/i;
const CONCAT_PAYMENT_RE = /FASTINCOMINGPAYMENT/i;

function normalizeConcatDate(s: string): string {
  // '12MAR' → '12 Mar'
  return s.slice(0, 2) + ' ' + s[2] + s.slice(3, 5).toLowerCase();
}

function extractYearConcat(text: string): number {
  const m = text.match(/\b(20\d{2})\b/);
  return m ? parseInt(m[1], 10) : new Date().getFullYear();
}

function extractEndMonthConcat(text: string): number {
  const FULL_MONTHS: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  };
  const m = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)/i);
  return m ? (FULL_MONTHS[m[1].toLowerCase()] ?? 12) : 12;
}

function parseCitiCreditConcat(text: string, filename: string): ExpenseTransaction[] {
  const year = extractYearConcat(text);
  const endMonth = extractEndMonthConcat(text);
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const transactions: ExpenseTransaction[] = [];
  let account = 'Citi Rewards';

  for (const line of lines) {
    for (const { re, account: acc } of CONCAT_CARD_PATTERNS) {
      if (re.test(line)) { account = acc; break; }
    }

    if (CONCAT_SKIP_RE.test(line)) continue;

    const m = CONCAT_TX_RE.exec(line);
    if (!m) continue;

    const [, dateStr, rawDesc, amountRaw] = m;
    if (CONCAT_PAYMENT_RE.test(rawDesc)) continue;

    const description = rawDesc.replace(/[A-Z]{2}$/, '').trim() || rawDesc.trim();
    const isCredit = isCreditFromParens(amountRaw);
    const amount = parseAmount(amountRaw);
    const category = description.toUpperCase().includes('CCYCONVERSIONFEE') ? 'Bank Charges' : 'Other';

    const nominal = parseDDMMM(normalizeConcatDate(dateStr), year);
    const txMonth = parseInt(nominal.split('-')[1], 10);
    const txYear = inferYear(txMonth, endMonth, year);
    const date = txYear !== year ? parseDDMMM(normalizeConcatDate(dateStr), txYear) : nominal;

    transactions.push({
      id: generateId(date, description, amount, account),
      date,
      postDate: date,
      description,
      amount,
      direction: isCredit ? 'credit' : 'debit',
      balance: null,
      account,
      category,
      sourceFile: filename,
    });
  }

  return transactions;
}

const MONTH_NUM: Record<string, number> = {
  jan:1, feb:2, mar:3, apr:4, may:5, jun:6,
  jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
};

function extractYear(text: string): number {
  const m = text.match(/\b\d{1,2}\s+[A-Za-z]{3}\s+(20\d{2})\b/);
  return m ? parseInt(m[1], 10) : new Date().getFullYear();
}

function extractEndMonth(text: string): number {
  const m = text.match(/\b\d{1,2}\s+([A-Za-z]{3})\s+20\d{2}\b/);
  return m ? (MONTH_NUM[m[1].toLowerCase()] ?? 12) : 12;
}

function isAmountLine(line: string): boolean {
  return FLOAT_RE.test(line) || PAREN_FLOAT_RE.test(line);
}

function parseCardSection(
  lines: string[],
  account: string,
  filename: string,
  year: number,
  endMonth: number,
): ExpenseTransaction[] {
  const transactions: ExpenseTransaction[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (SKIP_LINE.test(line)) { i++; continue; }

    if (DATE_ANCHOR.test(line)) {
      i++;
      const descLines: string[] = [];
      let amountRaw: string | null = null;

      while (i < lines.length) {
        const cur = lines[i];
        if (DATE_ANCHOR.test(cur)) break;
        if (SKIP_LINE.test(cur)) { i++; break; }
        if (FOREIGN_AMOUNT.test(cur)) { i++; continue; }
        if (isAmountLine(cur)) { amountRaw = cur; i++; break; }
        if (!COUNTRY_CODE.test(cur)) descLines.push(cur);
        i++;
      }

      if (!amountRaw || descLines.length === 0) continue;

      const description = descLines.join(' ').trim();
      const isCredit = isCreditFromParens(amountRaw);
      const amount = parseAmount(amountRaw);
      const direction: 'debit' | 'credit' = isCredit ? 'credit' : 'debit';
      const category = description.toUpperCase().includes('CCY CONVERSION FEE')
        ? 'Bank Charges'
        : 'Other';

      const nominal = parseDDMMM(line, year);
      const txMonth = parseInt(nominal.split('-')[1], 10);
      const txYear = inferYear(txMonth, endMonth, year);
      const date = txYear !== year ? parseDDMMM(line, txYear) : nominal;

      transactions.push({
        id: generateId(date, description, amount, account),
        date,
        postDate: date,
        description,
        amount,
        direction,
        balance: null,
        account,
        category,
        sourceFile: filename,
      });
    } else {
      i++;
    }
  }

  return transactions;
}

export function parseCitiCredit(text: string, filename: string): ExpenseTransaction[] {
  // Concatenated format: PDF text has no spaces (e.g. "CitibankSingaporeLtd")
  if (/CitibankSingapore[A-Za-z]/i.test(text)) return parseCitiCreditConcat(text, filename);

  const year = extractYear(text);
  const endMonth = extractEndMonth(text);
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const sections: Array<{ account: string; start: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    for (const { re, account } of CARD_PATTERNS) {
      if (re.test(lines[i])) {
        if (sections.length === 0 || sections[sections.length - 1].account !== account) {
          sections.push({ account, start: i + 1 });
        }
        break;
      }
    }
  }

  if (sections.length === 0) return [];

  const transactions: ExpenseTransaction[] = [];
  for (let s = 0; s < sections.length; s++) {
    const start = sections[s].start;
    const end = s + 1 < sections.length ? sections[s + 1].start - 1 : lines.length;
    transactions.push(
      ...parseCardSection(lines.slice(start, end), sections[s].account, filename, year, endMonth),
    );
  }
  return transactions;
}
