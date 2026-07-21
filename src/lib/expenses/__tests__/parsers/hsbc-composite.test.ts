import { describe, it, expect } from 'vitest';
import { parseHSBCComposite } from '@/lib/expenses/parsers/hsbc-composite';

// Realistic OCR output: savings section with 2 transactions, then securities section
const FIXTURE = `
HSBC COMPOSITE STATEMENT

Your Portfolio at a Glance

Premier Savings Account

BALANCE BROUGHT FORWARD
12345.67

19Mar2026
SGV19036MB76M5VK
FAST PAYMENT RECEIPT
Khor Shihong
123.45 12469.12

25Mar2026
GRAB SINGAPORE PTE LTD
DEBIT PURCHASE
34.56 12434.56

SECURITIES & UNIT TRUSTS

SOME SECURITIES ROW THAT SHOULD NOT APPEAR
`;

describe('parseHSBCComposite', () => {
  const result = parseHSBCComposite(FIXTURE, '2026-04-07_Statement.pdf');

  it('returns exactly 2 transactions (securities section excluded)', () => {
    expect(result).toHaveLength(2);
  });

  it('first transaction is credit (balance increased from opening)', () => {
    // 12345.67 → 12469.12: balance increased
    expect(result[0].direction).toBe('credit');
  });

  it('first transaction has correct date, amount, balance', () => {
    expect(result[0].date).toBe('2026-03-19');
    expect(result[0].amount).toBe(123.45);
    expect(result[0].balance).toBe(12469.12);
  });

  it('second transaction is debit (balance decreased)', () => {
    // 12469.12 → 12434.56: balance decreased
    expect(result[1].direction).toBe('debit');
    expect(result[1].amount).toBe(34.56);
    expect(result[1].balance).toBe(12434.56);
  });

  it('multi-line description is collapsed to a single string', () => {
    expect(result[0].description).toBe('SGV19036MB76M5VK FAST PAYMENT RECEIPT Khor Shihong');
  });

  it('second transaction description collapsed correctly', () => {
    expect(result[1].description).toBe('GRAB SINGAPORE PTE LTD DEBIT PURCHASE');
  });

  it('securities section rows do not appear in output', () => {
    expect(result.every(t => !t.description.includes('SECURITIES'))).toBe(true);
  });

  it('balance populated for all transactions', () => {
    expect(result.every(t => t.balance !== null)).toBe(true);
  });

  it('all transactions assigned to HSBC Savings', () => {
    expect(result.every(t => t.account === 'HSBC Savings')).toBe(true);
  });

  it('all ids are unique 16-char hex strings', () => {
    const ids = result.map(t => t.id);
    expect(ids.every(id => /^[0-9a-f]{16}$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('parseHSBCComposite — multiple transactions under one date anchor', () => {
  // HSBC only prints the date once per day; a page-break disclaimer block can also
  // land between the date anchor and the first transaction. Both must not merge
  // separate transactions into one or leak into descriptions.
  const text = `
Premier Savings Account

BALANCE BROUGHT FORWARD
9680.25

05May2026
UOB CARD CENTRE
COLL REF YPB2-64563 82.39 9,597.86

Deposit Insurance Scheme
Singapore dollar deposits of non-bank depositors are insured by the Singapore Deposit Insurance Corporation.
Issued by HSBC Bank (Singapore) Limited ("HSBC").
Composite Statement
Branch Name: CLAYMORE BRANCH
Page 3 of 4
Statement Date 07MAY2026
Customer Number 043-336189
Sequence Number 12

UOB CARD CENTRE
COLL REF YPB0-64534 277.54 9,320.32

EVERYDAY+ BONUS INTEREST
REF ZDD4-00017 4.69 9,325.01

SECURITIES & UNIT TRUSTS
IGNORED
`;

  const result = parseHSBCComposite(text, '2026-05-07_Statement.pdf');

  it('splits into 3 separate transactions, not 1', () => {
    expect(result).toHaveLength(3);
  });

  it('each transaction keeps its own amount and balance', () => {
    expect(result[0]).toMatchObject({ date: '2026-05-05', amount: 82.39, balance: 9597.86, direction: 'debit' });
    expect(result[1]).toMatchObject({ date: '2026-05-05', amount: 277.54, balance: 9320.32, direction: 'debit' });
    expect(result[2]).toMatchObject({ date: '2026-05-05', amount: 4.69, balance: 9325.01, direction: 'credit' });
  });

  it('page-break boilerplate does not leak into any description', () => {
    for (const t of result) {
      expect(t.description).not.toMatch(/Deposit Insurance|Composite Statement|Branch Name|Statement Date|Customer Number|Sequence Number/i);
    }
  });

  it('ids are unique', () => {
    const ids = result.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('parseHSBCComposite — page-break header repeats (name/address, account section, column headers)', () => {
  // Different page-break rendering than the disclaimer-block fixture above: name/address
  // block, "Statement Details" box, a repeated "EVERYDAY GLOBAL ACC" section header, and
  // the column-header row all appear between two transactions on a real July statement.
  const text = `
EVERYDAY GLOBAL ACC 043-336189-221

BALANCE BROUGHT FORWARD
11015.44

03Jul2026
UOB CARD CENTRE
COLL REF YPB9-23268 1174.29 9,836.15

Composite Statement
Branch Name: CLAYMORE BRANCH
Page 3 of 3
MR KHOR SHIHONG
605 JURONG WEST STREET 62 Statement Details
#13-213 Statement Date 07JUL2026
SINGAPORE 640605 Customer Number 043-336189
Sequence Number 14
EVERYDAY GLOBAL ACC 043-336189-221
Date Transaction Details Deposits Withdrawals Balance (DR=Debit)
91
Wh. HSBC
pd Premier

UOB CARD CENTRE
COLL
REF YPB1-23278 760.65 9,075.50

CLOSING BALANCE 9,075.50
Transaction Turnover 0.48 1,939.94
Transaction Count 1 10

SECURITIES & UNIT TRUSTS
IGNORED
`;

  const result = parseHSBCComposite(text, '2026-07-07_Statement.pdf');

  it('splits into 2 separate transactions (summary rows excluded)', () => {
    expect(result).toHaveLength(2);
  });

  it('does not mistake "Transaction Turnover" for a transaction', () => {
    expect(result.some(t => /Turnover|CLOSING BALANCE/i.test(t.description))).toBe(false);
    expect(result.some(t => t.amount === 0.48)).toBe(false);
  });

  it('second transaction description contains only the real content (plus the bare page-corner number, which is not filtered)', () => {
    expect(result[1].description).toBe('91 UOB CARD CENTRE COLL');
  });

  it('none of the page-break header text leaks into descriptions', () => {
    for (const t of result) {
      expect(t.description).not.toMatch(/MR KHOR SHIHONG|Statement Details|EVERYDAY GLOBAL ACC|Transaction Details|Branch Name|Page \d+ of \d+|Wh\.?\s*HSBC|\bPremier\b/i);
    }
  });
});

describe('parseHSBCComposite — logo garble, single-line "X) Premier" variant', () => {
  // OCR renders the HSBC hexagon logo differently across runs — sometimes as two lines
  // ("Wh. HSBC" / "pd Premier", covered above), sometimes combined onto one ("X) Premier").
  // Must not leak into the following transaction's description either way.
  const text = `
Premier Savings Account

BALANCE BROUGHT FORWARD
9680.25

05May2026
UOB CARD CENTRE
COLL REF YPB2-64563 82.39 9,597.86

09

X) Premier
Composite Statement
Page 3 of 4

UOB CARD CENTRE
COLL
REF YPB0-64534 277.54 9,320.32

SECURITIES & UNIT TRUSTS
IGNORED
`;

  it('drops the "X) Premier" fragment without eating the real transaction', () => {
    const result = parseHSBCComposite(text, '2026-05-07_Statement.pdf');
    expect(result).toHaveLength(2);
    expect(result[1].description).not.toMatch(/Premier/i);
    expect(result[1]).toMatchObject({ amount: 277.54, balance: 9320.32 });
  });

  it('does not filter "Premier Savings" itself (used to find the savings section)', () => {
    const result = parseHSBCComposite(text, '2026-05-07_Statement.pdf');
    expect(result).toHaveLength(2); // would be 0 if the whole section got skipped
  });
});

describe('parseHSBCComposite — content sharing the date-anchor line is not dropped', () => {
  // Real OCR: "11May2026 |TO 4835 8500 2021 9896" — the date anchor and the first
  // real content of the transaction (which card the transfer went to) land on the
  // same physical line and must not be silently discarded.
  const text = `
EVERYDAY GLOBAL ACC 043-336189-221

BALANCE BROUGHT FORWARD
13169.75

11May2026 |TO 4835 8500 2021 9896
HIB- 705173X278960
REF IB08-31946 183.67 12,986.08

SECURITIES & UNIT TRUSTS
IGNORED
`;

  const result = parseHSBCComposite(text, '2026-06-06_Statement.pdf');

  it('keeps the content that shared the date-anchor line', () => {
    expect(result).toHaveLength(1);
    expect(result[0].description).toContain('TO 4835 8500 2021 9896');
  });

  it('amount and balance are still correct', () => {
    expect(result[0]).toMatchObject({ date: '2026-05-11', amount: 183.67, balance: 12986.08, direction: 'debit' });
  });
});

describe('parseHSBCComposite — no savings section header', () => {
  const text = `
HSBC COMPOSITE STATEMENT 2026

BALANCE BROUGHT FORWARD
5000.00

01Apr2026
SALARY DEPOSIT
1000.00 6000.00

SECURITIES & UNIT TRUSTS
IGNORED
`;

  it('processes from start when no savings header found', () => {
    const result = parseHSBCComposite(text, '2026-04-07_Statement.pdf');
    expect(result).toHaveLength(1);
    expect(result[0].direction).toBe('credit');
    expect(result[0].date).toBe('2026-04-01');
  });
});
