# Wellspring — Handover Document

## What This Project Is

Personal SGD-denominated investment portfolio tracker. Web app backed by Google Sheets (no database). Market data from Yahoo Finance. Built with Next.js 16.2.3 App Router, TypeScript, Tailwind CSS v4.

---

## Current State — v0.2 (2026-04-16) — COMPLETE

All v0.1 and v0.2 features are fully implemented and committed to `main`.

---

## What Exists and Works

### Data layer

| File | Purpose |
|---|---|
| `src/types/index.ts` | All shared interfaces: `TargetAllocationRow`, `InvestmentScheduleRow`, `PlanPageData`, `PortfolioSnapshot` (no `plan` field), etc. |
| `src/lib/constants.ts` | Tickers, FX pairs, sheet names (`TARGET_ALLOCATION`, `INVESTMENT_SCHEDULE`), fallback rates, `TICKER_NAME` map |
| `src/lib/fx.ts` | `toSGD()`, `formatSGD()`, `formatShares()`, `formatDate()`, `formatDateTime()` |
| `src/lib/google-sheets.ts` | Full Sheets CRUD: holdings, cash (multi-account), transactions, `getTargetAllocations`, `replaceTargetAllocations`, `getInvestmentSchedule`, `replaceInvestmentSchedule`, FX rates |
| `src/lib/yahoo-finance.ts` | Price + FX fetch with 3-tier fallback (live → cached sheet → hardcoded) |
| `src/lib/portfolio.ts` | `computePortfolioSnapshot`, `computeNewAvgCost`, `computeGap`, `computeRecommendedUnits`, `groupByMonth` |

### Server Actions (`src/app/lib/actions.ts`)

- `upsertHoldingAction`, `deleteHoldingAction`
- `logTransactionAction` — BUY recalculates avg cost; SELL reduces shares, deletes if zero
- `updateCashAction`, `upsertCashAccountAction`, `deleteCashAccountAction`, `renameCashAccountAction`
- `saveTargetAllocationsAction` — writes to `TargetAllocation` sheet, revalidates `/dashboard` and `/plan`
- `saveScheduleAction` — writes to `InvestmentSchedule` sheet, revalidates `/plan`

### API Routes

- `GET/POST /api/holdings`
- `GET/PUT/DELETE /api/holdings/[ticker]`
- `GET/PUT /api/cash`
- `GET/POST /api/transactions`
- `GET /api/plan` — returns `TargetAllocationRow[]`
- `PUT /api/plan` — body `{ allocations: TargetAllocationRow[] }`
- `GET /api/prices`
- `GET /api/portfolio`
- `POST /api/setup/test`
- `POST /api/setup/provision` — creates `TargetAllocation` + `InvestmentSchedule` tabs (not `MonthlyPlan`)
- `POST /api/setup/save`
- `POST /api/setup/migrate-cash`
- `POST /api/setup/migrate-plan` — creates `TargetAllocation` + `InvestmentSchedule` tabs for existing sheets

### Pages

- `/` → redirects to `/dashboard`
- `/dashboard` — portfolio view with colour-coded holdings table (position/market/performance/allocation column groups), target % and gap columns, ex-cash toggle, allocation chart
- `/holdings` — list with edit/delete; `/holdings/new`; `/holdings/[ticker]`
- `/transactions` — list with BUY/SELL badges; `/transactions/new`
- `/cash` — multi-account cash management
- `/plan` — three sections: current portfolio reference + buy recommendations, target allocation editor, investment schedule editor
- `/setup` — credential entry, connection test, sheet provisioning, cash migration, plan tab migration

### Components

| Component | Type | Purpose |
|---|---|---|
| `Nav` | client | Fixed left sidebar, always visible |
| `PortfolioSummary` | server | Total value, stale banner, FX rate pills |
| `HoldingsTable` | server | Holdings table with 4 colour-coded column groups (position/market/perf/alloc), target % and gap |
| `DashboardClient` | client | Ex-cash toggle, passes `targetAllocations` to `HoldingsTable` |
| `AllocationChart` | client | SVG donut chart |
| `AllocationEditor` | client | Target % inputs per equity, running total, cash display |
| `ScheduleViewer` | client | Editable investment schedule; bidirectional units ↔ SGD; totals row |
| `PlanSnapshot` | client | Current portfolio reference table with cash-constrained buy recommendations (iterative convergence) |
| `RefreshButton` | client | `router.refresh()` to re-fetch live prices |
| `HoldingForm`, `TransactionForm`, `CashForm` | client | CRUD forms |

---

