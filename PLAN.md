# Wellspring — Implementation Plan

## 🚦 Current Status

- **Phase 0 (Foundation)**: ✅ Completed
- **Phase 1 (API Routes)**: ✅ Completed
- **Phase 2 (UI Shell)**: ✅ Completed
- **Phase 3 (Holdings CRUD)**: ✅ Completed
- **Phase 4 (Transactions & Cash UI)**: ✅ Completed
- **Phase 5 (Monthly Plan UI)**: 🔜 Next — start here
- **Phase 6 (Dashboard)**: ⏳ Pending
- **Phase 7 (Polish)**: ⏳ Pending

## 📍 Handoff Notes (2026-04-14)

**Resume at Phase 5.** All Phase 4 tasks are fully implemented and verified:
- `src/components/transaction-form.tsx` — complete with currency auto-fill, `useTransition` loading state, client-side validation
- `src/app/transactions/page.tsx` — real data, BUY/SELL colour badges
- `src/app/transactions/new/page.tsx` — wired to `logTransactionAction`
- `src/components/cash-form.tsx` — shows current balance read-only, update input
- `src/app/cash/page.tsx` — fetches real cash from Sheets
- `logTransactionAction` in `src/app/lib/actions.ts` — BUY recalculates avg cost via `computeNewAvgCost`; SELL reduces shares and deletes holding if shares reach zero

**Files that exist so far:**
```
src/types/index.ts
src/lib/constants.ts
src/lib/fx.ts
src/lib/google-sheets.ts
src/lib/yahoo-finance.ts
src/lib/portfolio.ts
src/app/api/portfolio/route.ts
src/app/lib/actions.ts
src/app/page.tsx
src/app/layout.tsx
src/app/transactions/page.tsx
src/app/transactions/new/page.tsx
src/app/cash/page.tsx
src/components/nav.tsx
src/components/holding-form.tsx
src/components/transaction-form.tsx
src/components/cash-form.tsx
src/components/ui/card.tsx
src/components/ui/button.tsx
src/components/ui/input.tsx
src/components/ui/label.tsx
src/components/ui/select.tsx
src/components/ui/stat.tsx
```

**Notable gaps — files listed in Phase 1 that were NOT found on disk:**
- `src/app/api/holdings/route.ts` — not confirmed present (verify before Phase 6)
- `src/app/api/cash/route.ts` — not confirmed present
- `src/app/api/transactions/route.ts` — not confirmed present
- `src/app/api/plan/route.ts` — not confirmed present
- `src/app/api/prices/route.ts` — not confirmed present
- `src/app/holdings/page.tsx`, `holdings/new/page.tsx`, `holdings/[ticker]/page.tsx` — not confirmed present
- `src/app/plan/page.tsx` — not confirmed present (needed for Phase 5)
- `src/app/dashboard/page.tsx` — not confirmed present (needed for Phase 6)
- `src/app/globals.css` — not confirmed to have custom color tokens yet

Before starting Phase 5, run `ls src/app/api/ src/app/holdings/ src/app/plan/ src/app/dashboard/` to confirm which of these exist.

**Testing decision:** Unit tests for `src/lib/fx.ts` and `src/lib/portfolio.ts` are recommended before Phase 6, as they are pure functions whose correctness directly affects dashboard numbers. Everything else (Sheets, API routes, UI) deferred to after Phase 6 as manual or Playwright end-to-end.

## Architectural Decisions & Risks (Read First)

**Decision 1 — SVG donut chart, no chart library.**
No library is specified in the spec. Use a hand-rolled SVG stroke-dasharray donut (~60 lines). Swap later if needed.

**Decision 2 — Dashboard uses direct server-side function calls, not `fetch('/api/portfolio')`.**
The spec says "Server Component. Directly calls portfolio computation functions (not via HTTP)."

**Decision 3 — Server Actions take typed objects, not raw `FormData`.**
Client form components assemble a typed object from controlled state and pass it to the action. Avoids string-to-number coercion bugs.

