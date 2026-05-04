# Design Document — projections (v0.6)

## Overview

A dedicated "Projections" tab within the Expenses view forecasts future cash flow (income and expenses) based on historical averages, with manual overrides per month/category and multi-year projection with configurable inflation.

## Architecture

- **Google Sheets** persists manual projection overrides in `ExpenseProjections`.
- **Server Components** fetch transactions and overrides at render time.
- **Server Actions** save/delete overrides.
- **Client Components** own all projection computation: baseline period selection, inflation rates, range toggle, chart rendering. Baseline period persisted to `localStorage` (read in `useEffect` to avoid SSR hydration mismatch).

---

## Data Model

### Schema changes to `ExpenseTransaction`

Add `oneOff?: boolean` (column M in Expenses sheet). Transactions marked one-off are excluded from baseline averaging and not projected forward.

### `ExpenseProjectionOverride` (new type)

```typescript
export interface ExpenseProjectionOverride {
  month: string;      // YYYY-MM
  category: string;   // member of EXPENSE_CATEGORIES
  amount: number;     // positive; replaces computed baseline for that cell
}
```

### `ExpenseProjections` sheet (new)

| Column | Value |
|---|---|
| `month` | e.g. `2026-05` |
| `category` | e.g. `Groceries` |
| `amount` | e.g. `1200` |

---

## Baseline Rules

When computing `computeBaselineAverages`, exclude:
- Transactions with `excluded: true`
- Transactions with `oneOff: true`
- `Transfer` category (self-transfer noise)
- `Investment` category (tracked separately via wealth projections)

Income categories (treated as cash inflows): `Salary`, `Interest`, `Other Income`, `Income`.
All other non-excluded spending categories are outflows.
`Transfer`, `Other` are excluded from net cash flow.

---

## Projection Logic (`src/lib/expenses/projections.ts`)

### `computeBaselineAverages(transactions, startMonth, endMonth)`

Returns `Record<category, monthlyAvgSGD>`.

- Filter transactions to baseline period, applying exclusion rules above.
- Sum per category.
- Divide each sum by the **total number of months in the baseline period** (not months where category appeared). This amortises irregular expenses conservatively.

### `generateProjections(baselineAverages, overrides, targetMonths, inflationSettings)`

Returns `Record<YYYY-MM, Record<category, amount>>`.

- `targetMonths`: list of `YYYY-MM` strings starting from next full month.
- Overrides strictly replace baseline for that cell.
- Apply inflation per year (compounded annually):
  - Income categories: multiply by `(1 + incomeGrowthRate)^yearsFromNow`
  - All other categories: multiply by `(1 + expenseInflationRate)^yearsFromNow`
- `yearsFromNow` = fractional years from the first projected month.

### `aggregateCashFlow(projections, incomeCategories)`

Returns rolling summaries: next 3M / 6M / 12M income, expenses, net.

---

## Inflation Settings

```typescript
export interface InflationSettings {
  expenseInflationRate: number;  // e.g. 0.03 (3%)
  incomeGrowthRate: number;      // e.g. 0.05 (5%)
}
```

Defaults: `expenseInflationRate: 0.03`, `incomeGrowthRate: 0.03`. Stored in `localStorage`.

---

## UI Design

### Tab structure

`ExpensesClient` tab state: `'spending' | 'income' | 'projections'`.

When projections tab is active:
- **Hide** the month navigator and per-month KPI row.
- Render `ProjectionsTab` full-width in their place.

### ProjectionsTab layout

```
[Baseline period: Start ▾  End ▾]  [Expense inflation: 3%]  [Income growth: 5%]

[Net 3M: S$X]  [Net 6M: S$X]  [Net 12M: S$X]   (rolling from next full month)

[Range: 3M | 6M | 12M | 3Y | 5Y | 10Y | MAX]
[Combined bar chart — monthly bars ≤24 months, annual bars >24 months]
[Past actuals: solid | Future projections: faded]

[Category matrix table: rows=categories, cols=projected months/years]
[Clicking a cell opens inline input → save override → optimistic update]
[Clearing a cell → delete override → revert to baseline]
```

### Baseline period selector

- Month pickers (Start, End) for `YYYY-MM` selection.
- Only complete past months selectable (not current month).
- Default: last 3 complete months. Stored in `localStorage`, read after mount.

### Override deletion

Clearing an input (empty string on blur) triggers `deleteProjectionOverrideAction`.

---

## Migration

- `/api/setup/provision` updated to create `ExpenseProjections` tab for new sheets.
- `/api/setup/migrate-projections` route for existing sheets.
- `scripts/migrate-projections.ts` — standalone script to run migration directly.
