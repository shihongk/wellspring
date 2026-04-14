# Wellspring — Kiro Handover Document

## What This Project Is

Personal SGD-denominated investment portfolio tracker. Web app backed by Google Sheets (no database). Market data from Yahoo Finance. Built with Next.js 16.2.3 App Router, TypeScript, Tailwind CSS v4.

**Full spec:** `SPEC.md` — authoritative source of truth for all requirements.
**Implementation plan:** `PLAN.md` — phased breakdown with acceptance criteria.
**Next.js conventions:** `AGENTS.md` — read this before writing any Next.js code. This is Next.js 16, not the version you know from training data.

---

## Current State (as of 2026-04-14)

### What exists and works

**Data layer — complete:**
- `src/types/index.ts` — all shared TypeScript interfaces
- `src/lib/constants.ts` — tickers, FX pairs, sheet names, fallback rates
- `src/lib/fx.ts` — `toSGD()` currency converter + `formatSGD()` formatter
- `src/lib/google-sheets.ts` — full Sheets CRUD (holdings, cash, transactions, plan, FX rates)
- `src/lib/yahoo-finance.ts` — price + FX fetch with 3-tier fallback
- `src/lib/portfolio.ts` — pure `computePortfolioSnapshot()` + `computeNewAvgCost()`

**Server Actions — complete:**
- `src/app/lib/actions.ts` — `upsertHoldingAction`, `deleteHoldingAction`, `logTransactionAction` (handles avg cost recalc + holding deletion on full sell), `updateCashAction`, `updatePlanAction`

**API Routes — only portfolio:**
- `src/app/api/portfolio/route.ts` — GET, returns full `PortfolioSnapshot`

**UI Shell — complete:**
- `src/app/layout.tsx`, `src/app/page.tsx` (redirects to /dashboard)
- `src/components/nav.tsx`
- `src/components/ui/` — card, button, input, label, select, stat

**Transactions UI — complete:**
- `src/app/transactions/page.tsx` — list with BUY/SELL colour badges
- `src/app/transactions/new/page.tsx`
- `src/components/transaction-form.tsx`

**Cash UI — complete:**
- `src/app/cash/page.tsx`
- `src/components/cash-form.tsx`

**Partial Phase 7 files (at wrong paths — see note below):**
- `src/app/error.tsx` — content is a dashboard error boundary (should be at `src/app/dashboard/error.tsx`)
- `src/app/loading.tsx` — content is a holdings loading skeleton (should be at `src/app/holdings/loading.tsx`)

---

### What is missing (needs to be built)

#### API Routes (Phase 1)
All six of these are missing. They are thin wrappers over the already-complete `src/lib/google-sheets.ts` functions.

| File | Methods |
|---|---|
| `src/app/api/holdings/route.ts` | GET (list), POST (upsert) |
| `src/app/api/holdings/[ticker]/route.ts` | GET (single), PUT (update), DELETE |
| `src/app/api/cash/route.ts` | GET, PUT |
| `src/app/api/transactions/route.ts` | GET (with optional `?ticker=` param), POST |
| `src/app/api/plan/route.ts` | GET, PUT |
| `src/app/api/prices/route.ts` | GET |

See PLAN.md Phase 1 and SPEC.md §7 for exact request/response shapes.

#### Holdings UI (Phase 3)
The entire holdings folder is missing.

| File | Description |
|---|---|
| `src/app/holdings/page.tsx` | List all holdings; Edit link per row; Delete button (Server Action); "Add Holding" button |
| `src/app/holdings/new/page.tsx` | Server Component wrapping `<HoldingForm action={upsertHoldingAction} />` |
| `src/app/holdings/[ticker]/page.tsx` | Server Component — `await params`, load holding, `notFound()` if missing, render `<HoldingForm holding={holding} .../>` |

`src/components/holding-form.tsx` **already exists** — don't recreate it.

#### Monthly Plan UI (Phase 5)

| File | Description |
|---|---|
| `src/components/plan-form.tsx` | `'use client'` — table of all 5 tickers with `targetSGD` inputs, reactive total row, calls `updatePlanAction` |
| `src/app/plan/page.tsx` | Server Component — `await getMonthlyPlan()`, render `<PlanForm>` |

All 5 tickers must always appear (BRK-B, JK8.SI, 2823.HK, 2838.HK, CASH). Missing tickers default to `targetSGD: 0`.

#### Dashboard (Phase 6)
The most complex phase. The page directly calls server functions (no HTTP fetch to `/api/portfolio`).

| File | Description |
|---|---|
| `src/components/portfolio-summary.tsx` | Server Component — total value, last fetched, stale banner, FX badges |
| `src/components/holdings-table.tsx` | Server Component — per-holding table + cash row + grand total footer |
| `src/components/allocation-chart.tsx` | `'use client'` — pure SVG donut chart, no external library |
| `src/components/plan-summary.tsx` | Server Component — plan targets vs current allocation |
| `src/app/dashboard/page.tsx` | Server Component — `Promise.all` all data sources, `computePortfolioSnapshot`, render all four components above |