**Decision 4 — Root `page.tsx` uses `redirect()` from `next/navigation`.**
Server Component — `redirect()` works correctly here.

**Decision 5 — Sheets `batchUpdate` DELETE needs the numeric `sheetId`.**
Include a `getSheetIdByName()` helper that calls `spreadsheets.get`. Not cached (no singleton rule).

**Decision 6 — `yahoo-finance2` v3: `import YahooFinance from 'yahoo-finance2'; const yf = new YahooFinance()`.**
Use `result.regularMarketPrice` for the price value.

### Risks

| Risk | Mitigation |
|---|---|
| Private key `\n` handling | Transform only inside `getSheetsClient()`, never anywhere else |
| Row index drift in DELETE | `deleteDimension` is 0-based including header (row 1 = index 0); data row N = index N |
| MonthlyPlan clear+write gap | Accept for a personal tool; data is tiny and user can re-save |
| Yahoo Finance rate limits | Fallback chain (Sheets → hardcoded) covers this; no retry needed for v1 |
| Tailwind v4 config | Use `@theme inline` in `globals.css`; no `tailwind.config.js` |

---

## Phase 0 — Foundation & Shared Libraries

**Goal:** All shared types, constants, and utility libs exist and type-check. No UI, no HTTP. The data layer is fully testable in isolation.

### Tasks

**0.1 — `src/types/index.ts`**
Paste the exact interfaces from SPEC.md §6 verbatim. All other files import from here.

Types: `Currency`, `TransactionType`, `Holding`, `Transaction`, `CashPosition`, `MonthlyPlanRow`, `FxRates`, `PortfolioHolding`, `PortfolioSnapshot`.

**0.2 — `src/lib/constants.ts`**
```ts
export const EQUITY_TICKERS = ['BRK-B', 'JK8.SI', '2823.HK', '2838.HK'] as const;
export const ALL_TICKERS = [...EQUITY_TICKERS, 'CASH'] as const;
export const FX_SYMBOLS = ['USDSGD=X', 'HKDSGD=X'] as const;
export const TICKER_CURRENCY: Record<string, Currency> = { 'BRK-B': 'USD', 'JK8.SI': 'SGD', '2823.HK': 'HKD', '2838.HK': 'HKD', 'CASH': 'SGD' };
export const SHEET_NAMES = { HOLDINGS: 'Holdings', CASH: 'Cash', TRANSACTIONS: 'Transactions', MONTHLY_PLAN: 'MonthlyPlan', FX_RATES: 'FxRates' } as const;
export const FALLBACK_FX_RATES = { USDSGD: 1.34, HKDSGD: 0.17 } as const;
```

**0.3 — `src/lib/fx.ts`**
- `toSGD(amount, currency, fxRates)` — exact formula from SPEC.md §10, throw on unknown currency
- `formatSGD(value)` — returns `S$1,234.56` (used everywhere in the UI)

**0.4 — `src/lib/google-sheets.ts`**
Private `getSheetsClient()` (never exported, never module-level), plus these exported functions:

```
getSheetIdByName(name)       → number
getHoldings()                → Holding[]
upsertHolding(h)             → void        (find by ticker, overwrite or append)
deleteHolding(ticker)        → void        (deleteDimension via batchUpdate)
getCash()                    → CashPosition
updateCash(amount)           → void
getTransactions(ticker?)     → Transaction[]  (sorted desc by date)
appendTransaction(t)         → string         (returns generated id)
getMonthlyPlan()             → MonthlyPlanRow[]
replaceMonthlyPlan(plan)     → void           (clear A2:B, then update)
getFxRates()                 → FxRates | null (null if sheet empty)
writeFxRates(rates)          → void           (caller fire-and-forgets)
```

