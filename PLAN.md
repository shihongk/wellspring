# Wellspring — Implementation Plan

## Status

| Version | Date | Status |
|---|---|---|
| v0.1 | 2026-04-14 | ✅ Complete |
| v0.2 | 2026-04-16 | ✅ Complete |
| v0.3 | 2026-04-16 | ✅ Complete |
| v0.4 | 2026-04-18 | ✅ Complete |
| v0.4.1 | 2026-04-20 | ✅ Complete |

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

## v0.4.1 — UX Patches (Complete)

Patch release fixing chart rendering, allocation panel layout, gap sign, and backfill reliability.

### Changes shipped

- **History chart ranges** — added `1D` (last 2 snapshots) and `YTD` (Jan 1 of current year) to both the dashboard history panel and the `/history` page
- **Chart axis rendering** — Y-axis labels and X-axis labels moved from SVG to HTML overlays; SVG uses `preserveAspectRatio="none"` + `height="100%"` so the chart area fills the column height and labels render at normal font size without distortion
- **Tooltip overflow fix** — tooltip is rendered outside the scroll container and flips to the left side when the cursor is past 60% of chart width; no horizontal scrollbar
- **Allocation panel** — donut enlarged (`w-40`), layout changed to vertical (donut above legend), each legend row has an inline proportional bar; panel height matches the History & Attribution card
- **X-axis / "Current total" alignment** — chart column uses `flex flex-col h-full`; x-axis label row with `border-t border-gray-100` at the bottom aligns with the breakdown footer
- **Gap sign corrected** — `computeGap` now returns `currentPct − targetPct` (negative = underweight, shown in red)
- **Hydration fix** — `polarToCartesian` rounds coordinates to 4 decimal places to prevent SSR/client path mismatch in the donut SVG
- **Backfill script** — reads existing dates in one call then batch-appends all new rows in a single Sheets API request; avoids per-row read quota exhaustion; `FROM_DATE` set to `2026-01-01` for YTD backfill

---

## v0.4 — Dashboard Redesign & UX Polish (Complete)

Merged the `/history` tab into the dashboard, added a contribution breakdown panel, and tightened the layout to fit in a single screen.

### Changes shipped

**Dashboard (`src/app/dashboard/page.tsx`)**
- Now purely data-fetching; all rendering delegated to `DashboardClient`
- Passes `fxRates`, `stale`, `fetchedAtLabel`, `chartData`, `breakdown` as props

**`DashboardClient` (full page client component)**
- Owns `excludeCash` state — single toggle in the page header controls both the table alloc% column and the allocation donut simultaneously
- Renders page header (h1 + toggle + SnapshotButton + RefreshButton), KPI cards, holdings table, and the bottom Allocation | History row
- KPI computation (all-time return, MTD) moved from server to client, derived from `snapshot` + `chartData`

**New components**
- `HistoryClient` — shared range selector (default 1Y) drives both `ValueHistoryChart` (left) and contribution breakdown (right); ALL range uses cost-basis P&L, period ranges use weight-based approximation
- `AllocationPanel` — now a controlled, stateless component; accepts `excludeCash` prop from parent

**Removed**
- `/history` page removed from nav (still exists at URL but not linked)
- "vs Target" section removed from allocation panel (redundant with Gap column in table)
- All three migration sections removed from `/setup` page (`MigrateCashSection`, `MigrateHistorySection`, `MigratePlanSection`)

**UX density improvements**
- Holdings table rows: `py-3` → `py-1.5` (~80px saved)
- History chart height: 280 → 160px
- Allocation donut: `w-36` → `w-24`
- Section spacing: `space-y-6` → `space-y-4`
- Contribution breakdown: 2-line+bar per row → compact single-line with colour dot

---

## v0.3 — Portfolio Value History (Complete)

Track total portfolio value (SGD) over time. Daily snapshots recorded automatically via macOS launchd. No external hosting required — fully local.

Reference: SPEC.md §19 (feature) and §20 (launchd setup).

---

### Phase 1 — Types & data layer

**1.1** Add `PortfolioHistoryEntry` to `src/types/index.ts`
```ts
export interface PortfolioHistoryEntry {
  date: string;         // YYYY-MM-DD
  totalValueSGD: number;
  fxUSDSGD: number;
  fxHKDSGD: number;
  recordedAt: string;   // ISO 8601 UTC
}
```

**1.2** Add `PortfolioHistory` to `SHEET_NAMES` in `src/lib/constants.ts`

**1.3** Add three Sheets helpers to `src/lib/google-sheets.ts`:
- `findHistoryRowByDate(sheets, date: string): Promise<number | null>` — returns 1-based row index or null
- `upsertHistoryEntry(entry: PortfolioHistoryEntry): Promise<void>` — calls findHistoryRowByDate; overwrites if found, appends if not
- `getPortfolioHistory(): Promise<PortfolioHistoryEntry[]>` — reads all rows, returns sorted ascending by date

---

### Phase 2 — Server Action

**2.1** Add `recordSnapshotAction` to `src/app/lib/actions.ts`:
- Fetches live prices via `fetchPricesAndFX()`
- If prices are stale → return `{ recorded: false, reason: 'prices-stale' }`
- Reads holdings + cash from Sheets
- Calls `computePortfolioSnapshot()` for `totalValueSGD`
- Calls `upsertHistoryEntry()` with today's date, value, and FX rates
- Calls `revalidatePath('/history')`
- Returns `{ recorded: true }` on success

---

### Phase 3 — Standalone snapshot script

**3.1** Install dev dependencies:
```bash
npm install --save-dev tsx dotenv
```