## Google Sheets Tab Structure

Six tabs. Row 1 = header. Data starts at row 2.

| Tab | Columns |
|---|---|
| `Holdings` | A:ticker B:name C:shares D:avg_cost_local E:currency |
| `Cash` | A:account B:currency C:amount |
| `Transactions` | A:id B:date C:ticker D:type E:shares F:price_local G:currency |
| `TargetAllocation` | A:ticker B:target_pct |
| `InvestmentSchedule` | A:month B:ticker C:name D:planned_sgd |
| `FxRates` | A:pair B:rate C:fetched_at |

### Migration notes

- **Cash tab** changed from `(currency, amount)` to `(account, currency, amount)` in v0.1. `getCash()` auto-detects both formats. Run `/api/setup/migrate-cash` to convert.
- **MonthlyPlan tab** replaced by `TargetAllocation` + `InvestmentSchedule` in v0.2. Run `/api/setup/migrate-plan` to add the new tabs to existing sheets.

---

## Holdings in Scope

| Ticker | Name | Exchange | Currency |
|---|---|---|---|
| BRK-B | Berkshire Hathaway Inc. | NYSE | USD |
| JK8.SI | UOBAM FTSE China A50 Index ETF | SGX | SGD |
| 2823.HK | iShares FTSE A50 China Index ETF | HKEX | HKD |
| 2838.HK | Hang Seng FTSE China 50 Index ETF | HKEX | HKD |
| TSM | Taiwan Semiconductor Manufacturing | NYSE | USD |
| CASH | Cash (SGD) | — | SGD |

FX pairs: `USDSGD=X`, `HKDSGD=X`

---

## Key Algorithms

### Buy Recommendation (PlanSnapshot)

Iterative convergence to ensure total spend ≤ available cash:

```
equityTotal = sum of all holding values
accumulated = {}
cashLeft = cashSGD

loop (up to 20 iterations):
  newTotal = equityTotal + sum(accumulated) + cashLeft
  for each underweight holding:
    toBuy = targetPct% × newTotal − currentValue − accumulated[ticker]
  if sum(toBuy) ≤ cashLeft → add to accumulated, done
  else → scale by cashLeft/sum(toBuy), cashLeft = 0, done
```

### Gap Calculation

`computeGap(targetPct, currentPct) = Math.round((targetPct - currentPct) * 10) / 10`

### Recommended Units

`computeRecommendedUnits(plannedSGD, priceSGD) = Math.floor(plannedSGD / priceSGD)` or `null` if price unavailable.

---

## Critical Next.js 16 Rules

1. **`params` is a Promise** in dynamic routes — always `await` it
2. **`export const dynamic = 'force-dynamic'`** on every `route.ts` and data-fetching page
3. **Route Handlers use Web APIs** — `Request` / `Response.json(...)`
4. **No `use cache` directive**
5. **No `getServerSideProps`/`getStaticProps`**

---

## Critical Implementation Rules

- **No module-level Sheets singleton** — always instantiate inside `getSheetsClient()`
- **Private key transform** — `GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')` only inside `getSheetsClient()`
- **All types** imported from `@/types`
- **Yahoo Finance** — server-side only, never in `'use client'` components
- **FX conversion** — always `toSGD(amount, currency, fxRates)` from `@/lib/fx`
- **Imports** — always `@/` alias, never relative `../../`

---

## Design System

| Token | Value | Usage |
|---|---|---|
| `--color-primary` | `#0e7490` | Buttons, focus rings |
| `--color-primary-dark` | `#4338ca` | Total value text |
| `--color-accent` | `#22c55e` | Accent green |
| `--color-gain` | `#16a34a` | Positive P&L, buy amounts |
| `--color-loss` | `#dc2626` | Negative P&L, overweight gap |
| Nav background | `#0f172a` | slate-900 |
| Page background | `#f0f9ff` | sky-50 |

### Holdings Table Column Groups

| Group | Columns | Tint |
|---|---|---|
| Identity | Ticker, Name | none |
| Position | Shares, Avg Cost | `bg-blue-50/40` |
| Market | Price, Value (local), Value (SGD) | `bg-indigo-50/40` |
| Performance | Gain/Loss, Gain % | `bg-emerald-50/40` |
| Allocation | Alloc, Target %, Gap | `bg-violet-50/40` |

---

## What to Build Next (Post v0.2 Ideas)

- Vercel deployment + environment variable configuration
- Transaction history filterable by ticker
- Historical performance chart (requires storing snapshots)
- Support for additional tickers
- Unit/property tests for pure functions in `portfolio.ts`