Key implementation notes:
- `GOOGLE_PRIVATE_KEY` transform (`replace(/\\n/g, '\n')`) lives only inside `getSheetsClient()`
- `upsertHolding`: read `Holdings!A:E`, find row by ticker, `values.update` or `values.append`
- `deleteHolding`: find 0-based data row index → add 1 for header → `batchUpdate` `deleteDimension`
- `replaceMonthlyPlan`: `values.clear('MonthlyPlan!A2:B')` then `values.update('MonthlyPlan!A2', ...)`
- All sheet values arrive as `string[][]` — create internal row-to-type mappers per tab
- Guard at top of `getSheetsClient()`: throw if any env var is missing

**0.5 — `src/lib/yahoo-finance.ts`**
```ts
export interface PricesAndFx {
  fxRates: FxRates;
  prices: Record<string, { price: number | null; currency: string }>;
  stale: boolean;
  fetchedAt: string | null;
}
export async function fetchPricesAndFx(): Promise<PricesAndFx>
```

Steps:
1. `const yf = new YahooFinance()`
2. `Promise.allSettled([...EQUITY_TICKERS, ...FX_SYMBOLS].map(sym => yf.quote(sym)))`
3. Extract `result.regularMarketPrice` per symbol (null if rejected)
4. FX: if both live → `writeFxRates(...).catch(() => {})` + return live; if any failed → `getFxRates()` → else `FALLBACK_FX_RATES`; set `stale: true`
5. All equity prices failed → `stale: true`

**0.6 — `src/lib/portfolio.ts`**
```ts
export function computePortfolioSnapshot(
  holdings, prices, fxRates, cash, plan, pricesStale, pricesFetchedAt
): PortfolioSnapshot
export function computeNewAvgCost(oldShares, oldAvg, newShares, newPrice): number
```

Formulas per SPEC.md §11:
- `costBasisSGD = toSGD(shares * avgCostLocal, currency, fxRates)` — always defined
- `totalValueSGD` — null if `pricesStale` or `currentPriceLocal === null`
- `unrealizedGainSGD`, `unrealizedGainPct` — null if `totalValueSGD` null
- `grandTotalSGD` = sum of non-null `totalValueSGD` + `cash.SGD`
- `allocationPct` — null if `totalValueSGD` null or `grandTotalSGD === 0`

### Acceptance Criteria — Phase 0
- `npx tsc --noEmit` passes with zero errors across all Phase 0 files
- `toSGD(100, 'USD', { USDSGD: 1.34, HKDSGD: 0.17 })` returns `134`
- `toSGD(100, 'SGD', ...)` returns `100`
- `toSGD(100, 'JPY', ...)` throws
- `computePortfolioSnapshot` with 10 BRK-B @ avg 420 USD, current price 450, USDSGD 1.34 → `costBasisSGD = 5628`, `totalValueSGD = 6030`, `unrealizedGainSGD = 402`
- `computeNewAvgCost(10, 420, 5, 450)` returns `430`

---

## Phase 1 — API Routes (Sheets + Yahoo Finance End-to-End)

**Goal:** All seven API routes work against a real spreadsheet. Curl-testable. Proves the data layer before any UI exists.

**Prerequisite:** SPEC.md §17 Google Cloud setup must be complete. `.env.local` must have all three vars. Spreadsheet must have headers in all five tabs.

### Tasks

Every route file needs `export const dynamic = 'force-dynamic'` and uses `Request`/`Response` (not `NextApiRequest`/`NextApiResponse`).

**1.1 — `src/app/api/holdings/route.ts`**
- `GET` → `getHoldings()` → `Response.json(holdings)`
- `POST` → validate body as `Holding` (400 if missing required fields) → `upsertHolding()` → `{ success: true, ticker }`

**1.2 — `src/app/api/holdings/[ticker]/route.ts`**
`params: Promise<{ ticker: string }>` — always `await params`.
- `GET` → find holding by ticker → 404 if not found
- `PUT` → merge partial body with existing holding → `upsertHolding()`
- `DELETE` → `deleteHolding(ticker)` → 404 if ticker not in sheet

