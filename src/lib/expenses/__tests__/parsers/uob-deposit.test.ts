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
