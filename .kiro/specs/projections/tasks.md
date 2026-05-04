# Implementation Plan: projections (v0.6)

## Status: 🔲 In Progress

---

## Phase 1 — Types, Schema & Data Layer

- [x] 1.1 Add `oneOff?: boolean` to `ExpenseTransaction` in `src/types/index.ts`
- [x] 1.2 Add `ExpenseProjectionOverride` interface to `src/types/index.ts`
- [x] 1.3 Add `EXPENSE_PROJECTIONS: 'ExpenseProjections'` to `SHEET_NAMES` in `src/lib/constants.ts`
- [x] 1.4 Update `rowToTransaction` / `transactionToRow` in `sheets.ts` to handle `oneOff` (col M)
- [x] 1.5 Update `getExpenses` range to `A:M`; `appendExpenses` range to `A:M`
- [x] 1.6 Add `updateExpenseOneOff(id, oneOff)` to `src/lib/expenses/sheets.ts`
- [x] 1.7 Add `getProjectionOverrides()` to `src/lib/expenses/sheets.ts`
- [x] 1.8 Add `upsertProjectionOverride()` to `src/lib/expenses/sheets.ts`
- [x] 1.9 Add `deleteProjectionOverride()` to `src/lib/expenses/sheets.ts`
- [x] 1.10 Update provision route: add `one_off` to Expenses headers; add `ExpenseProjections` tab
- [x] 1.11 Create `src/app/api/setup/migrate-projections/route.ts`
- [x] 1.12 Add `setExpenseOneOffAction` to `src/app/lib/actions.ts`
- [x] 1.13 Add `saveProjectionOverrideAction` and `deleteProjectionOverrideAction` to actions.ts
- [x] 1.14 Add one-off toggle to `TxRow` in `ExpensesClient.tsx`
- [x] 1.15 Create `scripts/migrate-projections.ts` and run it

**AC:** `one_off` column readable/writable. One-off toggle visible in expanded transaction row. `ExpenseProjections` tab exists in sheet with correct headers. `getProjectionOverrides` returns correct data. `upsertProjectionOverride` updates existing row or appends.

---

## Phase 2 — Core Projection Logic

- [x] 2.1 Create `src/lib/expenses/projections.ts`
- [x] 2.2 Implement `computeBaselineAverages(transactions, startMonth, endMonth)` — respects exclusion rules (excluded, oneOff, Transfer, Investment)
- [x] 2.3 Implement `generateProjections(baselineAverages, overrides, targetMonths, inflationSettings)` — overrides replace baseline; inflation compounded annually
- [x] 2.4 Implement `aggregateCashFlow(projections, incomeCategories)` — rolling 3M/6M/12M
- [x] 2.5 Write tests in `src/lib/expenses/__tests__/projections.test.ts`:
  - Missing months averaged over full baseline period (not just months with data)
  - one-off and excluded transactions excluded from baseline
  - Transfer and Investment excluded from baseline
  - Override replaces baseline for exact month/category
  - Inflation compounds correctly across years
  - `aggregateCashFlow` rolling sums are correct

**AC:** All tests pass. `computeBaselineAverages` divides by total baseline months. Overrides strictly replace. Inflation applies from year boundary.

---

## Phase 3 — UI Components

- [x] 3.1 Update `src/app/expenses/page.tsx` to fetch `getProjectionOverrides()` and pass as prop
- [x] 3.2 Update `ExpensesClient` props: add `overrides: ExpenseProjectionOverride[]`
- [x] 3.3 Add `'projections'` to tab state in `ExpensesClient`; hide month nav + per-month KPIs when on projections tab
- [x] 3.4 Create `src/components/expenses/ProjectionsTab.tsx`
- [x] 3.5 Baseline period controls (Start/End month pickers, `localStorage` with `useEffect`)
- [x] 3.6 Inflation settings controls (expense rate %, income growth %)
- [x] 3.7 Rolling KPI cards (Net 3M / 6M / 12M)
- [x] 3.8 Range selector (3M / 6M / 12M / 3Y / 5Y / 10Y / MAX)
- [x] 3.9 Combined bar chart — monthly ≤24 months, annual >24 months; past actuals solid, projections faded
- [x] 3.10 Category matrix table — rows=categories, cols=future months/years
- [x] 3.11 Cell click → inline input → `saveProjectionOverrideAction` with optimistic update
- [x] 3.12 Cell clear → `deleteProjectionOverrideAction` → revert to baseline

**AC:** Tab renders without crashing. Changing baseline period recalculates in real time. Override saves to sheet and updates UI. Clearing reverts to baseline.