**1.3 — `src/app/api/cash/route.ts`**
- `GET` → `getCash()`
- `PUT` → body `{ amount: number }` → validate (400 if missing/negative) → `updateCash()`

**1.4 — `src/app/api/transactions/route.ts`**
- `GET` → `getTransactions(url.searchParams.get('ticker') ?? undefined)`
- `POST` → validate body → `appendTransaction()` → `{ success: true, id }`

**1.5 — `src/app/api/plan/route.ts`**
- `GET` → `getMonthlyPlan()`
- `PUT` → body `{ plan: MonthlyPlanRow[] }` → `replaceMonthlyPlan(plan)`

**1.6 — `src/app/api/prices/route.ts`**
- `GET` → `fetchPricesAndFx()` → `{ stale, fetchedAt, fxRates, prices }`

**1.7 — `src/app/api/portfolio/route.ts`**
- `GET` → `Promise.all([getHoldings(), getCash(), getMonthlyPlan(), fetchPricesAndFx()])` → `computePortfolioSnapshot()` → return `PortfolioSnapshot`

### Acceptance Criteria — Phase 1
- `GET /api/holdings` returns `[]` when Holdings sheet has only a header row
- `POST /api/holdings` with valid body → row in sheet + `{ success: true, ticker }`
- `GET /api/holdings` after POST → array with the new row
- `GET /api/holdings/BRK-B` → holding object
- `GET /api/holdings/NOPE` → 404 `{ error: "Not found" }`
- `DELETE /api/holdings/BRK-B` → `{ success: true }` + row removed from sheet
- `GET /api/cash` → `{ SGD: <number> }`
- `PUT /api/cash` with `{ amount: 5000 }` → sheet updates
- `GET /api/prices` → `fxRates.USDSGD > 0` when Yahoo Finance is reachable
- `GET /api/portfolio` → valid `PortfolioSnapshot` shape
- `POST /api/transactions` → row appended; `GET /api/transactions` returns it sorted newest-first
- `PUT /api/plan` → clears and rewrites MonthlyPlan tab
- All error responses: `{ error: string }` with correct HTTP status

---

## Phase 2 — UI Shell (Nav + Layout + Stub Pages)

**Goal:** The app has a working shell. Nav visible on all pages. All five routes render. No live data yet.

### Tasks

**2.1 — Extend `src/app/globals.css`**
Add to the existing `@theme inline` block (do not replace existing tokens):
```css
--color-gain: #16a34a;
--color-loss: #dc2626;
--color-primary: #0f766e;
```

**2.2 — Create `src/components/nav.tsx`** (`'use client'`)
- `usePathname()` for active link detection
- Links: Dashboard `/dashboard`, Holdings `/holdings`, Transactions `/transactions`, Cash `/cash`, Plan `/plan`
- App title "Wellspring" on the left
- Active link: `text-primary font-semibold`; inactive: muted
- `flex flex-wrap gap-4` for mobile

**2.3 — Update `src/app/layout.tsx`**
- `metadata.title = "Wellspring"`, `metadata.description = "Personal SGD portfolio tracker"`
- Render `<Nav />` above `{children}`
- Wrap children: `<main className="flex-1 px-4 py-6 max-w-6xl mx-auto w-full">`

**2.4 — Update `src/app/page.tsx`**
```tsx
import { redirect } from 'next/navigation';
export default function Home() { redirect('/dashboard'); }
```

**2.5 — Create stub pages**
All stubs: minimal Server Component with an `<h1>`. Dynamic routes `await params` and show the ticker. Add `export const dynamic = 'force-dynamic'` now (harmless on stubs).

- `src/app/dashboard/page.tsx`
- `src/app/holdings/page.tsx`
- `src/app/holdings/new/page.tsx`
- `src/app/holdings/[ticker]/page.tsx`
- `src/app/transactions/page.tsx`
- `src/app/transactions/new/page.tsx`
- `src/app/cash/page.tsx`
- `src/app/plan/page.tsx`

