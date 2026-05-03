import { describe, it, expect } from 'vitest';
import { parseUOBCredit } from '@/lib/expenses/parsers/uob-credit';

const FIXTURE = `
Statement Date 30 Apr 2026

Summary page content ignored.

PREFERRED VISA
4567-XXXX-XXXX-1234 KHOR SHIHONG
Post  Trans
Date  Date  Description of Transaction  Transaction Amount SGD

16 MAR

14 MAR

GRAB*SG SINGAPORE
Ref No. : 74541836073456789

17.50

02 APR

02 APR

GIRO PAYMENT

990.00

SUB TOTAL  1007.50
TOTAL BALANCE FOR PREFERRED VISA  1007.50
---

UOB ONE CARD
1234-XXXX-XXXX-5678 KHOR SHIHONG
Post  Trans
Date  Date  Description of Transaction  Transaction Amount SGD

20 MAR

20 MAR

NTUC FAIRPRICE SG
Ref No. : 987654321

125.00

SUB TOTAL  125.00
TOTAL BALANCE FOR UOB ONE CARD  125.00
`;

describe('parseUOBCredit', () => {
  const result = parseUOBCredit(FIXTURE, 'eStatement3.pdf');

  it('returns 3 transactions across 2 cards', () => {
    expect(result).toHaveLength(3);
  });

  it('GRAB transaction is from Preferred Visa', () => {
    const grab = result.find(t => t.description.includes('GRAB'));
    expect(grab?.account).toBe('UOB Preferred Visa');
  });

  it('GRAB transaction has correct dates and amount', () => {
    const grab = result.find(t => t.description.includes('GRAB'));
    expect(grab?.date).toBe('2026-03-14');       // trans date
    expect(grab?.postDate).toBe('2026-03-16');   // post date
    expect(grab?.amount).toBe(17.5);
    expect(grab?.direction).toBe('debit');
  });

  it('Ref No lines are stripped from description', () => {
    const grab = result.find(t => t.description.includes('GRAB'));
    expect(grab?.description).not.toContain('Ref No');
  });

  it('GIRO PAYMENT is direction credit', () => {
    const giro = result.find(t => t.description.includes('GIRO PAYMENT'));
    expect(giro?.direction).toBe('credit');
    expect(giro?.amount).toBe(990);
  });

  it('NTUC transaction is from UOB One Card', () => {
    const ntuc = result.find(t => t.description.includes('NTUC'));
    expect(ntuc?.account).toBe('UOB One Card');
    expect(ntuc?.direction).toBe('debit');
  });

  it('all credit card transactions have null balance', () => {
    expect(result.every(t => t.balance === null)).toBe(true);
  });

  it('all ids are unique', () => {
    const ids = result.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
