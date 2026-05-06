# Wellspring — Handover Document

## What This Project Is

Personal SGD-denominated investment portfolio tracker. Web app backed by Google Sheets (no database). Market data from Yahoo Finance. Built with Next.js 16.2.3 App Router, TypeScript, Tailwind CSS v4.

---

## Retirement Chart & One-off Improvements (2026-05-06)

### One-off expenses — today's prices + inflation

- `RetirementOneOff` gains optional `inTodaysPrices?: boolean` (sheet column E, stored as `'TRUE'`/`'FALSE'`)
- `RetirementSettings` gains `inflationRate: number` (default 2.5 %, persisted in `localStorage`)
- Projection engine (`projections.ts`): when `inTodaysPrices` is set, amount is inflated as `amount × (1 + rate/100)^(year − startYear)`
- One-off form: "Today's prices" checkbox (defaults checked); "Amount" placeholder updated
- One-off table: two amount columns — **Today's $** (entered value, or `—` for nominal entries) and **Projected** (inflation-adjusted, muted)
- Projection Settings panel: new **Inflation Rate (%)** input (grid now 6 columns)

### Projection chart hover tooltip

- Hover over any year → snaps to nearest data point; shows vertical dashed line + DOM circle (not SVG — avoids distortion from `preserveAspectRatio="none"`)
- Tooltip shows: **Income** and **Expenses** from the actual expense projection (reads `wellspring_projection_settings` from localStorage, same store as the Expenses tab); **CPF LIFE** line once payouts start; portfolio breakdown (Investments, CPF OA/SA+RA/MA, Cash Reserve); **Net Worth**; one-offs if any
- Expense data flow: `retirement/page.tsx` now fetches `getExpenses()` + `getProjectionOverrides()` and passes to `RetirementClient`; `useMemo` in client runs `computeBaselineAverages` + `generateProjections` for all projection-horizon months, aggregates to `Record<year, { income, expenses }>`
- Removed redundant "Age 65" chart label (retirement age already shown in KPI heading)
- Fixed x-axis label overlap near origin: first tick left-aligns, last tick right-aligns, "0" y-axis baseline label suppressed

### Sheet schema update

- `RetirementOneOffs`: `id | year | description | amount_sgd | in_today_prices`

---

## Current State — v0.8 (complete)

All 6 phases of v0.8 are complete.

- **Phase 1**: Added `CpfTransaction` to types, updated `constants.ts` with `SHEET_NAMES.CPF_TRANSACTIONS` and HDB/MA deductions, and added `POST /api/setup/migrate-cpf-transactions` and wired to provision route.
- **Phase 2**: Created `parseCpfTransactions` inside `cpf-annual.ts` to parse individual transactions from the statement.
- **Phase 3**: Added Google Sheets read/write/append operations for CPF transactions (`getCpfTransactionKeys`, `appendCpfTransactions`, `getCpfTransactions`).
- **Phase 4**: Wired CPF transaction saving into `pipeline.ts` for `cpf-annual` statements.
- **Phase 5**: Deducted HDB OA and MediSave MA premiums in the CPF projection engine.
- **Phase 6**: Created `CpfTransactionList` component, updated `ExpensesClient` to introduce a dedicated `CPF` tab between `Transactions` and `Projections`, and updated `page.tsx` to load and pass transactions down.

### Tests

All 145 tests pass (two regressions introduced by Gemini were fixed: `pipeline.test.ts` fs mock + `hsbc-composite.ts` parser rewrite).

---

## v0.7 Complete (2026-05-06)

All 6 phases shipped. See per-phase sections below for detail.

## Current State — v0.7 Phase 6 (complete)

### Phase 6 — Navigation & Provisioning ✅

- `src/components/setup/MigrateRetirementSection.tsx` — `'use client'` component; calls `POST /api/setup/migrate-retirement` (no body, uses `process.env`); handles `idle | running | done | already-exists | error` states.
- Rendered in `src/app/setup/page.tsx` under a "Migrations" heading below the main form.

## Current State — v0.7 Phase 5 (complete)

### Phase 5 — Retirement Page ✅

- `src/app/retirement/page.tsx` — Server Component; fetches CPF balances, one-offs, holdings, and prices; computes `currentPortfolioByTicker` and `tickerWeights`.
- `src/components/retirement/RetirementClient.tsx` — Client Component; settings panel (collapsible), SVG projection chart (Net Worth / Stacked Breakdown modes), KPI cards at retirement age.
- Implemented One-off Expenses editor with optimistic `saveRetirementOneOffAction` and `deleteRetirementOneOffAction`.
- Settings (including per-ticker returns) automatically persist to `localStorage`.
- Added "Retirement" link to the sidebar navigation between Expenses and Plan.
- Projection logic ignores initial cash by design, focusing on injecting ongoing surplus cash + CPF LIFE cash flow.