**2.6 — Create UI primitives in `src/components/ui/`**
No `'use client'` needed — purely presentational, server-renderable.

| File | Description |
|---|---|
| `card.tsx` | `<div>` with `rounded-xl border bg-white shadow-sm p-4` |
| `button.tsx` | `<button>` with `variant` prop: `primary | secondary | danger` |
| `input.tsx` | `<input>` with border, rounded, focus ring using `--color-primary` |
| `label.tsx` | `<label>` with `text-sm` styling |
| `select.tsx` | `<select>` styled like `input.tsx` |
| `stat.tsx` | `{ label: string; value: string }` — key/value display block |

All primitives forward refs and spread remaining props.

### Acceptance Criteria — Phase 2
- `npm run dev` starts without errors
- `http://localhost:3000` redirects to `/dashboard`
- Nav visible on all five pages; active link is visually distinct
- `/holdings/BRK-B` shows the ticker in the heading
- The three custom color tokens appear in devtools on `<html>`
- `npm run lint` passes

---

## Phase 3 — Holdings CRUD UI

**Goal:** Holdings list, add, edit, and delete are fully functional end-to-end, persisting to Google Sheets.

### Tasks

**3.1 — Create `src/app/lib/actions.ts`** (`'use server'`)

```ts
export async function upsertHoldingAction(data: Holding): Promise<void>
  // upsertHolding(data); revalidatePath('/dashboard'); revalidatePath('/holdings')

export async function deleteHoldingAction(ticker: string): Promise<void>
  // deleteHolding(ticker); revalidatePath('/dashboard'); revalidatePath('/holdings')

export async function logTransactionAction(data: Omit<Transaction, 'id'>): Promise<void>
  // 1. appendTransaction(data)
  // 2. getHoldings() → find existing holding
  // 3. BUY: computeNewAvgCost + new shares → upsertHolding
  // 4. SELL: newShares = oldShares - data.shares
  //    newShares <= 0 → deleteHolding; else upsertHolding (avgCost unchanged on sell)
  // revalidatePath: /dashboard, /holdings, /transactions

export async function updateCashAction(amount: number): Promise<void>
  // updateCash(amount); revalidatePath('/dashboard'); revalidatePath('/cash')

export async function updatePlanAction(plan: MonthlyPlanRow[]): Promise<void>
  // replaceMonthlyPlan(plan); revalidatePath('/dashboard'); revalidatePath('/plan')
```

**3.2 — Create `src/components/holding-form.tsx`** (`'use client'`)

Props: `{ holding?: Holding; action: (data: Holding) => Promise<void> }`

Fields: `ticker` (read-only in edit), `name`, `shares`, `avgCostLocal`, `currency` (read-only in edit).

- Use `useTransition` for loading state on the submit button
- On success: `router.push('/holdings')`
- Show form-level error if action throws

**3.3 — Update `src/app/holdings/page.tsx`** (real implementation)
- `await getHoldings()`
- Table: ticker, name, shares, avg cost, currency, Edit link, Delete button
- Delete: `<form action={deleteHoldingAction.bind(null, ticker)}>` or a small `'use client'` DeleteButton
- "Add Holding" → `/holdings/new`

**3.4 — Update `src/app/holdings/new/page.tsx`**
Server Component wrapping `<HoldingForm action={upsertHoldingAction} />`.

**3.5 — Update `src/app/holdings/[ticker]/page.tsx`**
`await params`, `getHoldings()`, find by ticker, `notFound()` if missing, render `<HoldingForm holding={holding} action={upsertHoldingAction} />`.

### Acceptance Criteria — Phase 3
- `/holdings` shows empty table with "Add Holding" when sheet has no data
- Adding a holding via form → row in sheet → list shows it
- Edit form: all fields pre-populated; ticker/currency are read-only
- Editing shares/avg cost updates the sheet
- Delete removes the row; list reflects the change
- `/holdings/NOPE` renders the 404 page
- Required field validation prevents submission
- `npm run lint` passes