**3.2** Create `scripts/snapshot.ts`:
- Load `.env.local` via `dotenv/config`
- Import directly from `src/lib/` (no HTTP)
- Same logic as the server action: fetch → compute → upsert
- Exit `process.exit(1)` on Yahoo Finance failure (never write stale data)
- Log result: `Snapshot recorded: 2026-04-16 S$142,350.00` or error details
- Runnable via `npx tsx scripts/snapshot.ts`

---

### Phase 4 — UI components

**4.1** Create `src/components/snapshot-button.tsx` (`'use client'`):
- Calls `recordSnapshotAction()` on click
- Five states: idle / loading / success ("Recorded") / skipped ("Already up to date") / error ("Failed — try again")
- Auto-resets to idle after 3s (success/skipped) or 5s (error)

**4.2** Create `src/components/value-history-chart.tsx` (`'use client'`):
- Props: `{ data: { date: string; totalValueSGD: number }[] }`
- Internal state: `range` (`'1M' | '3M' | '6M' | '1Y' | 'ALL'`, default `'3M'`) and `tooltip`
- Range selector filters data before rendering
- Pure SVG — viewBox `0 0 600 280`, plot area 510×220 with padding (top 20, right 20, bottom 40, left 70)
- Y-axis: 5 grid lines + `S$XXX,XXX` labels
- X-axis: up to 6 sparse date labels (`MMM 'YY`)
- Area fill under line: `--color-primary` at 10% opacity
- Polyline: 2px stroke, `--color-primary`
- Hover: transparent overlay rect → nearest point by x → tooltip div (date + `S$XXX,XXX.XX`)
- Empty state (<2 points): SVG text "Not enough data yet"
- Wrapper: `<div className="w-full overflow-x-auto">` for responsiveness

**4.3** Create `src/app/history/page.tsx` (Server Component):
- `export const dynamic = 'force-dynamic'`
- Calls `getPortfolioHistory()` directly
- Empty state: message with instructions to run script or visit dashboard
- Stats row (3 `<Stat>` cards):
  - Latest value (`totalValueSGD` of most recent entry)
  - Month-to-date change (first entry of current month → latest, SGD + %)
  - All-time change (first entry ever → latest, SGD + %)
- `<ValueHistoryChart data={...} />` — passes full dataset
- `<SnapshotButton />` — manual trigger

---

### Phase 5 — Dashboard auto-record

**5.1** In `src/app/dashboard/page.tsx`, after computing the snapshot:
- Fire `recordSnapshotAction()` without `await` (non-blocking)
- Dashboard renders identically regardless of outcome

---

### Phase 6 — Navigation

**6.1** Add **History** link to `src/components/nav.tsx` between Dashboard and Holdings

---

### Phase 7 — Google Sheet migration

**7.1** Add `PortfolioHistory` to the `TABS` array in `src/app/api/setup/provision/route.ts`:
```ts
{ title: 'PortfolioHistory', headers: ['date', 'total_value_sgd', 'fx_usdsgd', 'fx_hkdsgd', 'recorded_at'] }
```
This ensures fresh full-setup runs create the tab automatically.

**7.2** Create `src/app/api/setup/migrate-history/route.ts` (`POST`):
- Accept `{ spreadsheetId, serviceAccountEmail, privateKey }`
- Check if `PortfolioHistory` tab already exists → return `{ alreadyExists: true }` if so
- Otherwise: create the tab via `batchUpdate`, write header row, return `{ success: true, created: ['PortfolioHistory'] }`
- Error shape: `{ error: string }` with status 400

**7.3** Add `MigrateHistorySection` to `src/app/setup/page.tsx`:
- Follows the exact same pattern as `MigrateCashSection` and `MigratePlanSection`
- Description, button ("Add PortfolioHistory tab"), calls `/api/setup/migrate-history`
- States: idle / running / done / already-exists / error
- Rendered at the bottom of the page after `<MigratePlanSection />`

---

### Phase 8 — launchd setup (one-time, local machine)

**8.1** Create `~/Library/LaunchAgents/com.wellspring.snapshot.plist` per SPEC.md §20

**8.2** Run `launchctl load` to activate

**8.3** Verify with a manual test run:
```bash
npx tsx scripts/snapshot.ts
```
Check `/tmp/wellspring-snapshot.log` and confirm a row appears in the `PortfolioHistory` sheet.

---

### Completion checklist

- [x] `PortfolioHistoryEntry` type added
- [x] `SHEET_NAMES.PORTFOLIO_HISTORY` constant added
- [x] 3 Sheets helpers implemented and typed
- [x] `recordSnapshotAction` implemented with stale-price guard
- [x] `scripts/snapshot.ts` runnable via `npx tsx`
- [x] `<SnapshotButton>` with all 5 states
- [x] `<ValueHistoryChart>` with range selector, area fill, hover tooltip
- [x] `/history` page with stats + chart + button + empty state
- [x] Dashboard auto-record wired up (non-blocking)
- [x] History link in nav
- [x] `PortfolioHistory` added to provision route `TABS` array
- [x] `POST /api/setup/migrate-history` route implemented
- [x] `MigrateHistorySection` added to setup page
- [ ] launchd plist installed and verified (one-time manual step — see SPEC.md §20)

---

## Post-v0.3 Ideas

- Vercel deployment
- Transaction history filter by ticker
- Additional tickers
- Property-based tests for pure functions (`computeGap`, `computeRecommendedUnits`, `groupByMonth`)

---

## Notes for next session

- launchd job is installed and running on this machine (`/opt/homebrew/bin/npx` path)
- `scripts/backfill.ts` is a one-off utility — can be re-run if holdings change (it overwrites via upsert)
- Timezone bug fixed in scripts: always use UTC-safe date parsing (`Date.UTC(y, m-1, d)`)
- Yahoo Finance `historical()` is deprecated in favour of `chart()` — non-breaking for now but worth migrating eventually
