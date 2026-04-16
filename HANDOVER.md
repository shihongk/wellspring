# Wellspring — Handover Document

## What This Project Is

Personal SGD-denominated investment portfolio tracker. Web app backed by Google Sheets (no database). Market data from Yahoo Finance. Built with Next.js 16.2.3 App Router, TypeScript, Tailwind CSS v4.

**Full spec:** `SPEC.md`
**Implementation plan:** `PLAN.md`
**Next.js conventions:** `AGENTS.md` — read before writing any Next.js code. This is Next.js 16, not the version you know from training data.

---

## Current State — v0.1 (2026-04-14) — COMPLETE

All phases are fully implemented and committed to `main` / tagged `v0.1`.

### What exists and works

**Data layer**
- `src/types/index.ts` — all shared TypeScript interfaces including `CashAccount`, updated `CashPosition`
- `src/lib/constants.ts` — tickers, FX pairs, sheet names, fallback rates, `TICKER_NAME` map
- `src/lib/fx.ts` — `toSGD()`, `formatSGD()`, `formatShares()`, `formatDate()`, `formatDateTime()`
- `src/lib/google-sheets.ts` — full Sheets CRUD; cash now supports multiple accounts via `upsertCashAccount()` / `deleteCashAccount()`
- `src/lib/yahoo-finance.ts` — price + FX fetch with 3-tier fallback (live → cached sheet → hardcoded)
- `src/lib/portfolio.ts` — `computePortfolioSnapshot()` + `computeNewAvgCost()`

**Server Actions** (`src/app/lib/actions.ts`)
- `upsertHoldingAction`, `deleteHoldingAction`
- `logTransactionAction` — BUY recalculates avg cost; SELL reduces shares, deletes holding if zero
- `updateCashAction`, `upsertCashAccountAction`, `deleteCashAccountAction`, `renameCashAccountAction`
- `updatePlanAction`

**API Routes**
- `GET/POST /api/holdings`
- `GET/PUT/DELETE /api/holdings/[ticker]`
- `GET/PUT /api/cash`
- `GET/POST /api/transactions`
- `GET/PUT /api/plan`
- `GET /api/prices`
- `GET /api/portfolio`
- `POST /api/setup/test` — validates credentials + checks tabs
- `POST /api/setup/provision` — creates missing tabs with headers
- `POST /api/setup/save` — writes `.env.local`
- `POST /api/setup/migrate-cash` — converts old Cash tab format to multi-account format

**Pages**
- `/` → redirects to `/dashboard`
- `/dashboard` — full portfolio view with refresh button and ex-cash allocation toggle
- `/holdings` — list with edit/delete; `/holdings/new`; `/holdings/[ticker]`
- `/transactions` — list with BUY/SELL badges; `/transactions/new`
- `/cash` — multi-account cash management (add, edit name+amount, delete)
- `/plan` — monthly investment plan editor with reactive total
- `/setup` — credential entry, connection test, sheet provisioning, cash migration

**Components**
- `PortfolioSummary` — total value, stale banner, FX rate pills
- `HoldingsTable` — per-holding table, cash row, grand total; 0dp for value/gain columns
- `AllocationChart` — hand-rolled SVG donut using path arcs (not stroke-dasharray); logo-derived color palette
- `PlanSummary` — target vs current allocation
- `DashboardClient` — client wrapper owning the ex-cash toggle; re-computes allocations client-side
- `RefreshButton` — calls `router.refresh()` to re-fetch live prices
- `HoldingForm`, `TransactionForm`, `CashForm`, `PlanForm`
- `Nav` — dark slate-900 nav with logo, active link highlighting

**Error / Loading boundaries**
- `src/app/error.tsx` — root error boundary
- `src/app/dashboard/error.tsx` — dashboard-specific error boundary
- `src/app/dashboard/loading.tsx` — dashboard skeleton
- `src/app/holdings/loading.tsx` — holdings skeleton

---

## Google Sheets Tab Structure

Five tabs. Row 1 = header. Data starts at row 2.

| Tab | Columns |
|---|---|
| `Holdings` | A:ticker B:name C:shares D:avg_cost_local E:currency |
| `Cash` | A:account B:currency C:amount |
| `Transactions` | A:id B:date C:ticker D:type E:shares F:price_local G:currency |
| `MonthlyPlan` | A:ticker B:target_sgd |
| `FxRates` | A:pair B:rate C:fetched_at |

> The Cash tab changed from the original spec (`currency, amount`) to (`account, currency, amount`) to support multiple accounts. The `/api/setup/migrate-cash` route handles migration from the old format. `getCash()` auto-detects both formats for backwards compatibility.

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

## Critical Next.js 16 Rules

1. **`params` is a Promise** in dynamic routes — always `await` it:
   ```ts
   export default async function Page({ params }: { params: Promise<{ ticker: string }> }) {
     const { ticker } = await params;
   }
   ```
2. **`export const dynamic = 'force-dynamic'`** on every `route.ts` and `dashboard/page.tsx`
3. **Route Handlers use Web APIs** — `Request` / `Response.json(...)`, not `NextApiRequest`/`NextApiResponse`
4. **No `use cache` directive** — `cacheComponents` is not enabled
5. **No `getServerSideProps`/`getStaticProps`** — App Router only

---

## Critical Implementation Rules

- **No module-level Sheets singleton** — always instantiate inside `getSheetsClient()`
- **Private key transform** — `GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')` only inside `getSheetsClient()`
- **All types** imported from `@/types` — never defined inline
- **Yahoo Finance** — server-side only, never in `'use client'` components
- **FX conversion** — always `toSGD(amount, currency, fxRates)` from `@/lib/fx`
- **SGD formatting** — `formatSGD(value)` for 2dp, or `Intl.NumberFormat` with `maximumFractionDigits: 0` for 0dp
- **Imports** — always `@/` alias, never relative `../../`

---

## Design System

Color palette derived from the Wellspring logo gradient (indigo base → cyan mid → green leaf):

| Token | Value | Usage |
|---|---|---|
| `--color-primary` | `#0e7490` | Buttons, focus rings, active states |
| `--color-primary-dark` | `#4338ca` | Total value text |
| `--color-accent` | `#22c55e` | Accent / leaf green |
| `--color-gain` | `#16a34a` | Positive P&L |
| `--color-loss` | `#dc2626` | Negative P&L |
| Nav background | `#0f172a` | slate-900 |
| Page background | `#f0f9ff` | sky-50 |

Donut chart equity colors: `#4338ca` → `#0e7490` → `#22c55e` → `#0891b2` → `#7c3aed` → `#0d9488`
Cash always: `#94a3b8` (slate-400)

---

## What to Build Next (Post v0.1 Ideas)

- Unit tests for `src/lib/fx.ts` and `src/lib/portfolio.ts` (pure functions, easy to test)
- Vercel deployment + environment variable configuration
- Transaction history filterable by ticker
- Cost basis in SGD shown on holdings page
- Historical performance chart (requires storing snapshots)
- Support for additional tickers beyond the current 4
