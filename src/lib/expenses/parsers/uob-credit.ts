import { ExpenseTransaction } from '@/types';
import { generateId, parseDDMMM, inferYear, parseAmount, isCreditFromSuffix } from '../utils';

// Old format: date alone on its own line
const DATE_ANCHOR = /^\d{2}\s+[A-Z]{3}$/;
// New format: "DD MMM DD MMM DESCRIPTION [AMOUNT]" all on one line
const INLINE_TX_RE = /^(\d{2}\s+[A-Z]{3})\s+(\d{2}\s+[A-Z]{3})\s+(.*)/;
const FLOAT_RE = /^[\d,]+\.\d{2}(?:CR)?$/i;
// Amount embedded at end of description with no space, e.g. "GIRO PAYMENT307.51CR"
const TRAILING_AMOUNT_RE = /([\d,]+\.\d{2}(?:CR)?)$/i;
const REF_LINE = /^Ref No\./i;
const SKIP_LINE = /^(SUB\s*TOTAL|TOTAL\s+BALANCE\s+FOR|PREVIOUS\s+BALANCE|-{3,}|Post\s+Trans|Date\s+Date)/i;

// U+2019 right single quotation mark + ASCII apostrophe both handled
const CARD_PATTERNS: Array<{ re: RegExp; account: string }> = [
  { re: /^PREFERRED VISA$/, account: 'UOB Preferred Visa' },
  { re: /^UOB ONE CARD$/, account: 'UOB One Card' },
  { re: /^LADY[’']S CARD$/i, account: "UOB Lady's Card" },
];

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

function resolveDate(raw: string, year: number, endMonth: number): string {
  const nominal = parseDDMMM(raw, year);
  const txMonth = parseInt(nominal.split('-')[1], 10);
  const txYear = inferYear(txMonth, endMonth, year);
  return txYear !== year ? parseDDMMM(raw, txYear) : nominal;
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

    const inlineMatch = line.match(INLINE_TX_RE);
    const oldFormat = !inlineMatch && DATE_ANCHOR.test(line) && lines[i + 1] && DATE_ANCHOR.test(lines[i + 1]);

    if (inlineMatch || oldFormat) {
      let postDateRaw: string;
      let transDateRaw: string;
      let rest = '';

      if (inlineMatch) {
        postDateRaw = inlineMatch[1];
        transDateRaw = inlineMatch[2];
        rest = inlineMatch[3].trim();
        i++;
      } else {
        postDateRaw = line;
        transDateRaw = lines[i + 1];
        i += 2;
      }

      const descLines: string[] = [];
      let amountRaw: string | null = null;

      // Check for amount embedded at end of the inline description
      if (rest) {
        const trailingMatch = rest.match(TRAILING_AMOUNT_RE);
        if (trailingMatch) {
          amountRaw = trailingMatch[1];
          rest = rest.slice(0, rest.length - trailingMatch[0].length).trim();
        }
        if (rest) descLines.push(rest);
      }

      if (amountRaw === null) {
        while (i < lines.length) {
          const cur = lines[i];
          if (INLINE_TX_RE.test(cur)) break;
          if (DATE_ANCHOR.test(cur) && lines[i + 1] && DATE_ANCHOR.test(lines[i + 1])) break;
          if (SKIP_LINE.test(cur)) { i++; break; }
          if (FLOAT_RE.test(cur)) { amountRaw = cur; i++; break; }
          if (!REF_LINE.test(cur)) descLines.push(cur);
          i++;
        }
      }

      if (amountRaw === null || descLines.length === 0) continue;

      const description = descLines.join(' ').trim();
      const amount = parseAmount(amountRaw);
      const postDate = resolveDate(postDateRaw, year, endMonth);
      const date = resolveDate(transDateRaw, year, endMonth);
      const isCredit = isCreditFromSuffix(amountRaw) || description.toUpperCase().includes('GIRO PAYMENT');
      const direction: 'debit' | 'credit' = isCredit ? 'credit' : 'debit';

      transactions.push({
        id: generateId(date, description, amount, account),
        date,
        postDate,
        description,
        amount,
        direction,
        balance: null,
        account,
        category: 'Other',
        sourceFile: filename,
      });
    } else {
      i++;
    }
  }

  return transactions;
}

export function parseUOBCredit(text: string, filename: string): ExpenseTransaction[] {
  const year = extractYear(text);
  const endMonth = extractEndMonth(text);
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const sections: Array<{ account: string; start: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    for (const { re, account } of CARD_PATTERNS) {
      if (re.test(lines[i])) {
        sections.push({ account, start: i + 1 });
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