---

## Current State — v0.7 Phase 4 (complete)

### Phase 4 — CPF Panel in Expenses Tab ✅

- Created `src/components/expenses/CpfPanel.tsx` (`'use client'`) component showing CPF balances and an estimated monthly contribution breakdown.
- Implemented an inline form to update balances, which fires `saveCpfBalanceAction` with optimistic updates.
- Handled empty state prompting the user to enter their initial balances.
- Wired into `src/components/expenses/ExpensesClient.tsx` (rendered above the tab bar) and updated its prop signature.

---
 
All v0.7 phases are complete. The retirement tracking feature is fully shipped!

---

## Current State — v0.7 Phases 1–3 (complete, 2026-05-06)

### Phase 1 — Types, Schema & Data Layer ✅

| Change | Detail |
|---|---|
| `src/types/index.ts` | `CpfBalance`, `RetirementOneOff`, `CpfProjectionYear` (incl. `brsWithdrawal`), `RetirementProjectionYear`, `RetirementSettings` added |
| `src/lib/constants.ts` | `SHEET_NAMES.CPF_BALANCES`, `SHEET_NAMES.RETIREMENT_ONE_OFFS`; `CPF_CONTRIBUTION_RATES`, `CPF_ALLOCATION_RATES`, `CPF_INTEREST`, `CPF_RETIREMENT_SUMS_2026`, `CPF_LIFE_BASE_BRS_MONTHLY`, `CPF_LIFE_DEFERRAL_BONUS` added |
| `src/lib/retirement/sheets.ts` | `getCpfBalances`, `getLatestCpfBalance`, `upsertCpfBalance`, `getRetirementOneOffs`, `upsertRetirementOneOff`, `deleteRetirementOneOff` |
| `src/app/lib/actions.ts` | `saveCpfBalanceAction`, `saveRetirementOneOffAction`, `deleteRetirementOneOffAction` added |
| `src/app/api/setup/provision/route.ts` | `CpfBalances` and `RetirementOneOffs` tabs added to `TABS` array |
| `src/app/api/setup/migrate-retirement/route.ts` | New route — idempotent, returns `{ created, skipped }` |
| `scripts/migrate-retirement.ts` | One-off migration script — **already run**, both tabs exist in sheet |

**Sheet schema:**
- `CpfBalances`: `date | oa | sa | ma`
- `RetirementOneOffs`: `id | year | description | amount_sgd`

### Phase 2 — CPF Computation Engine ✅

**File:** `src/lib/retirement/cpf.ts`

| Function | Purpose |
|---|---|
| `getCpfContributionRate(age)` | Returns `{ employer, employee, total }` from 5 age brackets (≤55 / 55–60 / 60–65 / 65–70 / >70). Lookup: first bracket where `age <= maxAge` |
| `getCpfAllocationRates(age)` | Returns `{ oa, sa, ma }`. SA = 0 for age > 55. RA residual computed in engine as `total - oa - sa - ma` |
| `projectCpfYear(params)` | Single-year projection: contributions → interest (incl. extra 1% on first $60k) → age-55 SA→RA transfer + BRS withdrawal → CPF LIFE payout at `payoutStartAge`. Accepts `lockedCpfLifePayout` to carry forward once set |
| `projectCpf(params)` | Year-by-year array from `startBalances.date` through `endYear` |

**Key design notes:**
- RA allocation for age ≥ 55 computed as `total − oa − sa − ma` (the SA→RA routing); matches CPF official rates (11.5% at 55–60, 11% at 60–65, 5% at 65–70)
- `brsWithdrawal` field on `CpfProjectionYear`: non-zero only at age 55; OA excess above projected BRS withdrawn (user pledges property for BRS)
- CPF LIFE payout = `(ra / projectedBRS) × 950 × (1.07)^(payoutStartAge − 65)`
- BRS grows 3.5%/yr from 2026 base $110,200

**Tests:** `src/lib/retirement/__tests__/cpf.test.ts` — 17 tests, all passing

### Phase 3 — Retirement Projection Engine ✅

**File:** `src/lib/retirement/projections.ts`

