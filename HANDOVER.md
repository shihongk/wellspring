# Wellspring — Handover Document

## What This Project Is

Personal SGD-denominated investment portfolio tracker. Web app backed by Google Sheets (no database). Market data from Yahoo Finance. Built with Next.js 16.2.3 App Router, TypeScript, Tailwind CSS v4.

---

## Current State — v0.4.1 (2026-04-20) — COMPLETE

All v0.1 through v0.4.1 features are fully implemented and committed to `main`.

---

## What Exists and Works

### Data layer

| File | Purpose |
|---|---|
| `src/types/index.ts` | All shared interfaces including `PortfolioHistoryEntry` |
| `src/lib/constants.ts` | Tickers, FX pairs, sheet names (`PORTFOLIO_HISTORY` added), fallback rates |
| `src/lib/fx.ts` | `toSGD()`, `formatSGD()`, `formatShares()`, `formatDate()`, `formatDateTime()` |
| `src/lib/google-sheets.ts` | Full Sheets CRUD including `getPortfolioHistory`, `findHistoryRowByDate`, `upsertHistoryEntry` |
| `src/lib/yahoo-finance.ts` | Price + FX fetch with 3-tier fallback (live → cached sheet → hardcoded) |
| `src/lib/portfolio.ts` | `computePortfolioSnapshot`, `computeNewAvgCost`, `computeGap`, `computeRecommendedUnits`, `groupByMonth` |

### Server Actions (`src/app/lib/actions.ts`)

- `upsertHoldingAction`, `deleteHoldingAction`
- `logTransactionAction` — BUY recalculates avg cost; SELL reduces shares, deletes if zero
- `updateCashAction`, `upsertCashAccountAction`, `deleteCashAccountAction`, `renameCashAccountAction`
- `saveTargetAllocationsAction` — writes to `TargetAllocation` sheet, revalidates `/dashboard` and `/plan`
- `saveScheduleAction` — writes to `InvestmentSchedule` sheet, revalidates `/plan`
- `recordSnapshotAction` — fetches live prices, guards against stale data, upserts `PortfolioHistory` row, revalidates `/history`

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
- `POST /api/setup/provision` — creates all 7 tabs including `PortfolioHistory`
- `POST /api/setup/save`

### Pages

- `/` → redirects to `/dashboard`
- `/dashboard` — full portfolio view: KPI cards (Total Value, All-time Return, MTD), holdings table, allocation donut, history chart + attribution breakdown. Auto-records a snapshot fire-and-forget on every load (skips if prices stale)
- `/holdings` — list with edit/delete; `/holdings/new`; `/holdings/[ticker]`
- `/transactions` — list with BUY/SELL badges; `/transactions/new`
- `/cash` — multi-account cash management
- `/plan` — three sections: current portfolio reference + buy recommendations, target allocation editor, investment schedule editor
- `/setup` — credential entry, connection test, sheet provisioning (migration sections removed — sheets already up to date)

### Components

| Component | Type | Purpose |
|---|---|---|
| `Nav` | client | Fixed left sidebar — Dashboard, Holdings, Transactions, Cash, Plan, Setup |
| `DashboardClient` | client | Full dashboard page — owns `excludeCash` state; renders header (with toggle), KPI cards, holdings table, allocation panel, history & attribution |
| `HoldingsTable` | client | Holdings table with 4 colour-coded column groups (position/market/perf/alloc), total gain/loss row |
| `AllocationPanel` | client | Controlled donut chart — accepts `excludeCash` from parent, no internal state |
| `AllocationChart` | client | SVG donut chart (120×120 viewBox, w-40 rendered); vertical layout with proportional bar per row; coords rounded to 4dp to prevent hydration mismatch |
| `HistoryClient` | client | Shared range selector (1D/YTD/1M/3M/6M/1Y/ALL) → `ValueHistoryChart` (left) + contribution breakdown (right); ALL range uses cost-basis P&L |
| `ValueHistoryChart` | client | SVG line chart with `preserveAspectRatio="none"` + `height="100%"`; Y/X labels in HTML overlays (not stretched); tooltip flips side near right edge; controlled via `range` prop or self-managed |
| `SnapshotButton` | client | Manual record trigger with 5 states (idle/loading/success/skipped/error) |
| `AllocationEditor` | client | Target % inputs per equity, running total, cash display |
| `ScheduleViewer` | client | Editable investment schedule; bidirectional units ↔ SGD; totals row |
| `PlanSnapshot` | client | Current portfolio reference table with cash-constrained buy recommendations (iterative convergence) |
| `RefreshButton` | client | `router.refresh()` to re-fetch live prices |
| `HoldingForm`, `TransactionForm`, `CashForm` | client | CRUD forms |

### Scripts

| Script | Purpose |
|---|---|
| `scripts/snapshot.ts` | Standalone daily snapshot — loads `.env.local` via dotenv, no HTTP server needed. Run: `npx tsx scripts/snapshot.ts` |
| `scripts/backfill.ts` | One-off historical backfill — reads existing dates once, batch-appends all new rows in a single Sheets call (avoids read quota). `FROM_DATE = 2026-01-01`. Run: `npx tsx scripts/backfill.ts` |

---

## Google Sheets Tab Structure

Seven tabs. Row 1 = header. Data starts at row 2.

| Tab | Columns |
|---|---|
| `Holdings` | A:ticker B:name C:shares D:avg_cost_local E:currency |
| `Cash` | A:account B:currency C:amount |
| `Transactions` | A:id B:date C:ticker D:type E:shares F:price_local G:currency |
| `TargetAllocation` | A:ticker B:target_pct |
| `InvestmentSchedule` | A:month B:ticker C:name D:planned_sgd |
| `FxRates` | A:pair B:rate C:fetched_at |
| `PortfolioHistory` | A:date B:total_value_sgd C:fx_usdsgd D:fx_hkdsgd E:recorded_at |

### Migration notes

All migrations have been applied. The sheets are fully up to date with all 7 tabs. Migration UI was removed from `/setup` in v0.4.

---

## Automated Snapshot — macOS launchd

The launchd job `com.wellspring.snapshot` is installed and loaded on this machine. It runs `scripts/snapshot.ts` Mon–Fri at 18:00 local time (after SGX closes).

- Plist: `~/Library/LaunchAgents/com.wellspring.snapshot.plist`
- Logs: `/tmp/wellspring-snapshot.log` and `/tmp/wellspring-snapshot.error.log`
- npx path used: `/opt/homebrew/bin/npx` (Homebrew install)
- If Mac is asleep at 18:00, launchd runs on next wake

Manage:
```bash
launchctl unload ~/Library/LaunchAgents/com.wellspring.snapshot.plist  # disable
launchctl load   ~/Library/LaunchAgents/com.wellspring.snapshot.plist  # re-enable
launchctl list | grep wellspring                                        # check status
```

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

`computeGap(targetPct, currentPct) = Math.round((currentPct - targetPct) * 10) / 10`

Negative = underweight (current < target, shown in red). Positive = overweight.

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
- **Scripts** — load `.env.local` via `config({ path: resolve(__dirname, '../.env.local') })` from `dotenv`; use UTC-safe date parsing (parse date parts manually, never `new Date('YYYY-MM-DD')` which shifts by timezone)

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

## What to Build Next (Post v0.3 Ideas)

- Vercel deployment + environment variable configuration
- Transaction history filterable by ticker
- Support for additional tickers
- Unit/property tests for pure functions in `portfolio.ts`