---

## Phase 4 — Transactions & Cash UI

**Goal:** Transaction logging works end-to-end including holding recalculation. Cash balance updatable.

### Tasks

**4.1 — Create `src/components/transaction-form.tsx`** (`'use client'`)

Props: `{ action: (data: Omit<Transaction, 'id'>) => Promise<void> }`

Fields: `date` (defaults to today), `ticker` (select from `EQUITY_TICKERS`), `type` (BUY/SELL), `shares`, `priceLocal`, `currency` (read-only, auto-fills from ticker via `TICKER_CURRENCY`).

On success: redirect to `/transactions`.

**4.2 — Update `src/app/transactions/page.tsx`**
`await getTransactions()`. Table: date, ticker, type badge, shares, price, currency. "Log Transaction" → `/transactions/new`.

Type badge: BUY = `bg-green-50 text-green-700`, SELL = `bg-red-50 text-red-700`.

**4.3 — Update `src/app/transactions/new/page.tsx`**
Server Component wrapping `<TransactionForm action={logTransactionAction} />`.

**4.4 — Create `src/components/cash-form.tsx`** (`'use client'`)

Props: `{ currentAmount: number; action: (amount: number) => Promise<void> }`

Shows current balance (read-only label), input for new amount. On success: redirects to `/cash`.

**4.5 — Update `src/app/cash/page.tsx`**
`await getCash()`. Show current balance formatted. Render `<CashForm />`.

### Acceptance Criteria — Phase 4
- `/transactions` empty when no transactions
- BUY 5 BRK-B @ 410 USD → row in Transactions + holding created/updated
- SELL full position → holding deleted from Holdings sheet
- BUY badge green, SELL badge red
- `/cash` shows current SGD balance
- Updating cash → sheet updates → refresh shows new amount
- Currency auto-fills on ticker selection
- Date defaults to today
- Avg cost recalc: buy 10 @ 420, then 5 @ 450 → new avg = 430 in Holdings sheet

---

## Phase 5 — Monthly Plan UI

**Goal:** Monthly investment plan can be viewed and edited with a full replace.

### Tasks

**5.1 — Create `src/components/plan-form.tsx`** (`'use client'`)

Props: `{ plan: MonthlyPlanRow[]; action: (plan: MonthlyPlanRow[]) => Promise<void> }`

- One row per ticker from `ALL_TICKERS` (canonical order); missing tickers default to `targetSGD: 0`
- `targetSGD` number input per row
- Reactive total row (sum updates as inputs change)
- On submit: assemble `MonthlyPlanRow[]` from state, call `action(plan)`

**5.2 — Update `src/app/plan/page.tsx`**
`await getMonthlyPlan()`. Render `<PlanForm plan={plan} action={updatePlanAction} />`.

### Acceptance Criteria — Phase 5
- All 5 tickers shown (BRK-B, JK8.SI, 2823.HK, 2838.HK, CASH) with 0 if not set
- Saving → full replace in MonthlyPlan sheet
- Total row sums reactively
- Empty plan round-trips correctly

---

## Phase 6 — Dashboard (Full Portfolio View)

**Goal:** The dashboard assembles all data into the full portfolio view.

### Tasks

**6.1 — Create `src/components/portfolio-summary.tsx`** (Server Component)

Props: `{ snapshot: PortfolioSnapshot }`
- Total value in large text (`S$X,XXX.XX` or `—`)
- Last prices fetched timestamp
- Stale banner if `pricesStale: true` (amber background)
- FX rate badges: USDSGD and HKDSGD as small pills

**6.2 — Create `src/components/holdings-table.tsx`** (Server Component)

Props: `{ holdings: PortfolioHolding[]; cash: PortfolioSnapshot['cash'] }`

Columns: Name, Shares, Avg Cost (local), Current Price (local), Value (SGD), Gain/Loss (SGD), Gain/Loss (%), Allocation (%). Null → `—`. Gain/Loss colored with `text-gain`/`text-loss`.