#### Error / Loading boundaries (Phase 7, fix paths)
Move or recreate at the correct paths:

| Correct path | Notes |
|---|---|
| `src/app/dashboard/error.tsx` | Content already written at `src/app/error.tsx` — move/copy it |
| `src/app/dashboard/loading.tsx` | Needs to be created (dashboard-specific skeleton) |
| `src/app/holdings/loading.tsx` | Content already written at `src/app/loading.tsx` — move/copy it |

---

## Critical Next.js 16 Rules

These differ from what the model likely knows from training data. **Violating these causes runtime errors.**

1. **`params` is a Promise** in dynamic routes — always `await` it:
   ```ts
   export default async function Page({ params }: { params: Promise<{ ticker: string }> }) {
     const { ticker } = await params;
   }
   ```

2. **`export const dynamic = 'force-dynamic'`** must appear at the top of every `route.ts` file and on `src/app/dashboard/page.tsx`. Market data must not be statically pre-rendered.

3. **Route Handlers use Web APIs** — `Request` and `Response.json(...)`, not `NextApiRequest`/`NextApiResponse`.

4. **No `use cache` directive** — `cacheComponents` is not enabled.

5. **No `getServerSideProps`/`getStaticProps`** — App Router only.

---

## Critical Implementation Rules

### Google Sheets client
Never create a module-level singleton. Always instantiate inside the function:
```ts
function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({ ... });
  return google.sheets({ version: 'v4', auth });
}
```

### Private key transform
The `.env.local` stores the PEM key with literal `\n`. Transform it exactly once, inside `getSheetsClient()`:
```ts
private_key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n')
```
Never call `.replace` anywhere else.

### Environment variables
All server-only (no `NEXT_PUBLIC_` prefix):
- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`

### Types
All types must be imported from `@/types`. Never define them inline in route or component files.

### Yahoo Finance (server only)
Never call Yahoo Finance from a `'use client'` component. Always server-side only.

### FX conversion
Always call `toSGD(amount, currency, fxRates)` from `@/lib/fx`. Never access FX rates from a global.

### SGD formatting
Always use `formatSGD(value)` from `@/lib/fx`. Output format: `S$1,234.56`.

### Imports
Always use `@/` alias paths. Never use relative `../../` imports.

---

## Google Sheets Tab Structure

Five tabs. Row 1 = header in every tab. Data starts at row 2.

| Tab | Columns |
|---|---|
| `Holdings` | A:ticker B:name C:shares D:avg_cost_local E:currency |
| `Cash` | A:currency B:amount |
| `Transactions` | A:id B:date C:ticker D:type E:shares F:price_local G:currency |
| `MonthlyPlan` | A:ticker B:target_sgd |
| `FxRates` | A:pair B:rate C:fetched_at |

---

## Holdings in Scope

| Ticker | Exchange | Currency |
|---|---|---|
| BRK-B | NYSE | USD |
| JK8.SI | SGX | SGD |
| 2823.HK | HKEX | HKD |
| 2838.HK | HKEX | HKD |
| CASH | — | SGD |

FX pairs: `USDSGD=X`, `HKDSGD=X`

---

## API Error Shape

All API routes return `{ error: string }` with an appropriate HTTP status on failure. Never return HTML error pages from route handlers.

---

## Allocation Donut Chart

No chart library — hand-rolled SVG. Technique:
- `viewBox="0 0 100 100"`, one `<circle>` per segment
- `r = 15.9155` → circumference ≈ 100 for easy math
- `stroke-dasharray = pct 100`
- `stroke-dashoffset = -(cumulative pct of all prior segments)`

---

## Graceful Fallback Behaviour

| Failure | Expected behaviour |
|---|---|
| Yahoo Finance unreachable | Use cached FX from `FxRates` sheet; set `pricesStale: true`; show stale banner on dashboard |
| Individual ticker price fails | `currentPriceLocal: null`; show `—` in UI; other holdings unaffected |
| FX rates sheet empty (first run) | Hardcoded fallback: USDSGD=1.34, HKDSGD=0.17; set stale |
| Google Sheets unreachable | 500 from API route; dashboard shows error boundary |

---

## What to Build First

Suggested order based on dependencies:

1. **API routes** (Phase 1 gaps) — fast to write, each one is ~20 lines
2. **Holdings pages** (Phase 3 gaps) — `holding-form.tsx` already exists, just need the page wrappers
3. **Plan UI** (Phase 5) — `plan-form.tsx` + `plan/page.tsx`
4. **Dashboard components + page** (Phase 6) — most complex, depends on everything
5. **Fix error/loading boundary paths** (Phase 7 cleanup)

See PLAN.md for detailed acceptance criteria per phase.
