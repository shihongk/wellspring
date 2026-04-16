# Wellspring — Implementation Plan

## Status

| Version | Date | Status |
|---|---|---|
| v0.1 | 2026-04-14 | ✅ Complete |
| v0.2 | 2026-04-16 | ✅ Complete |

---

## v0.1 — Core Portfolio Tracker (Complete)

All phases fully implemented.

- Data layer: types, constants, fx, google-sheets, yahoo-finance, portfolio
- API routes: holdings, cash, transactions, plan, prices, portfolio, setup
- Pages: dashboard, holdings CRUD, transactions, cash, plan, setup
- Components: PortfolioSummary, HoldingsTable, AllocationChart, DashboardClient, RefreshButton, all forms
- Multi-account cash with migration route
- Error boundaries and loading skeletons

---

## v0.2 — Portfolio Plan Redesign (Complete)

Replaced the flat `MonthlyPlan` sheet with two capabilities: target allocation editor and investment schedule.

### Changes shipped

**Data layer**
- `MonthlyPlanRow` removed; replaced with `TargetAllocationRow`, `InvestmentScheduleRow`, `PlanPageData`
- `SHEET_NAMES.MONTHLY_PLAN` → `TARGET_ALLOCATION` + `INVESTMENT_SCHEDULE`
- `getMonthlyPlan`/`replaceMonthlyPlan` removed; `getTargetAllocations`, `replaceTargetAllocations`, `getInvestmentSchedule`, `replaceInvestmentSchedule` added
- `computePortfolioSnapshot` — `plan` parameter removed
- New pure helpers: `computeGap`, `computeRecommendedUnits`, `groupByMonth`

**Server Actions**
- `updatePlanAction` removed
- `saveTargetAllocationsAction` + `saveScheduleAction` added

**API**
- `/api/plan` rewritten: GET returns `TargetAllocationRow[]`, PUT accepts `{ allocations: TargetAllocationRow[] }`
- `/api/setup/provision` updated: `TargetAllocation` + `InvestmentSchedule` tabs instead of `MonthlyPlan`
- `/api/setup/migrate-plan` added: creates new tabs on existing sheets

**UI**
- `plan-form.tsx` + `plan-summary.tsx` deleted
- `AllocationEditor` — target % per equity, running total, cash display
- `ScheduleViewer` — editable schedule, bidirectional units ↔ SGD, totals row, show/hide past months
- `PlanSnapshot` — current portfolio reference with cash-constrained buy recommendations (iterative convergence algorithm)
- `HoldingsTable` — target % and gap columns, 4 colour-coded column groups
- `DashboardClient` — removed PlanSummary, passes `targetAllocations` to HoldingsTable
- `Nav` — converted from top bar to fixed left sidebar
- Layout — full-width (no max-w constraint), responsive tables with `min-w` + `overflow-x-auto`
- Plan page — three-section layout: PlanSnapshot + AllocationEditor + ScheduleViewer side-by-side

---

## Post-v0.2 Ideas

- Vercel deployment
- Transaction history filter by ticker
- Historical performance snapshots
- Additional tickers
- Property-based tests for pure functions (`computeGap`, `computeRecommendedUnits`, `groupByMonth`)
