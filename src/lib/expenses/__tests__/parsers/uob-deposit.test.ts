import { describe, it, expect } from 'vitest';
import { parseUOBDeposit } from '@/lib/expenses/parsers/uob-deposit';

const FIXTURE = `
Period: 01 Mar 2026 to 31 Mar 2026

Some account overview content that should be ignored.

Account Transaction Details

Lady's Savings A/c 779-XXX-XXX-X

Date  Description  Withdrawals SGD  Deposits SGD  Balance SGD

BALANCE B/F

5000.00

02 Mar

Inward Credit-FAST
xxxxxx0065

1000.00

6000.00

09 Mar

GRAB*GRAB SG
xxxxxx1234

17.50

5982.50

15 Mar

NTUC FAIRPRICE
xxxxxx5678

85.30

5897.20

United Overseas Bank Limited  80 Raffles Place Singapore 048624
`;

describe('parseUOBDeposit', () => {
  const result = parseUOBDeposit(FIXTURE, 'eStatement.pdf');

  it('returns 3 transactions (BALANCE B/F excluded)', () => {
    expect(result).toHaveLength(3);
  });

  it('first transaction is credit (inward transfer increases balance)', () => {
    expect(result[0].direction).toBe('credit');
  });

  it('first transaction has correct date, amount, balance', () => {
    expect(result[0].date).toBe('2026-03-02');
    expect(result[0].amount).toBe(1000);
    expect(result[0].balance).toBe(6000);
  });

  it('first transaction description has no ref line', () => {
    expect(result[0].description).toBe('Inward Credit-FAST');
  });

  it('second transaction is debit (purchase decreases balance)', () => {
    expect(result[1].direction).toBe('debit');
    expect(result[1].date).toBe('2026-03-09');
    expect(result[1].amount).toBe(17.5);
    expect(result[1].description).toBe('GRAB*GRAB SG');
  });

  it('third transaction is debit', () => {
    expect(result[2].direction).toBe('debit');
    expect(result[2].description).toBe('NTUC FAIRPRICE');
  });

  it('all transactions have correct account', () => {
    expect(result.every(t => t.account === "UOB Lady's Savings")).toBe(true);
  });

  it('all transactions have balance populated', () => {
    expect(result.every(t => t.balance !== null)).toBe(true);
  });

  it('all ids are 16-char hex strings', () => {
    expect(result.every(t => /^[0-9a-f]{16}$/.test(t.id))).toBe(true);
  });

  it('all ids are unique', () => {
    const ids = result.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('parseUOBDeposit — foreign-currency (JPY) wallet section', () => {
  // Real UOB One "FX+" statements print a JPY-denominated sub-account whose own
  // Withdrawals/Deposits/Balance columns are in JPY, but each foreign debit-card line
  // also carries the already-converted SGD figure inline (e.g. "SGD 13.51").
  const text = `
Account Transaction Details
One Account 779-XXX-XXX-X
FX+   761-939-935-1
DateDescription
Withdrawals
JPY
Deposits
JPY
Balance
JPY
01 Jun
BALANCE B/F
119,994.00
10 Jun
Misc DR-Debit Card
SGD 12.36
07 JUN 6363 5255635
KEIHINKYUKODENTETSU JO   KANAGAWAKEN
JP
1,530.00118,464.00
13 Jun
Misc DR-Debit Card
SGD 13.51
08 JUN 6363 2565805
SEVEN-ELEVEN             TOKYO        JP
1,672.00115,572.00
United Overseas Bank Limited
`;

  const result = parseUOBDeposit(text, 'eStatement.pdf');

  it('uses the printed SGD equivalent, not the JPY figure, as amount', () => {
    expect(result).toHaveLength(2);
    expect(result[0].amount).toBe(12.36);
    expect(result[1].amount).toBe(13.51);
  });

  it('does not leak the SGD line into the description twice', () => {
    expect(result[1].description).toContain('SEVEN-ELEVEN');
  });
});

describe('parseUOBDeposit — SGD section boundaries around a JPY wallet', () => {
  // Reproduces the real ~Jun 2026 One Account statement shape: an SGD main section,
  // then a JPY FX+ wallet sub-section, then back to SGD — each with its own
  // "BALANCE B/F" line. Regression coverage for two bugs:
  //  1. wallet balance (JPY) must not leak into the SGD balance-continuity chain
  //     (assert `balance: null` on wallet rows).
  //  2. `prevBalance` must reseed at each B/F boundary — otherwise the first row of
  //     a new section computes its direction against the *previous* section's
  //     currency figure, which can flip debit/credit (see the return-to-SGD case
  //     below, engineered so the un-seeded chain would wrongly call it a debit).
  const text = `
Account Transaction Details
One Account 779-XXX-XXX-X
01 Jun
BALANCE B/F
50000.00
05 Jun
GRAB*GRAB SG
xxxxxx1234
17.50
49982.50
08 Jun
Salary
xxxxxx0001
5000.00
54982.50
01 Jun
BALANCE B/F
119994.00
10 Jun
Misc DR-Debit Card
SGD 12.36
07 JUN 6363 5255635
KEIHINKYUKODENTETSU JO   KANAGAWAKEN
JP
1530.00118464.00
13 Jun
Misc DR-Debit Card
SGD 13.51
08 JUN 6363 2565805
SEVEN-ELEVEN             TOKYO        JP
1672.00115572.00
01 Jun
BALANCE B/F
54982.50
20 Jun
Inward Credit-FAST
xxxxxx9999
500.00
55482.50
United Overseas Bank Limited
`;

  const result = parseUOBDeposit(text, 'eStatement3.pdf');

  it('returns 5 transactions (all 3 BALANCE B/F rows excluded)', () => {
    expect(result).toHaveLength(5);
  });

  it('SGD rows before the wallet section keep real balances and correct directions', () => {
    expect(result[0].description).toBe('GRAB*GRAB SG');
    expect(result[0].direction).toBe('debit');
    expect(result[0].balance).toBe(49982.5);

    expect(result[1].description).toBe('Salary');
    expect(result[1].direction).toBe('credit');
    expect(result[1].balance).toBe(54982.5);
  });

  it('wallet rows have balance: null, correct SGD amount, correct debit direction', () => {
    expect(result[2].amount).toBe(12.36);
    expect(result[2].direction).toBe('debit');
    expect(result[2].balance).toBeNull();

    expect(result[3].amount).toBe(13.51);
    expect(result[3].direction).toBe('debit');
    expect(result[3].balance).toBeNull();
  });

  it('first SGD row after returning from the wallet section reseeds direction from its own B/F, not the leftover JPY balance', () => {
    expect(result[4].description).toBe('Inward Credit-FAST');
    expect(result[4].direction).toBe('credit');
    expect(result[4].balance).toBe(55482.5);
  });
});

describe('parseUOBDeposit — transaction spanning a page break', () => {
  // Reproduces the real Jan 2026 One Account statement: each page repeats
  // "One Account   779-358-006-5 (continued)" as its header. If that line isn't
  // filtered, it leaks into the trailing (last) transaction group open when the
  // page breaks, corrupts the amount/balance concat-float parse, and the whole
  // transaction is silently dropped (< 2 floats found → skipped).
  const text = `
Account Transaction Details
One Account   779-358-006-5
01 Jan
BALANCE B/F
3547.41
12 Jan
Funds Transfer
mBK-7623756967
10,000.003,547.41
United Overseas Bank Limited
Page 5 of 9
Account Transaction Details
One Account   779-358-006-5 (continued)
DateDescription
Withdrawals
SGD
Deposits
SGD
Balance
SGD
12 Jan
NETS Debit-Consumer
BAI LI XIAN09464257
xxxxxx0065
5.203,542.21
`;

  const result = parseUOBDeposit(text, 'eStatement2.pdf');

  it('captures the transaction whose group closes right at the page break', () => {
    expect(result).toHaveLength(2);
    expect(result[0].description).toBe('Funds Transfer mBK-7623756967');
    expect(result[0].direction).toBe('debit');
    expect(result[0].amount).toBe(10000);
    expect(result[0].balance).toBe(3547.41);
  });

  it('does not leak the repeated "(continued)" header into the next description', () => {
    expect(result[1].description).toBe('NETS Debit-Consumer BAI LI XIAN09464257');
  });
});

describe('parseUOBDeposit — year boundary', () => {
  const decText = `
Period: 01 Dec 2025 to 01 Jan 2026
Account Transaction Details
One Account 779-XXX-XXX-X
BALANCE B/F
1000.00
28 Dec
GRAB SG
xxxxxx1111
15.00
985.00
United Overseas Bank Limited
`;

  it('assigns prior year to December transaction in January statement', () => {
    const result = parseUOBDeposit(decText, 'eStatement2.pdf');
    expect(result[0].date.startsWith('2025-12')).toBe(true);
  });

  it('detects One Account from text', () => {
    const result = parseUOBDeposit(decText, 'eStatement2.pdf');
    expect(result[0].account).toBe('UOB One Account');
  });
});
