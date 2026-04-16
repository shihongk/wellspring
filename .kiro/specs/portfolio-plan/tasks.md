# Implementation Plan: portfolio-plan

## Overview

Replace the flat `MonthlyPlan` sheet and its UI with two capabilities: a target allocation editor (editable in-app) and a read-only investment schedule viewer (sourced from Google Sheets). Pure helper functions are added to `portfolio.ts`, types and constants are updated, and the dashboard gains target % and gap columns.

## Tasks

- [x] 1. Update TypeScript types
  - In `src/types/index.ts`: add `TargetAllocationRow`, `InvestmentScheduleRow`, and `PlanPageData` interfaces as specified in the design
  - Remove `MonthlyPlanRow` interface
  - Remove `plan: MonthlyPlanRow[]` field from `PortfolioSnapshot`
  - _Requirements: 1.1, 5.1_

- [ ] 2. Update constants
  - In `src/lib/constants.ts`: replace `MONTHLY_PLAN: 'MonthlyPlan'` with `TARGET_ALLOCATION: 'TargetAllocation'` and `INVESTMENT_SCHEDULE: 'InvestmentSchedule'`
  - _Requirements: 1.1, 5.1_

- [ ] 3. Update Google Sheets data layer
  - [ ] 3.1 Add `getTargetAllocations`, `replaceTargetAllocations`, and `getInvestmentSchedule` to `src/lib/google-sheets.ts`
    - `getTargetAllocations`: reads `TargetAllocation!A:B`, maps rows to `TargetAllocationRow`, returns `[]` on empty/missing sheet
    - `replaceTargetAllocations`: clears `TargetAllocation!A2:B` then writes new rows
    - `getInvestmentSchedule`: reads `InvestmentSchedule!A:D`, maps rows to `InvestmentScheduleRow`, returns `[]` on empty/missing sheet
    - _Requirements: 1.1, 1.2, 5.1, 5.3_
  - [ ] 3.2 Remove `getMonthlyPlan` and `replaceMonthlyPlan` from `src/lib/google-sheets.ts`
    - _Requirements: 1.1_

- [ ] 4. Add pure helper functions to `src/lib/portfolio.ts`
  - [ ] 4.1 Add `computeGap(targetPct, currentPct)` — returns `Math.round((targetPct - currentPct) * 10) / 10`
    - _Requirements: 3.2, 4.2_
  - [ ] 4.2 Add `computeRecommendedUnits(plannedSGD, currentPriceSGD)` — returns `Math.floor(plannedSGD / currentPriceSGD)` or `null` when price is null/zero
    - _Requirements: 7.1, 7.3_
  - [ ] 4.3 Add `groupByMonth(rows: InvestmentScheduleRow[])` — returns rows grouped by month in chronological order (parse "MMM YYYY" for sorting)
    - _Requirements: 6.1_
  - [ ] 4.4 Remove `plan: MonthlyPlanRow[]` parameter from `computePortfolioSnapshot` signature and remove it from the returned `PortfolioSnapshot` object
    - _Requirements: 1.1_
  - [ ]* 4.5 Write property tests for pure helpers
    - **Property 3: Gap calculation correctness** — for any `targetPct` and `currentPct` in [0, 100], `computeGap` equals `Math.round((targetPct - currentPct) * 10) / 10`
    - **Validates: Requirements 3.2, 4.2**
    - **Property 5: Recommended units calculation** — for any `plannedSGD >= 0` and `currentPriceSGD > 0`, `computeRecommendedUnits` equals `Math.floor(plannedSGD / currentPriceSGD)`
    - **Validates: Requirements 7.1**
    - **Property 6: Schedule chronological ordering** — for any list of `InvestmentScheduleRow` values, `groupByMonth` returns groups in chronological order
    - **Validates: Requirements 6.1**
    - **Property 7: Future-only filter** — for any schedule rows and reference date, filtering to `month >= referenceMonth` excludes all past months
    - **Validates: Requirements 6.2**
    - **Property 8: Show-past is a superset** — enabling `showPast` returns a result that is a superset of the default-filtered result
    - **Validates: Requirements 6.3**

- [ ] 5. Update Server Actions
  - In `src/app/lib/actions.ts`: add `saveTargetAllocationsAction(rows: TargetAllocationRow[])` — calls `replaceTargetAllocations`, revalidates `/dashboard` and `/plan`
  - Remove `updatePlanAction` and its `replaceMonthlyPlan` import; remove `MonthlyPlanRow` import
  - _Requirements: 2.4, 2.5_