**`projectRetirement(params) → RetirementProjectionYear[]`**

Per-year logic:
1. Run `projectCpfYear` (zero salary after `retirementAge`)
2. `netInvestable = netMonthlyCashFlow × 12 + cpfLifeAnnual + brsWithdrawal − oneOffExpenses`
3. Apply annual ticker returns to each position
4. Inject/draw `netInvestable` proportionally by `tickerWeights`; if portfolio exhausted, overflow to negative `cashReserve`
5. `netWorth = investments + totalCpf + max(0, cashReserve)`; `netMonthlyCashFlow = input + cpfLifeMonthlyPayout`

**Tests:** `src/lib/retirement/__tests__/projections.test.ts` — 9 tests, all passing

---

## Current State — v0.6 post-launch improvements (2026-05-05)

| Change | Detail |
|---|---|
| Chart tooltip | Hover over any bar → floating card showing Income / Expense / Net; "proj" badge on projected bars; tooltip clamps to chart bounds |
| Net line overlay | "both" mode only: solid cyan line for actuals, dashed for projected, filled/open dots at each point; legend updated |
| Per-category projection modes | 5 modes: Rolling avg (default), Annual avg (last 12m ÷ 12), 6-monthly avg (last 6m ÷ 6), Latest month, Fixed amount |
| Category Modes panel | Collapsible panel between controls and KPI cards; grid of mode cards per category; "(N custom)" badge in header; mode descriptor shown in each card; settings persisted to localStorage |
| Mode badges in matrix | Non-rolling categories show amber pill (`12m` / `6m` / `latest` / `fixed`) next to name in projection matrix |
| "Rolling baseline" label | Renamed from "Baseline period" to clarify it only applies to rolling-mode categories |
| Net 1M KPI | Added as first KPI card; grid now 4 columns |
| `computeBaselineAverages` | Now accepts `categoryModes` param; computes rolling, 12m, 6m, per-month totals in a single transaction pass |
| New types | `ProjectionMode` and `CategoryProjectionSetting` in `src/types/index.ts` |

---

## Current State — v0.6 (complete, 2026-05-04) — PROJECTIONS

### v0.6 Phase 1 — Types, Schema & Data Layer (complete)

| Change | Detail |
|---|---|
| `src/types/index.ts` | `oneOff?: boolean` added to `ExpenseTransaction`; `ExpenseProjectionOverride`, `InflationSettings` interfaces added |
| `src/lib/constants.ts` | `SHEET_NAMES.EXPENSE_PROJECTIONS = 'ExpenseProjections'` added |
| `src/lib/expenses/sheets.ts` | `updateExpenseOneOff(id, oneOff)`, `getProjectionOverrides()`, `upsertProjectionOverride()`, `deleteProjectionOverride()` added; `getExpenses`/`appendExpenses` ranges extended to col M |
| `src/app/lib/actions.ts` | `setExpenseOneOffAction`, `saveProjectionOverrideAction`, `deleteProjectionOverrideAction` added |
| `src/app/api/setup/provision/route.ts` | `Expenses` headers updated to include `one_off`; `ExpenseProjections` tab added |
| `src/app/api/setup/migrate-projections/route.ts` | Migration route created (adds `one_off` col + `ExpenseProjections` tab) |
| `scripts/migrate-projections.ts` | One-off migration script — already run, `ExpenseProjections` tab exists in sheet |
| `src/components/expenses/ExpensesClient.tsx` | One-off toggle added to expanded `TxRow` |

### Expenses sheet schema (columns A–M)

`id | date | post_date | description | amount | direction | balance | account | category | source_file | imported_at | excluded | one_off`

Column `one_off` is col M (added v0.6). Existing rows without it read as `false`.

### v0.6 Phase 2 — Core Projection Logic (complete)

| File | Purpose |
|---|---|
| `src/lib/expenses/projections.ts` | `computeBaselineAverages`, `generateProjections`, `aggregateCashFlow` |
| `src/lib/expenses/__tests__/projections.test.ts` | 16 tests — all passing |

**`computeBaselineAverages(transactions, startMonth, endMonth)`**
- Excludes `excluded`, `oneOff`, `Transfer`, `Investment`
- Expense categories: sums debits; income categories: sums credits
- Divides by total months in window (not just months with data)

**`generateProjections(baselineAverages, overrides, targetMonths, inflationSettings)`**
- Overrides replace baseline (no inflation applied to overrides)
- Inflation compounded annually: year index relative to first target month's year
- Income categories use `incomeGrowthRate`; expense categories use `expenseInflationRate`
- Rates are percentages (e.g. `10` = 10%)

