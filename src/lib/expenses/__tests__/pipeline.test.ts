import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/expenses/sheets', () => ({
  getExpenseIds: vi.fn(),
  getExpenseRules: vi.fn(),
  appendExpenses: vi.fn(),
  getExpenses: vi.fn(),
}));

vi.mock('@/lib/retirement/sheets', () => ({
  getCpfTransactionKeys: vi.fn(),
  appendCpfTransactions: vi.fn(),
  upsertCpfBalance: vi.fn(),
}));

vi.mock('pdf-parse', () => ({ default: vi.fn() }));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    readdirSync: vi.fn(),
    readFileSync: vi.fn().mockReturnValue(Buffer.from('')),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(true),
  };
});

// Control parser output without needing real PDFs
vi.mock('@/lib/expenses/parsers/uob-deposit', () => ({ parseUOBDeposit: vi.fn() }));
vi.mock('@/lib/expenses/detect', () => ({ detectStatementType: vi.fn() }));

import { importStatements } from '@/lib/expenses/pipeline';
import { getExpenseIds, getExpenseRules, appendExpenses, getExpenses } from '@/lib/expenses/sheets';
import { getCpfTransactionKeys, appendCpfTransactions } from '@/lib/retirement/sheets';
import { readdirSync, existsSync, mkdirSync } from 'fs';
import pdfParse from 'pdf-parse';
import { parseUOBDeposit } from '@/lib/expenses/parsers/uob-deposit';
import { detectStatementType } from '@/lib/expenses/detect';
import type { ExpenseTransaction } from '@/types';

function makeTx(id: string): ExpenseTransaction {
  return {
    id,
    date: '2026-03-01',
    postDate: '2026-03-01',
    description: 'GRAB SG',
    amount: 10,
    direction: 'debit',
    balance: null,
    account: 'UOB',
    category: 'Other',
    sourceFile: 'test.pdf',
  };
}

beforeEach(() => {
  vi.mocked(getExpenseRules).mockResolvedValue([]);
  vi.mocked(appendExpenses).mockResolvedValue(undefined);
  vi.mocked(getExpenses).mockResolvedValue([]);
  vi.mocked(getCpfTransactionKeys).mockResolvedValue(new Set());
  vi.mocked(appendCpfTransactions).mockResolvedValue(undefined);
  vi.mocked(detectStatementType).mockReturnValue('uob-deposit');
  vi.mocked(pdfParse).mockResolvedValue({ text: 'customer.service@uobgroup.com stub' } as any);
  vi.mocked(readdirSync).mockReturnValue(['stmt.pdf'] as any);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('importStatements — all new', () => {
  it('imports all transactions and calls appendExpenses once with all rows', async () => {
    vi.mocked(getExpenseIds).mockResolvedValue(new Set());
    vi.mocked(parseUOBDeposit).mockReturnValue([makeTx('id1'), makeTx('id2')]);

    const result = await importStatements('/fake/folder');

    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(vi.mocked(appendExpenses)).toHaveBeenCalledOnce();
    expect(vi.mocked(appendExpenses).mock.calls[0][0]).toHaveLength(2);
  });
});

describe('importStatements — all duplicates', () => {
  it('skips all transactions already in the sheet', async () => {
    vi.mocked(getExpenseIds).mockResolvedValue(new Set(['id1', 'id2']));
    vi.mocked(parseUOBDeposit).mockReturnValue([makeTx('id1'), makeTx('id2')]);

    const result = await importStatements('/fake/folder');

    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(vi.mocked(appendExpenses).mock.calls[0][0]).toHaveLength(0);
  });
});

describe('importStatements — one file throws', () => {
  it('records the error and continues processing other files', async () => {
    vi.mocked(readdirSync).mockReturnValue(['bad.pdf', 'good.pdf'] as any);
    vi.mocked(pdfParse)
      .mockRejectedValueOnce(new Error('corrupt PDF'))
      .mockResolvedValueOnce({ text: 'customer.service@uobgroup.com stub' } as any);
    vi.mocked(getExpenseIds).mockResolvedValue(new Set());
    vi.mocked(parseUOBDeposit).mockReturnValue([makeTx('id1')]);

    const result = await importStatements('/fake/folder');

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].file).toBe('bad.pdf');
    expect(result.errors[0].message).toBe('corrupt PDF');
    expect(result.imported).toBe(1);
  });
});

