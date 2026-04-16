# Design Document — portfolio-plan

## Overview

This feature replaces the flat `MonthlyPlan` sheet and its associated UI with two distinct capabilities:

1. **Target Allocation** — the user sets a target weight (%) per equity holding. The dashboard and plan tab show a gap analysis (target % − current %).
2. **Investment Schedule** — the user maintains a forward-looking purchase plan directly in Google Sheets (`InvestmentSchedule`). The app reads it, groups entries by month, and calculates recommended unit quantities from live prices.

The existing `MonthlyPlan` sheet and all code that references it (`MonthlyPlanRow`, `replaceMonthlyPlan`, `getMonthlyPlan`, `updatePlanAction`, `PlanForm`, `PlanSummary`) are replaced or removed as part of this work.

---

## Architecture

The feature follows the existing patterns in the codebase:

- **Google Sheets** is the only persistence layer. Two new tabs replace `MonthlyPlan`.
- **Server Components** fetch data at render time (no client-side fetching for initial load).
- **Server Actions** handle the single write operation (saving target allocations).
- **Client Components** handle interactive state (running total in the allocation editor, past-months toggle in the schedule viewer).
- Prices are fetched via the existing `/api/prices` route and passed down as props — no new price-fetching logic is introduced.

```
/plan (Server Component)
  ├── fetches: getTargetAllocations(), getInvestmentSchedule(), getCash(), fetchPricesAndFx()
  ├── AllocationEditor (Client Component)
  │     └── saveTargetAllocationsAction (Server Action)
  └── ScheduleViewer (Client Component)
        └── receives: schedule rows + prices map
```

```
/dashboard (Server Component)
  └── DashboardClient (Client Component)
        └── HoldingsTable  ← gains targetPct + gap columns
```

---

## Components and Interfaces

### New/changed source files

| File | Change |
|---|---|
| `src/types/index.ts` | Add `TargetAllocationRow`, `InvestmentScheduleRow`, `PlanPageData`; remove `MonthlyPlanRow` |
| `src/lib/constants.ts` | Add `SHEET_NAMES.TARGET_ALLOCATION`, `SHEET_NAMES.INVESTMENT_SCHEDULE`; remove `MONTHLY_PLAN` |
| `src/lib/google-sheets.ts` | Add `getTargetAllocations`, `replaceTargetAllocations`, `getInvestmentSchedule`; remove `getMonthlyPlan`, `replaceMonthlyPlan` |
| `src/app/lib/actions.ts` | Add `saveTargetAllocationsAction`; remove `updatePlanAction` |
| `src/app/plan/page.tsx` | Full rewrite — server component loading both data sources |
| `src/components/allocation-editor.tsx` | New client component (replaces `plan-form.tsx`) |
| `src/components/schedule-viewer.tsx` | New client component (replaces `plan-summary.tsx` schedule display) |
| `src/components/plan-form.tsx` | Delete |
| `src/components/plan-summary.tsx` | Delete |
| `src/components/holdings-table.tsx` | Add `targetPct` + `gap` columns |
| `src/components/dashboard-client.tsx` | Pass target allocations map into `HoldingsTable` |
| `src/app/dashboard/page.tsx` | Fetch target allocations and pass to `DashboardClient` |
| `src/app/api/setup/provision/route.ts` | Replace `MonthlyPlan` tab with `TargetAllocation` + `InvestmentSchedule` tabs |

---

## Data Models

### Types (`src/types/index.ts`)

```typescript
// Replaces MonthlyPlanRow
export interface TargetAllocationRow {
  ticker: string;
  targetPct: number; // 0–100
}

// Read-only; sourced from InvestmentSchedule sheet
export interface InvestmentScheduleRow {
  month: string;       // "Apr 2026" (MMM YYYY)
  ticker: string;
  name: string;
  plannedSGD: number;
}

// Aggregated data passed to the plan page
export interface PlanPageData {
  targetAllocations: TargetAllocationRow[];
  schedule: InvestmentScheduleRow[];
  cashSGD: number;
}
```

`MonthlyPlanRow` is removed. `PortfolioSnapshot.plan` (currently `MonthlyPlanRow[]`) is removed from `PortfolioSnapshot` — the dashboard no longer needs it since `PlanSummary` is being deleted.

### Sheet schemas

**`TargetAllocation`** (replaces `MonthlyPlan`)

| Column | Value |
|---|---|
| `ticker` | e.g. `BRK-B` |
| `target_pct` | e.g. `25.5` |

**`InvestmentSchedule`** (new, read-only from app)

| Column | Value |
|---|---|
| `month` | e.g. `Apr 2026` |
| `ticker` | e.g. `TSM` |
| `name` | e.g. `Taiwan Semiconductor Manufacturing` |
| `planned_sgd` | e.g. `1000` |