**`aggregateCashFlow(projections, incomeCategories)`**
- Returns `{ next3M, next6M, next12M }` — net = income − expense for first N months

### v0.6 Phase 3 — UI (complete)

| File | Change |
|---|---|
| `src/lib/expenses/projections.ts` | `INCOME_CATEGORIES` exported as `string[]` |
| `src/app/expenses/page.tsx` | `getProjectionOverrides()` fetched and passed to client |
| `src/components/expenses/ExpensesClient.tsx` | `overrides` prop added; top-level `Transactions / Projections` tab added; `ProjectionsTab` rendered when on projections tab |
| `src/components/expenses/ProjectionsTab.tsx` | New component — baseline period controls, inflation settings, rolling KPI cards (3M/6M/12M), bar chart (solid actuals + faded projections, monthly ≤24 / annual >24), category matrix with inline cell editor + override save/delete |

**ProjectionsTab features:**
- Baseline period and inflation settings persisted to `localStorage`
- Bar chart view modes: Income + Expense (stacked, green above / red below zero) | Income | Expense | Net — toggle in chart header
- Annual view overlap fix: baseline years that overlap with projected years are dropped from actuals to avoid double bars
- Per-category exclusion: click any category name to exclude it from chart and KPI totals; excluded rows stay visible but dimmed
- Grouped collapsible matrix: Income section + Expenses section (sub-groups: Living / Lifestyle / Financial / Other); each section and sub-group independently collapsible with Expand All / Collapse All shortcut; Total Income, Total Expenses, and Net rows always reflect excluded-category state
- Overrides use `saveProjectionOverrideAction` / `deleteProjectionOverrideAction` with optimistic updates

**Expense sub-group mapping** (defined in `ProjectionsTab.tsx` as `EXPENSE_SUBGROUP_MAP`):
- Living: Food & Drink, Groceries, Healthcare, Mortgage, Transport, Utilities
- Lifestyle: Books & Stationery, Entertainment, Home Improvement, Shopping, Subscriptions, Travel
- Financial: Bank Charges, Fees & Charges, Tax
- Other: anything unmapped

---

## Current State — v0.5 (complete, 2026-05-03) — EXPENSE TRACKER

All 12 phases complete + post-launch UI/categorisation improvements. 103 tests passing.

### v0.5 — what was built

| File | Purpose |
|---|---|
| `src/types/index.ts` | `ExpenseTransaction` (incl. `excluded?: boolean`), `ExpenseRule` added |
| `src/lib/constants.ts` | `SHEET_NAMES`, `EXPENSE_CATEGORIES` (21 categories), `BUILT_IN_RULES` (~60 rules) |
| `src/lib/expenses/utils.ts` | `generateId`, `parseAmount`, `parseDDMMM`, `parseDDMMMYYYY`, `inferYear`, `directionFromDelta`, `isCreditFromSuffix`, `isCreditFromParens` |
| `src/lib/expenses/categorize.ts` | `categorize(description, userRules)` — user rules → built-in → 'Other' |
| `src/lib/expenses/detect.ts` | `detectStatementType(filename, text)` — text signals first, filename fallback |
| `src/lib/expenses/parsers/uob-deposit.ts` | Multi-page concat-amount format; direction from balance delta |
| `src/lib/expenses/parsers/uob-credit.ts` | Per-card sections; GIRO PAYMENT and CR-suffix amounts → credit |
| `src/lib/expenses/parsers/citi-credit.ts` | Space-separated and concatenated (no-space) PDF formats both handled |
| `src/lib/expenses/parsers/ocr-utils.ts` | `pdfToImages` + `ocrImage` + `ocrPdf` via pdf2pic + tesseract.js |
| `src/lib/expenses/parsers/hsbc-credit.ts` | OCR text; CR suffix → credit |
| `src/lib/expenses/parsers/hsbc-composite.ts` | OCR text; savings section only |
| `src/lib/expenses/sheets.ts` | `getExpenses`, `getExpenseIds`, `appendExpenses`, `getExpenseRules`, `upsertExpenseRule`, `updateExpenseCategory`, `updateExpenseExcluded`, `applyRuleToExisting`, `bulkUpdateExpenseCategory` |
| `src/lib/expenses/pipeline.ts` | `importStatements(folder)` — dedup, error isolation, categorize |
| `scripts/import-statements.ts` | CLI entry point |
| `src/app/api/expenses/import/route.ts` | `POST /api/expenses/import` |
| `src/app/expenses/page.tsx` | Server Component, force-dynamic |
| `src/components/expenses/ExpensesClient.tsx` | Full UI — see below |
| `src/components/expenses/ImportButton.tsx` | POST to import route; idle/loading/done/error with 5s reset |
| `src/app/lib/actions.ts` | `updateExpenseCategoryAction`, `setExpenseExcludedAction`, `createExpenseRuleAction`, `bulkUpdateCategoryAction` |
| `src/components/nav.tsx` | Expenses link after Cash |
| `src/app/api/setup/provision/route.ts` | Expenses + ExpenseRules tabs; Expenses has 12 columns incl. `excluded` |

