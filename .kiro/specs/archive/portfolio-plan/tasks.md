# Implementation Plan: portfolio-plan

## Status: COMPLETE (v0.2)

All tasks implemented and committed.

## Tasks

- [x] 1. Update TypeScript types
- [x] 2. Update constants
- [x] 3. Update Google Sheets data layer
  - [x] 3.1 Add `getTargetAllocations`, `replaceTargetAllocations`, `getInvestmentSchedule`, `replaceInvestmentSchedule`
  - [x] 3.2 Remove `getMonthlyPlan` and `replaceMonthlyPlan`
- [x] 4. Add pure helper functions to `src/lib/portfolio.ts`
  - [x] 4.1 `computeGap(targetPct, currentPct)`
  - [x] 4.2 `computeRecommendedUnits(plannedSGD, currentPriceSGD)`
  - [x] 4.3 `groupByMonth(rows: InvestmentScheduleRow[])`
  - [x] 4.4 Remove `plan` parameter from `computePortfolioSnapshot`
  - [ ]* 4.5 Property tests (optional, deferred)
- [x] 5. Update Server Actions (`saveTargetAllocationsAction`, `saveScheduleAction`)
- [x] 6. Checkpoint — all TypeScript diagnostics clean
- [x] 7. `AllocationEditor` component
- [x] 8. `ScheduleViewer` component (editable, bidirectional units ↔ SGD, totals row)
- [x] 9. Rewrite plan page (PlanSnapshot + AllocationEditor + ScheduleViewer)
- [x] 10. `HoldingsTable` — target % and gap columns with colour-coded column groups
- [x] 11. `DashboardClient` + dashboard page — target allocations passed through
- [x] 12. Delete `plan-form.tsx` and `plan-summary.tsx`
- [x] 13. Update setup/provision route
- [x] 14. Update API plan route
- [x] 15. Final checkpoint — all diagnostics clean

## Additional work completed beyond original spec

- `PlanSnapshot` component — current portfolio reference table with cash-constrained buy recommendations using iterative convergence algorithm
- `replaceInvestmentSchedule` — write-back for schedule (originally read-only per spec)
- `/api/setup/migrate-plan` — migration route for existing sheets
- Fixed sidebar nav (replaces top navbar)
- Full-width responsive layout with `min-w` + `overflow-x-auto` on all tables
- Bidirectional units ↔ planned SGD in ScheduleViewer edit mode
- Totals rows in both PlanSnapshot and ScheduleViewer