After holdings: Cash row (Value = `formatSGD(cash.SGD)`, other columns `—`). Bold grand total footer.

**6.3 — Create `src/components/allocation-chart.tsx`** (`'use client'`)

Props: `{ data: Array<{ ticker: string; allocationPct: number }> }`

Pure SVG donut (no chart library): `viewBox="0 0 100 100"`, one `<circle>` per segment using `stroke-dasharray`/`stroke-dashoffset`. Legend beside/below. Empty state if no data.

SVG circle technique: `r = 15.9155` → circumference ≈ 100. Each segment: `stroke-dasharray = pct 100`, `stroke-dashoffset = -(cumulative pct before this segment)`.

**6.4 — Create `src/components/plan-summary.tsx`** (Server Component)

Props: `{ plan: MonthlyPlanRow[]; holdings: PortfolioHolding[]; cash: PortfolioSnapshot['cash'] }`

Table: ticker, target (S$...), current allocation (%).

**6.5 — Update `src/app/dashboard/page.tsx`** (real implementation)

```tsx
export const dynamic = 'force-dynamic';

const [holdings, cash, plan, { fxRates, prices, stale, fetchedAt }] = await Promise.all([
  getHoldings(), getCash(), getMonthlyPlan(), fetchPricesAndFx(),
]);
const snapshot = computePortfolioSnapshot(holdings, prices, fxRates, cash, plan, stale, fetchedAt);
```

Render: `<PortfolioSummary>`, `<HoldingsTable>`, `<AllocationChart>`, `<PlanSummary>`.

### Acceptance Criteria — Phase 6
- `/dashboard` loads without errors with real data
- Total value in `S$X,XXX.XX` format
- Each holding row shows correct computed values (verify one manually)
- Null prices → `—` in value/gain/allocation cells
- Cash row with correct allocation %
- Donut chart renders SVG segments
- Stale banner appears when Yahoo Finance unreachable
- FX badges show realistic rates
- Dashboard is not cached — second load re-fetches live prices
- `npx tsc --noEmit` passes

---

## Phase 7 — Error States, Polish & Production Readiness

**Goal:** Graceful degradation under all failure scenarios from SPEC.md §18. Clean build.

### Tasks

**7.1 — Error boundaries**
- `src/app/error.tsx` — root boundary (`'use client'`, receives `error`/`reset` props)
- `src/app/dashboard/error.tsx` — "Unable to load portfolio data. Google Sheets may be unreachable."

**7.2 — Loading skeletons**
- `src/app/dashboard/loading.tsx` — placeholder cards
- `src/app/holdings/loading.tsx` — skeleton table rows

**7.3 — Verify full FX fallback chain**
Three tiers in `fetchPricesAndFx()`:
1. Live Yahoo Finance (success path)
2. `getFxRates()` from Sheets (if Yahoo fails)
3. `FALLBACK_FX_RATES` (if Sheets also fails/returns null)

Wrap `getFxRates()` in a try/catch; use `FALLBACK_FX_RATES` if it throws or returns null. Set `stale: true` in all non-live paths.

**7.4 — API route edge case audit**
- Missing required fields → 400 with descriptive message
- Unknown ticker → 404
- `PUT /api/cash` with negative amount → 400
- SELL > held shares → allow (log transaction, holding deleted if shares reach 0)

**7.5 — Final checklist**
Run `npx tsc --noEmit` and `npm run lint`. Fix all errors. Then verify:
- [ ] `export const dynamic = 'force-dynamic'` on every `route.ts` and `dashboard/page.tsx`
- [ ] `params: Promise<{ ... }>` + `await params` in all dynamic routes
- [ ] No `getServerSideProps`, `getStaticProps`, `NextApiRequest`, `NextApiResponse`
- [ ] No `use cache` directive
- [ ] No `NEXT_PUBLIC_` env vars
- [ ] All imports use `@/` alias
- [ ] `GOOGLE_PRIVATE_KEY` transform only inside `getSheetsClient()`
- [ ] No module-level Sheets singleton
- [ ] No Yahoo Finance calls in `'use client'` files
- [ ] `npm run build` completes without error

