import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/expenses/sheets', () => ({
  getExpenseIds: vi.fn(),
  getExpenseRules: vi.fn(),
  appendExpenses: vi.fn(),
}));

vi.mock('pdf-parse', () => ({ default: vi.fn() }));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    readdirSync: vi.fn(),
    readFileSync: vi.fn().mockReturnValue(Buffer.from('')),
  };
});

// Control parser output without needing real PDFs
vi.mock('@/lib/expenses/parsers/uob-deposit', () => ({ parseUOBDeposit: vi.fn() }));
vi.mock('@/lib/expenses/detect', () => ({ detectStatementType: vi.fn() }));

import { importStatements } from '@/lib/expenses/pipeline';
import { getExpenseIds, getExpenseRules, appendExpenses } from '@/lib/expenses/sheets';
import { readdirSync } from 'fs';
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