### Constants (`src/lib/constants.ts`)

```typescript
export const SHEET_NAMES = {
  HOLDINGS: 'Holdings',
  CASH: 'Cash',
  TRANSACTIONS: 'Transactions',
  TARGET_ALLOCATION: 'TargetAllocation',   // replaces MONTHLY_PLAN
  INVESTMENT_SCHEDULE: 'InvestmentSchedule', // new
  FX_RATES: 'FxRates',
} as const;
```

### Google Sheets functions (`src/lib/google-sheets.ts`)

```typescript
// Read all target allocations. Returns [] if sheet missing/empty.
export async function getTargetAllocations(): Promise<TargetAllocationRow[]>

// Overwrite all rows in TargetAllocation sheet (clear A2:B then write).
export async function replaceTargetAllocations(rows: TargetAllocationRow[]): Promise<void>

// Read all rows from InvestmentSchedule. Returns [] if sheet missing/empty.
export async function getInvestmentSchedule(): Promise<InvestmentScheduleRow[]>
```

`getMonthlyPlan` and `replaceMonthlyPlan` are removed.

### Server Actions (`src/app/lib/actions.ts`)

```typescript
// Saves target allocations to TargetAllocation sheet, revalidates /dashboard and /plan.
export async function saveTargetAllocationsAction(rows: TargetAllocationRow[]): Promise<void>
```

`updatePlanAction` is removed.

### Gap calculation helper (`src/lib/portfolio.ts` or inline)

```typescript
// Pure function — suitable for property-based testing.
export function computeGap(targetPct: number, currentPct: number): number {
  return Math.round((targetPct - currentPct) * 10) / 10;
}

// Returns floor(plannedSGD / currentPriceSGD), or null if price unavailable.
export function computeRecommendedUnits(plannedSGD: number, currentPriceSGD: number | null): number | null {
  if (currentPriceSGD == null || currentPriceSGD <= 0) return null;
  return Math.floor(plannedSGD / currentPriceSGD);
}
```

---

## Component Design

### `AllocationEditor` (`src/components/allocation-editor.tsx`)

Client component. Props:

```typescript
interface Props {
  initialAllocations: TargetAllocationRow[];
  cashSGD: number;
  action: (rows: TargetAllocationRow[]) => Promise<void>;
}
```

- Renders one `<input type="number">` per equity ticker (EQUITY_TICKERS, 5 rows).
- Displays a running total of entered percentages (derived state, no server round-trip).
- Displays cash balance as read-only informational row — no input.
- On submit: calls `action(rows)`, shows success/error feedback.

### `ScheduleViewer` (`src/components/schedule-viewer.tsx`)

Client component. Props:

```typescript
interface Props {
  schedule: InvestmentScheduleRow[];
  prices: Record<string, { price: number | null; currency: string }>;
  pricesStale: boolean;
  pricesFetchedAt: string | null;
  fxRates: FxRates;
}
```

- Groups rows by month using a pure `groupByMonth` helper.
- Default view: current month + future months only.
- "Show past months" toggle (local state) reveals earlier months.
- For each row: month, ticker, name, planned SGD, recommended units (`computeRecommendedUnits`), live price in SGD.
- Stale price warning when `pricesStale === true`.
- Empty state message when `schedule.length === 0`.

### `HoldingsTable` — updated props

```typescript
interface Props {
  holdings: PortfolioHolding[];
  cash: PortfolioSnapshot['cash'];
  grandTotalSGD: number | null;
  excludeCash?: boolean;
  targetAllocations?: Record<string, number>; // ticker → targetPct, optional
}
```

Two new columns added after `Alloc`:

- **Target %** — `targetAllocations[ticker]` if set and > 0, else `—`
- **Gap** — `computeGap(targetPct, allocationPct)` coloured green/red/neutral; `—` when target is absent

### Plan page (`src/app/plan/page.tsx`)

```typescript
export const dynamic = 'force-dynamic';

export default async function PlanPage() {
  const [allocations, schedule, cash, pricesAndFx] = await Promise.allSettled([
    getTargetAllocations(),
    getInvestmentSchedule(),
    getCash(),
    fetchPricesAndFx(),
  ]);
  // Each section renders independently; a rejected promise shows an error state
  // for that section only (Requirement 8.3).
}
```

### Dashboard page (`src/app/dashboard/page.tsx`)

Adds a `getTargetAllocations()` call alongside the existing data fetches. The result is converted to `Record<string, number>` and passed through `DashboardClient` → `HoldingsTable`.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Target allocation round-trip

*For any* valid array of `TargetAllocationRow` values, calling `replaceTargetAllocations` followed by `getTargetAllocations` must return rows with equivalent ticker/targetPct pairs (order-independent).