### Acceptance Criteria — Phase 7
- Yahoo Finance blocked → dashboard renders with stale banner, fallback FX rates used
- FxRates sheet empty → hardcoded fallback (1.34, 0.17) used
- Sheets unreachable → `/api/holdings` returns 500 `{ error: "..." }`, dashboard shows error boundary
- `npx tsc --noEmit` zero errors
- `npm run lint` zero errors
- `npm run build` succeeds

---

## File Creation Order

```
Phase 0:
  src/types/index.ts
  src/lib/constants.ts
  src/lib/fx.ts
  src/lib/google-sheets.ts
  src/lib/yahoo-finance.ts
  src/lib/portfolio.ts

Phase 1:
  src/app/api/holdings/route.ts
  src/app/api/holdings/[ticker]/route.ts
  src/app/api/cash/route.ts
  src/app/api/transactions/route.ts
  src/app/api/plan/route.ts
  src/app/api/prices/route.ts
  src/app/api/portfolio/route.ts

Phase 2:
  src/app/globals.css              (modify)
  src/components/nav.tsx
  src/app/layout.tsx               (modify)
  src/app/page.tsx                 (modify)
  src/components/ui/card.tsx
  src/components/ui/button.tsx
  src/components/ui/input.tsx
  src/components/ui/label.tsx
  src/components/ui/select.tsx
  src/components/ui/stat.tsx
  src/app/dashboard/page.tsx       (stub)
  src/app/holdings/page.tsx        (stub)
  src/app/holdings/new/page.tsx    (stub)
  src/app/holdings/[ticker]/page.tsx (stub)
  src/app/transactions/page.tsx    (stub)
  src/app/transactions/new/page.tsx (stub)
  src/app/cash/page.tsx            (stub)
  src/app/plan/page.tsx            (stub)

Phase 3:
  src/app/lib/actions.ts
  src/components/holding-form.tsx
  src/app/holdings/page.tsx        (real)
  src/app/holdings/new/page.tsx    (real)
  src/app/holdings/[ticker]/page.tsx (real)

Phase 4:
  src/components/transaction-form.tsx
  src/app/transactions/page.tsx    (real)
  src/app/transactions/new/page.tsx (real)
  src/components/cash-form.tsx
  src/app/cash/page.tsx            (real)

Phase 5:
  src/components/plan-form.tsx
  src/app/plan/page.tsx            (real)

Phase 6:
  src/components/portfolio-summary.tsx
  src/components/holdings-table.tsx
  src/components/allocation-chart.tsx
  src/components/plan-summary.tsx
  src/app/dashboard/page.tsx       (real)

Phase 7:
  src/app/error.tsx
  src/app/dashboard/error.tsx
  src/app/dashboard/loading.tsx
  src/app/holdings/loading.tsx
```

---

## Invariants — Check at Every File

1. Dynamic routes: `params: Promise<{ ticker: string }>` + `await params`
2. Every `route.ts` has `export const dynamic = 'force-dynamic'`
3. `dashboard/page.tsx` has `export const dynamic = 'force-dynamic'`
4. No `use cache` directive
5. No `getServerSideProps` / `getStaticProps`
6. No `NextApiRequest` / `NextApiResponse`
7. All types imported from `@/types` (not defined inline)
8. Sheets client instantiated inside the function — never module-level
9. Yahoo Finance called from server code only — never in `'use client'` files
10. `GOOGLE_PRIVATE_KEY` `.replace(/\\n/g, '\n')` only inside `getSheetsClient()`
11. SGD values formatted as `S$1,234.56` using `formatSGD()` from `@/lib/fx`
12. All imports use `@/` alias, never relative `../../`
