'use server';

import { revalidatePath } from 'next/cache';
import {
  upsertHolding,
  deleteHolding,
  appendTransaction,
  getHoldings,
  updateCash,
  upsertCashAccount,
  deleteCashAccount,
  replaceTargetAllocations,
  replaceInvestmentSchedule,
} from '@/lib/google-sheets';
import { computeNewAvgCost } from '@/lib/portfolio';
import { Holding, Transaction, TargetAllocationRow, InvestmentScheduleRow } from '@/types';

export async function upsertHoldingAction(data: Holding): Promise<void> {
  await upsertHolding(data);
  revalidatePath('/dashboard');
  revalidatePath('/holdings');
}

export async function deleteHoldingAction(ticker: string): Promise<void> {
  await deleteHolding(ticker);
  revalidatePath('/dashboard');
  revalidatePath('/holdings');
}

export async function logTransactionAction(data: Omit<Transaction, 'id'>): Promise<void> {
  await appendTransaction(data);

  const holdings = await getHoldings();
  const existing = holdings.find((h) => h.ticker === data.ticker);

  if (data.type === 'BUY') {
    const oldShares = existing?.shares || 0;
    const oldAvg = existing?.avgCostLocal || 0;
    const newAvg = computeNewAvgCost(oldShares, oldAvg, data.shares, data.priceLocal);

    await upsertHolding({
      ticker: data.ticker,
      name: existing?.name || data.ticker,
      shares: oldShares + data.shares,
      avgCostLocal: newAvg,
      currency: data.currency,
    });
  } else if (data.type === 'SELL') {
    if (existing) {
      const newShares = existing.shares - data.shares;
      if (newShares <= 0) {
        await deleteHolding(data.ticker);
      } else {
        await upsertHolding({
          ...existing,
          shares: newShares,
          // Avg cost doesn't change on SELL
        });
      }
    }
  }

  revalidatePath('/dashboard');
  revalidatePath('/holdings');
  revalidatePath('/transactions');
}

export async function updateCashAction(amount: number): Promise<void> {
  await updateCash(amount);
  revalidatePath('/dashboard');
  revalidatePath('/cash');
}

export async function upsertCashAccountAction(account: string, amount: number): Promise<void> {
  await upsertCashAccount(account, amount);
  revalidatePath('/dashboard');
  revalidatePath('/cash');
}

export async function deleteCashAccountAction(account: string): Promise<void> {
  await deleteCashAccount(account);
  revalidatePath('/dashboard');
  revalidatePath('/cash');
}

export async function saveTargetAllocationsAction(rows: TargetAllocationRow[]): Promise<void> {
  await replaceTargetAllocations(rows);
  revalidatePath('/dashboard');
  revalidatePath('/plan');
}

export async function saveScheduleAction(rows: InvestmentScheduleRow[]): Promise<void> {
  await replaceInvestmentSchedule(rows);
  revalidatePath('/plan');
}

export async function renameCashAccountAction(oldName: string, newName: string, amount: number): Promise<void> {
  if (oldName !== newName) {
    await deleteCashAccount(oldName);
  }
  await upsertCashAccount(newName, amount);
  revalidatePath('/dashboard');
  revalidatePath('/cash');
}