describe('importStatements — folder passed is Pending itself, not its parent', () => {
  it('throws without creating a Processed dir nested inside Pending', async () => {
    vi.mocked(existsSync).mockReturnValueOnce(false);

    await expect(importStatements('/fake/folder/Pending')).rejects.toThrow(/Pending/);
    expect(vi.mocked(mkdirSync)).not.toHaveBeenCalled();
  });
});

describe('importStatements — within-run dedup', () => {
  it('does not import the same id twice even if two files produce it', async () => {
    vi.mocked(readdirSync).mockReturnValue(['a.pdf', 'b.pdf'] as any);
    vi.mocked(pdfParse).mockResolvedValue({ text: 'customer.service@uobgroup.com stub' } as any);
    vi.mocked(getExpenseIds).mockResolvedValue(new Set());
    // Both files produce the same transaction id
    vi.mocked(parseUOBDeposit).mockReturnValue([makeTx('dup')]);

    const result = await importStatements('/fake/folder');

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
  });
});

describe('importStatements — balance continuity', () => {
  it('reports a continuity issue involving the newly-imported row', async () => {
    vi.mocked(getExpenseIds).mockResolvedValue(new Set());
    const newTx: ExpenseTransaction = {
      id: 'new1', date: '2026-03-02', postDate: '2026-03-02', description: 'GRAB SG',
      amount: 10, direction: 'debit', balance: 82.39, account: 'UOB', category: 'Other', sourceFile: 'test.pdf',
    };
    vi.mocked(parseUOBDeposit).mockReturnValue([newTx]);
    // full sheet (post-append) includes the pre-existing row this new row chains from
    vi.mocked(getExpenses).mockResolvedValue([
      { id: 'old1', date: '2026-03-01', postDate: '2026-03-01', description: 'PRIOR', amount: 5, direction: 'debit', balance: 990, account: 'UOB', category: 'Other', sourceFile: 'old.pdf' },
      newTx,
    ]);

    const result = await importStatements('/fake/folder');

    expect(result.continuityIssues).toHaveLength(1);
    expect(result.continuityIssues[0].id).toBe('new1');
    expect(result.continuityIssues[0].expectedBalance).toBeCloseTo(980, 5);
  });

  it('does not call getExpenses when there are no new rows', async () => {
    vi.mocked(getExpenseIds).mockResolvedValue(new Set(['id1']));
    vi.mocked(parseUOBDeposit).mockReturnValue([makeTx('id1')]);

    const result = await importStatements('/fake/folder');

    expect(result.continuityIssues).toEqual([]);
    expect(vi.mocked(getExpenses)).not.toHaveBeenCalled();
  });
});

describe('importStatements — rule-based exclusion at import time', () => {
  it('writes excluded: true for a row matching the built-in HIB- $1.00 rule', async () => {
    vi.mocked(getExpenseIds).mockResolvedValue(new Set());
    const junkTx: ExpenseTransaction = {
      id: 'junk1', date: '2026-03-01', postDate: '2026-03-01',
      description: 'TO 4835 8500 2021 9896 HIB- 705173X278960 REF IB08-31946',
      amount: 1.00, direction: 'debit', balance: 12986.08, account: 'HSBC Composite', category: 'Other', sourceFile: 'test.pdf',
    };
    vi.mocked(parseUOBDeposit).mockReturnValue([junkTx]);

    await importStatements('/fake/folder');

    const written = vi.mocked(appendExpenses).mock.calls[0][0];
    expect(written).toHaveLength(1);
    expect(written[0].excluded).toBe(true);
  });

  it('does not exclude an unrelated transaction', async () => {
    vi.mocked(getExpenseIds).mockResolvedValue(new Set());
    vi.mocked(parseUOBDeposit).mockReturnValue([makeTx('id1')]);

    await importStatements('/fake/folder');

    const written = vi.mocked(appendExpenses).mock.calls[0][0];
    expect(written[0].excluded).toBe(false);
  });
});