### ExpensesClient UI features

- **Separate spending / income sections** — debits in Spending, credits in Income, each with their own table and a central, large **Donut pie chart** for visual breakdown.
- **Annual fee banner** — discreet banner grouping annual fees by account (merging GST items), showing just the card name and date for waiver tracking.
- **Exclusion toggles** — "Hide excluded" and "Hide investment" checkboxes to refine the view and keep charts balanced. Per-row exclusion grays out rows and excludes them from totals.
- **Create rule** — `rule` button per row opens inline form; pre-fills merchant by stripping trailing reference codes; saves to ExpenseRules and retroactively re-categorises existing 'Other' transactions.
- **Apply to all** — on category change, if other transactions share the same description, a sub-row prompt appears directly below the changed row offering to bulk-apply.

### Expenses sheet schema (columns A–L)

`id | date | post_date | description | amount | direction | balance | account | category | source_file | imported_at | excluded`

Column `excluded` is new (2026-05-03). Existing rows without it read as `false`. Safe to re-import — dedup by `id` prevents duplicates.

### How to use

**Import via CLI:**
```bash
npx tsx scripts/import-statements.ts '/Users/shihong/Documents/Claude/Financial Planning'
```

**Import via UI:** Visit `/expenses` → Import Statements button.

**Sheet:** `1MhApHzK0fHJT6SnTacD8rrq4yyA1ZVQIHv_FckPbyhA` — tabs already provisioned. Sheet currently has ~100 rows (82 UOB + 18 Citi Apr 2026 from last import).

### What remains

- **Self-transfer deduplication (#4)** — transfers between own accounts are double-counted (debit on one, credit on the other). Mechanism exists: user can manually exclude both legs. Auto-detection not yet designed. Tracked in ROADMAP.md.

### Key design decisions for v0.5

- `pdf-parse` pinned to v1 — v2 breaks ESM default import with tsx
- Dedup: SHA-256 of `date|description|amount|account`, first 16 hex chars; safe to re-run import
- Categorisation: keyword rule engine only; no AI cost; user overrides in ExpenseRules sheet
- Citi CCY CONVERSION FEE pre-categorised as 'Bank Charges' by parser; pipeline skips categorise() when category ≠ 'Other'
- `applyRuleToExisting` only updates rows where category is currently 'Other' — preserves manually-set categories
- `bulkUpdateCategoryAction` uses batch Sheets API write (one call for N rows)
- HSBC image PDFs require: `brew install ghostscript graphicsmagick`

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

## Google Sheets Tab Structure (12 tabs)

Twelve tabs. Row 1 = header. Data starts at row 2.

| Tab | Columns |
|---|---|
| `Holdings` | A:ticker B:name C:shares D:avg_cost_local E:currency |
| `Cash` | A:account B:currency C:amount |
| `Transactions` | A:id B:date C:ticker D:type E:shares F:price_local G:currency |
| `TargetAllocation` | A:ticker B:target_pct |
| `InvestmentSchedule` | A:month B:ticker C:name D:planned_sgd |
| `FxRates` | A:pair B:rate C:fetched_at |
| `PortfolioHistory` | A:date B:total_value_sgd C:fx_usdsgd D:fx_hkdsgd E:recorded_at |
| `Expenses` | id \| date \| post_date \| description \| amount \| direction \| balance \| account \| category \| source_file \| imported_at \| excluded \| one_off |
| `ExpenseRules` | merchant \| category |
| `ExpenseProjections` | month \| category \| amount |
| `CpfBalances` | date \| oa \| sa \| ma |
| `RetirementOneOffs` | id \| year \| description \| amount_sgd |

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

## What to Build Next

See ROADMAP.md for the full backlog. Active work tracked in PLAN.md.
