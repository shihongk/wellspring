'use server';

import { revalidatePath } from 'next/cache';
import {
  upsertHolding,
  deleteHolding,
  appendTransaction,
  getHoldings,
  getCash,
  updateCash,
  upsertCashAccount,
  deleteCashAccount,
  replaceTargetAllocations,
  replaceInvestmentSchedule,
  upsertHistoryEntry,
  adjustMarginBalance,
  getMargin,
} from '@/lib/google-sheets';
import { updateExpenseCategory, updateExpenseExcluded, updateExpenseOneOff, applyRuleToExisting, findRuleConflicts, upsertExpenseRule, bulkUpdateExpenseCategory, applyCategoryUpdates, upsertProjectionOverride, deleteProjectionOverride } from '@/lib/expenses/sheets';
import { upsertCpfBalance, upsertRetirementOneOff, deleteRetirementOneOff } from '@/lib/retirement/sheets';
import { computeNewAvgCost, computePortfolioSnapshot } from '@/lib/portfolio';
import { fetchPricesAndFx } from '@/lib/yahoo-finance';
import { toSGD } from '@/lib/fx';
import { Holding, Transaction, TargetAllocationRow, InvestmentScheduleRow, ExpenseProjectionOverride, CpfBalance, RetirementOneOff, ExpenseRule } from '@/types';

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
    const newMarginShares = (existing?.marginShares ?? 0) + (data.marginFlag ? data.shares : 0);

    await upsertHolding({
      ticker: data.ticker,
      name: existing?.name || data.ticker,
      shares: oldShares + data.shares,
      avgCostLocal: newAvg,
      currency: data.currency,
      marginShares: newMarginShares,
    });

    if (data.marginFlag) {
      const { fxRates } = await fetchPricesAndFx();
      const amountSGD = toSGD(data.shares * data.priceLocal, data.currency, fxRates);
      await adjustMarginBalance('Default', amountSGD);
    }
  } else if (data.type === 'SELL') {
    if (existing) {
      const newShares = existing.shares - data.shares;
      // Computed before the delete/update branch so a full-close sell (position fully
      // sold, holding row deleted) still repays margin from its proceeds — the checkbox
      // is explicit per-sale intent, not conditional on whether the position survives it.
      const sharesReducedFromMargin = Math.min(data.shares, existing.marginShares ?? 0);

      if (newShares <= 0) {
        await deleteHolding(data.ticker);
      } else {
        const newMarginShares = (existing.marginShares ?? 0) - sharesReducedFromMargin;
        await upsertHolding({
          ...existing,
          shares: newShares,
          marginShares: newMarginShares,
          // Avg cost doesn't change on SELL
        });
      }

      if (data.marginFlag && sharesReducedFromMargin > 0) {
        const { fxRates } = await fetchPricesAndFx();
        const proceedsSGD = toSGD(sharesReducedFromMargin * data.priceLocal, data.currency, fxRates);
        await adjustMarginBalance('Default', -proceedsSGD);
      }
    }
  }

  revalidatePath('/dashboard');
  revalidatePath('/holdings');
  revalidatePath('/transactions');
  revalidatePath('/cash');
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

export async function recordSnapshotAction(): Promise<{ recorded: boolean; reason?: string }> {
  const { fxRates, prices, stale } = await fetchPricesAndFx();

  if (stale) {
    return { recorded: false, reason: 'prices-stale' };
  }

  const [holdings, cash] = await Promise.all([getHoldings(), getCash()]);
  const snapshot = computePortfolioSnapshot(holdings, prices, fxRates, cash, false, new Date().toISOString());

  if (snapshot.totalValueSGD === null) {
    return { recorded: false, reason: 'prices-stale' };
  }

  const today = new Date().toISOString().slice(0, 10);
  await upsertHistoryEntry({
    date: today,
    totalValueSGD: snapshot.totalValueSGD,
    fxUSDSGD: fxRates.USDSGD,
    fxHKDSGD: fxRates.HKDSGD,
    recordedAt: new Date().toISOString(),
  });

  revalidatePath('/history');
  return { recorded: true };
}

export async function repayMarginAction(amountSGD: number, cashAccount: string): Promise<void> {
  const margin = await getMargin();
  const outstandingSGD = margin.accounts.find((a) => a.account === 'Default')?.outstandingSGD ?? 0;

  const reduction = Math.min(amountSGD, outstandingSGD);
  const excess = amountSGD - reduction;

  if (reduction > 0) {
    await adjustMarginBalance('Default', -reduction);
  }

  if (excess > 0) {
    const cash = await getCash();
    const currentBalance = cash.accounts.find((a) => a.account === cashAccount)?.amount ?? 0;
    await upsertCashAccount(cashAccount, currentBalance + excess);
  }

  revalidatePath('/cash');
  revalidatePath('/dashboard');
}

export async function renameCashAccountAction(oldName: string, newName: string, amount: number): Promise<void> {
  if (oldName !== newName) {
    await deleteCashAccount(oldName);
  }
  await upsertCashAccount(newName, amount);
  revalidatePath('/dashboard');
  revalidatePath('/cash');
}

export async function updateExpenseCategoryAction(id: string, category: string): Promise<void> {
  await updateExpenseCategory(id, category);
  revalidatePath('/expenses');
}

export async function setExpenseExcludedAction(id: string, excluded: boolean): Promise<void> {
  await updateExpenseExcluded(id, excluded);
  revalidatePath('/expenses');
}

export async function bulkUpdateCategoryAction(ids: string[], category: string): Promise<void> {
  await bulkUpdateExpenseCategory(ids, category);
  revalidatePath('/expenses');
}

export async function createExpenseRuleAction(rule: ExpenseRule): Promise<{
  id: string; date: string; description: string; account: string; amount: number; currentCategory: string;
}[]> {
  await upsertExpenseRule(rule);
  await applyRuleToExisting(rule);
  revalidatePath('/expenses');
  return findRuleConflicts(rule);
}

export async function resolveRuleConflictsAction(updates: { id: string; category: string }[]): Promise<void> {
  await applyCategoryUpdates(updates);
  revalidatePath('/expenses');
}

export async function setExpenseOneOffAction(id: string, oneOff: boolean): Promise<void> {
  await updateExpenseOneOff(id, oneOff);
  revalidatePath('/expenses');
}

export async function saveProjectionOverrideAction(override: ExpenseProjectionOverride): Promise<void> {
  await upsertProjectionOverride(override);
  revalidatePath('/expenses');
}

export async function deleteProjectionOverrideAction(month: string, category: string): Promise<void> {
  await deleteProjectionOverride(month, category);
  revalidatePath('/expenses');
}

export async function saveCpfBalanceAction(balance: CpfBalance): Promise<void> {
  await upsertCpfBalance(balance);
  revalidatePath('/expenses');
  revalidatePath('/retirement');
}

export async function saveRetirementOneOffAction(item: RetirementOneOff): Promise<void> {
  await upsertRetirementOneOff(item);
  revalidatePath('/retirement');
}

export async function deleteRetirementOneOffAction(id: string): Promise<void> {
  await deleteRetirementOneOff(id);
  revalidatePath('/retirement');
}