**Validates: Requirements 2.4**

---

### Property 2: Running total equals sum of inputs

*For any* array of five non-negative percentage values entered into the `AllocationEditor`, the displayed running total must equal their arithmetic sum.

**Validates: Requirements 2.2**

---

### Property 3: Gap calculation correctness

*For any* `targetPct` and `currentPct` in the range [0, 100], `computeGap(targetPct, currentPct)` must equal `Math.round((targetPct - currentPct) * 10) / 10`.

**Validates: Requirements 3.2, 4.2**

---

### Property 4: Gap colour coding

*For any* gap value, the colour class applied must be: green when gap > 0, red when gap < 0, neutral when gap === 0.

**Validates: Requirements 3.3, 3.4, 3.5, 4.2**

---

### Property 5: Recommended units calculation

*For any* `plannedSGD >= 0` and `currentPriceSGD > 0`, `computeRecommendedUnits(plannedSGD, currentPriceSGD)` must equal `Math.floor(plannedSGD / currentPriceSGD)`.

**Validates: Requirements 7.1**

---

### Property 6: Schedule chronological ordering

*For any* list of `InvestmentScheduleRow` values with varying months, `groupByMonth` must return groups in chronological order (earlier months before later months).

**Validates: Requirements 6.1**

---

### Property 7: Future-only filter

*For any* list of schedule rows and any reference date, the default-filtered result (past months hidden) must contain only rows whose month is >= the reference month.

**Validates: Requirements 6.2**

---

### Property 8: Show-past is a superset

*For any* schedule and reference date, enabling `showPast` must return a result that is a superset of (or equal to) the default-filtered result.

**Validates: Requirements 6.3**

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| `TargetAllocation` sheet missing | `getTargetAllocations` returns `[]`; UI shows 0% for all targets |
| `InvestmentSchedule` sheet missing | `getInvestmentSchedule` returns `[]`; `ScheduleViewer` shows empty state |
| `replaceTargetAllocations` throws | `saveTargetAllocationsAction` re-throws; `AllocationEditor` catches and displays error message |
| Price fetch fails / stale | `pricesStale: true` propagated; `ScheduleViewer` shows staleness warning; recommended units still computed where price is available |
| Individual price unavailable | `computeRecommendedUnits` returns `null`; `ScheduleViewer` renders `—` |
| Dashboard `getTargetAllocations` fails | `targetAllocations` prop defaults to `{}`; target/gap columns show `—` for all rows |
| Plan page partial failure | `Promise.allSettled` ensures each section renders independently; failed section shows inline error |

---

## Testing Strategy

### Unit tests (example-based)

- `getTargetAllocations` with empty/missing sheet returns `[]` (Req 1.2)
- `getInvestmentSchedule` with empty/missing sheet returns `[]` (Req 5.3)
- `AllocationEditor` renders exactly 5 equity inputs and no CASH input (Req 2.1, 2.3)
- `HoldingsTable` renders `—` in target/gap columns when `targetPct` is 0 or absent (Req 3.6, 4.3)
- `ScheduleViewer` renders empty state when schedule is empty (Req 5.3)
- `ScheduleViewer` renders `—` for recommended units when price is null (Req 7.3)
- `ScheduleViewer` renders staleness warning when `pricesStale=true` (Req 7.4)
- Plan page renders both sections; when one data source throws, the other section still renders (Req 8.3)

### Property-based tests

Use **fast-check** (already compatible with the TypeScript/Node stack; install as dev dependency).

Each property test runs a minimum of 100 iterations.

| Test | Property | Tag |
|---|---|---|
| Round-trip: `replaceTargetAllocations` → `getTargetAllocations` | Property 1 | `Feature: portfolio-plan, Property 1: target allocation round-trip` |
| Running total equals sum | Property 2 | `Feature: portfolio-plan, Property 2: running total equals sum of inputs` |
| `computeGap` arithmetic | Property 3 | `Feature: portfolio-plan, Property 3: gap calculation correctness` |
| Gap colour class by sign | Property 4 | `Feature: portfolio-plan, Property 4: gap colour coding` |
| `computeRecommendedUnits` floor division | Property 5 | `Feature: portfolio-plan, Property 5: recommended units calculation` |
| `groupByMonth` chronological order | Property 6 | `Feature: portfolio-plan, Property 6: schedule chronological ordering` |
| Future-only filter | Property 7 | `Feature: portfolio-plan, Property 7: future-only filter` |
| Show-past superset | Property 8 | `Feature: portfolio-plan, Property 8: show-past is a superset` |

Properties 3, 5, 6, 7, and 8 test pure functions and require no mocking. Properties 1 and 2 require mocking the Google Sheets client and the React component state respectively.