- [ ] 6. Checkpoint — fix all type errors introduced by the type/constant/function changes
  - Ensure all TypeScript diagnostics pass before proceeding to UI work
  - Fix any call sites that still reference `MonthlyPlanRow`, `MONTHLY_PLAN`, `getMonthlyPlan`, `replaceMonthlyPlan`, or `snapshot.plan`

- [ ] 7. Create `AllocationEditor` component (`src/components/allocation-editor.tsx`)
  - Client component with props `{ initialAllocations: TargetAllocationRow[], cashSGD: number, action: (rows: TargetAllocationRow[]) => Promise<void> }`
  - Renders one `<input type="number">` per equity ticker from `EQUITY_TICKERS` (5 rows)
  - Displays a running total of entered percentages as derived state
  - Displays cash balance as a read-only informational row (no input)
  - On submit: calls `action(rows)`, shows success/error feedback inline
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 8. Create `ScheduleViewer` component (`src/components/schedule-viewer.tsx`)
  - Client component with props `{ schedule, prices, pricesStale, pricesFetchedAt, fxRates }`
  - Uses `groupByMonth` to group rows; default view shows current month + future months only
  - "Show past months" toggle (local state) reveals earlier months
  - For each row: month, ticker, name, planned SGD, recommended units (`computeRecommendedUnits`), live price in SGD
  - Renders `—` for recommended units when price is null (Req 7.3)
  - Renders staleness warning when `pricesStale === true` (Req 7.4)
  - Renders empty state message when `schedule.length === 0` (Req 5.3)
  - _Requirements: 5.3, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4_

- [ ] 9. Rewrite plan page (`src/app/plan/page.tsx`)
  - Server component; use `Promise.allSettled` to fetch `getTargetAllocations()`, `getInvestmentSchedule()`, `getCash()`, `fetchPricesAndFx()` in parallel
  - Render `AllocationEditor` and `ScheduleViewer` as distinct labelled sections
  - When a data source rejects, render an inline error state for that section only; the other section renders normally
  - Pass `saveTargetAllocationsAction` as the `action` prop to `AllocationEditor`
  - _Requirements: 8.1, 8.2, 8.3_

- [ ] 10. Update `HoldingsTable` to add target % and gap columns
  - Add optional `targetAllocations?: Record<string, number>` prop to `src/components/holdings-table.tsx`
  - Add two new columns after `Alloc`: **Target %** and **Gap**
  - Target % shows `targetAllocations[ticker]` when set and > 0, else `—`
  - Gap shows `computeGap(targetPct, allocationPct)` coloured green (positive) / red (negative) / neutral (zero); `—` when target is absent
  - Cash row and total row show `—` in both new columns
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 11. Update `DashboardClient` and dashboard page to pass target allocations
  - In `src/app/dashboard/page.tsx`: add `getTargetAllocations()` to the `Promise.all` fetch; convert result to `Record<string, number>` and pass to `DashboardClient`
  - In `src/components/dashboard-client.tsx`: accept `targetAllocations: Record<string, number>` prop and forward it to `HoldingsTable`
  - Remove `getMonthlyPlan` call and `PlanSummary` usage from dashboard page and `DashboardClient`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 12. Delete old files
  - Delete `src/components/plan-form.tsx`
  - Delete `src/components/plan-summary.tsx`
  - _Requirements: 1.1_

- [ ] 13. Update setup/provision route
  - In `src/app/api/setup/provision/route.ts`: replace the `MonthlyPlan` entry in `TABS` with two entries: `TargetAllocation` (headers: `ticker`, `target_pct`) and `InvestmentSchedule` (headers: `month`, `ticker`, `name`, `planned_sgd`)
  - _Requirements: 1.1, 5.1_

- [ ] 14. Update API plan route
  - Rewrite `src/app/api/plan/route.ts` to use `getTargetAllocations` (GET) and `replaceTargetAllocations` (PUT) with `TargetAllocationRow` body shape; remove all references to `MonthlyPlanRow`, `getMonthlyPlan`, `replaceMonthlyPlan`
  - _Requirements: 1.1, 2.4_

- [ ] 15. Final checkpoint — ensure all tests pass
  - Ensure all TypeScript diagnostics are clean across the changed files
  - Ensure all property-based tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property tests use **fast-check** (install as dev dependency if not present)
- Each property test task references the property number from the design document for traceability
- Tasks 1–5 are purely backend/data-layer changes and can be completed before touching any UI
- Task 6 is a deliberate checkpoint to catch type errors early before UI work begins
