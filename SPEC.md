# Wellspring — Requirements & Design Spec

Personal investment portfolio tracker. This document is the authoritative spec for implementation.

---

## 1. Project Overview

**Name:** Wellspring  
**Purpose:** Track a personal SGD-denominated investment portfolio.  
**Interface:** Web app only. No manual editing of Google Sheets.  
**Backend store:** Google Sheets (via Google Sheets API + service account).  
**Market data:** Yahoo Finance via `yahoo-finance2` npm package, called server-side only.

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.3 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Icons | lucide-react |
| Backend store | Google Sheets API (`googleapis` npm package) |
| Auth to Sheets | Google Service Account (JSON key, never OAuth) |
| Market data | `yahoo-finance2` (server-side only) |
| Runtime | Node.js (Next.js server) |

**Environment variables** (`.env.local`, never prefixed `NEXT_PUBLIC_`):
```
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
```

The `GOOGLE_PRIVATE_KEY` value in the `.env.local` file uses literal `\n` inside double quotes. In code, always transform it: `process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n')`.

---

## 3. Holdings in Scope

| Ticker | Exchange | Native Currency |
|---|---|---|
| BRK-B | NYSE | USD |
| JK8.SI | SGX | SGD |
| 2823.HK | HKEX | HKD |
| 2838.HK | HKEX | HKD |
| CASH | — | SGD |

FX pairs to fetch: `USDSGD=X`, `HKDSGD=X` (from Yahoo Finance).

---

## 4. Google Sheets Structure

One spreadsheet, five tabs. Row 1 in every tab is the header row. Data starts at row 2. The spreadsheet must be shared with the service account email as **Editor**.

### Tab: `Holdings`

| A: ticker | B: name | C: shares | D: avg_cost_local | E: currency |
|---|---|---|---|---|
| BRK-B | Berkshire Hathaway B | 10.5 | 420.00 | USD |

- `ticker` is the unique key. Upsert logic: find the row by ticker and overwrite it, or append if not found.
- `avg_cost_local`: average cost per share in the ticker's native currency.
- `currency`: one of `USD`, `SGD`, `HKD`.

### Tab: `Cash`

| A: currency | B: amount |
|---|---|
| SGD | 5000.00 |

- One row per currency. Currently only SGD.
- Update by finding the `SGD` row and overwriting column B.

### Tab: `Transactions`

| A: id | B: date | C: ticker | D: type | E: shares | F: price_local | G: currency |
|---|---|---|---|---|---|---|
| txn_1713000000000 | 2024-04-13 | BRK-B | BUY | 5 | 410.00 | USD |

- `id`: generated server-side as `txn_${Date.now()}`.
- `date`: ISO format `YYYY-MM-DD`.
- `type`: `BUY` or `SELL`.
- Append-only. Never edit or delete existing rows.

### Tab: `MonthlyPlan`

| A: ticker | B: target_sgd |
|---|---|
| BRK-B | 500 |
| CASH | 200 |

- One row per ticker (including CASH).
- Full replace on save: clear all data rows, then write all rows.

### Tab: `FxRates`

| A: pair | B: rate | C: fetched_at |
|---|---|---|
| USDSGD=X | 1.34 | 2024-04-13T10:00:00Z |
| HKDSGD=X | 0.172 | 2024-04-13T10:00:00Z |

- Written after every successful Yahoo Finance fetch.
- Read as fallback when Yahoo Finance is unreachable.

---

## 5. File & Folder Structure

```
src/
├── app/
│   ├── globals.css                   # Tailwind v4 imports + @theme tokens
│   ├── layout.tsx                    # Root layout: title, fonts, <Nav>
│   ├── page.tsx                      # Redirect to /dashboard
│   │
│   ├── dashboard/
│   │   └── page.tsx                  # Server Component — main portfolio view
│   │
│   ├── holdings/
│   │   ├── page.tsx                  # List all holdings (Server Component)
│   │   ├── new/
│   │   │   └── page.tsx              # Add holding form
│   │   └── [ticker]/
│   │       └── page.tsx              # Edit holding form
│   │
│   ├── transactions/
│   │   ├── page.tsx                  # Transaction history (Server Component)
│   │   └── new/
│   │       └── page.tsx              # Log transaction form
│   │
│   ├── cash/
│   │   └── page.tsx                  # Update SGD cash form
│   │
│   ├── plan/
│   │   └── page.tsx                  # Monthly investment plan editor
│   │
│   ├── lib/
│   │   └── actions.ts                # All Server Actions ('use server')
│   │
│   └── api/
│       ├── portfolio/route.ts        # GET — full portfolio snapshot
│       ├── holdings/route.ts         # GET all, POST upsert
│       ├── holdings/[ticker]/route.ts # GET one, PUT update, DELETE remove
│       ├── transactions/route.ts     # GET list, POST new
│       ├── cash/route.ts             # GET current, PUT update
│       ├── plan/route.ts             # GET plan, PUT replace plan
│       └── prices/route.ts           # GET live prices + FX rates
│
├── lib/
│   ├── constants.ts                  # Ticker list, currency map, sheet names
│   ├── google-sheets.ts              # Sheets client + all CRUD helpers
│   ├── yahoo-finance.ts              # Price + FX fetch, fallback logic
│   ├── fx.ts                         # toSGD() conversion utility
│   └── portfolio.ts                  # Pure computation: values, weights, gains
│
├── types/
│   └── index.ts                      # All shared TypeScript interfaces
│
└── components/
    ├── nav.tsx                       # Top nav ('use client' for active link)
    ├── portfolio-summary.tsx         # Total value card + FX rate badges
    ├── holdings-table.tsx            # Per-holding value table
    ├── allocation-chart.tsx          # Donut chart ('use client')
    ├── holding-form.tsx              # Add/edit holding ('use client')
    ├── transaction-form.tsx          # Log transaction ('use client')
    ├── cash-form.tsx                 # Update cash ('use client')
    ├── plan-form.tsx                 # Monthly plan editor ('use client')
    └── ui/
        ├── card.tsx
        ├── button.tsx
        ├── input.tsx
        ├── label.tsx
        ├── select.tsx
        └── stat.tsx                  # Key/value stat display block
```

---

## 6. TypeScript Types (`src/types/index.ts`)

```ts
export type Currency = 'USD' | 'SGD' | 'HKD';
export type TransactionType = 'BUY' | 'SELL';

export interface Holding {
  ticker: string;
  name: string;
  shares: number;
  avgCostLocal: number;
  currency: Currency;
}

export interface Transaction {
  id: string;
  date: string;           // YYYY-MM-DD
  ticker: string;
  type: TransactionType;
  shares: number;
  priceLocal: number;
  currency: Currency;
}

export interface CashPosition {
  SGD: number;
}

export interface MonthlyPlanRow {
  ticker: string;
  targetSGD: number;
}

export interface FxRates {
  USDSGD: number;
  HKDSGD: number;
}

export interface PortfolioHolding extends Holding {
  currentPriceLocal: number | null;
  currentPriceSGD: number | null;
  totalValueSGD: number | null;
  costBasisSGD: number;
  unrealizedGainSGD: number | null;
  unrealizedGainPct: number | null;
  allocationPct: number | null;
}

export interface PortfolioSnapshot {
  pricesStale: boolean;
  pricesFetchedAt: string | null;
  fxRates: FxRates;
  totalValueSGD: number | null;
  holdings: PortfolioHolding[];
  cash: {
    SGD: number;
    allocationPct: number | null;
  };
  plan: MonthlyPlanRow[];
}
```

---

## 7. API Routes

All routes return JSON. Error shape: `{ error: string }` with appropriate HTTP status. All routes use Web `Request`/`Response` (not `NextApiRequest`/`NextApiResponse`).

Add `export const dynamic = 'force-dynamic'` to every route handler and to the dashboard page.

### `GET /api/portfolio`

Primary aggregation endpoint. Calls Sheets for stored data, calls Yahoo Finance for prices + FX, merges and computes, returns full `PortfolioSnapshot`. If Yahoo Finance fails entirely, sets `pricesStale: true` and uses fallback FX from the `FxRates` sheet.

### `GET /api/holdings`
Returns `Holding[]` from the `Holdings` sheet.

### `POST /api/holdings`
Body: `Holding`. Upserts by ticker. Returns `{ success: true, ticker: string }`.

### `GET /api/holdings/[ticker]`
Returns single `Holding` or 404.

### `PUT /api/holdings/[ticker]`
Body: `Partial<Pick<Holding, 'name' | 'shares' | 'avgCostLocal'>>`. Returns `{ success: true }`.

### `DELETE /api/holdings/[ticker]`
Removes the row from the `Holdings` sheet. Returns `{ success: true }`.

### `GET /api/transactions`
Returns `Transaction[]` sorted descending by date. Optional query param `?ticker=BRK-B`.

### `POST /api/transactions`
Body: `Omit<Transaction, 'id'>`. Generates `id` server-side. Returns `{ success: true, id: string }`.

### `GET /api/cash`
Returns `{ SGD: number }`.

### `PUT /api/cash`
Body: `{ amount: number }`. Updates the SGD row. Returns `{ success: true }`.

### `GET /api/plan`
Returns `MonthlyPlanRow[]`.

### `PUT /api/plan`
Body: `{ plan: MonthlyPlanRow[] }`. Full replace: clear data rows then write all. Returns `{ success: true }`.

### `GET /api/prices`
Returns:
```ts
{
  stale: boolean;
  fetchedAt: string | null;
  fxRates: FxRates;
  prices: Record<string, { price: number | null; currency: string }>;
}
```

---

## 8. Google Sheets Library (`src/lib/google-sheets.ts`)

```ts
import { google } from 'googleapis';

function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}
```

**Do not create a module-level singleton** — instantiate per invocation to avoid stale credential issues.

Key Sheets API operations:
- **Read a range:** `sheets.spreadsheets.values.get({ spreadsheetId, range: 'Holdings!A:E' })`
- **Append a row:** `sheets.spreadsheets.values.append({ ..., range: 'Transactions!A:G', valueInputOption: 'RAW', requestBody: { values: [[...]] } })`
- **Update a specific row:** `sheets.spreadsheets.values.update({ ..., range: 'Holdings!A5:E5', ... })`
- **Delete a row by index:** `sheets.spreadsheets.batchUpdate` with a `deleteDimension` request (find row index first via GET, then delete by sheetId + index)
- **Clear + rewrite (MonthlyPlan):** `sheets.spreadsheets.values.clear` then `values.update`

All helpers should be typed: accept and return the domain types from `src/types/index.ts`.

---

## 9. Yahoo Finance Library (`src/lib/yahoo-finance.ts`)

```ts
import YahooFinance from 'yahoo-finance2';
const yf = new YahooFinance();
```

**Batch fetch strategy** — fetch all tickers and FX pairs in parallel:
```ts
const EQUITY_TICKERS = ['BRK-B', 'JK8.SI', '2823.HK', '2838.HK'];
const FX_SYMBOLS = ['USDSGD=X', 'HKDSGD=X'];

const results = await Promise.allSettled(
  [...EQUITY_TICKERS, ...FX_SYMBOLS].map(sym => yf.quote(sym))
);
```

Use `result.regularMarketPrice` for the price value.

**Fallback logic:**
1. If FX fetch fails → read last known rates from `FxRates` sheet.
2. If individual stock prices fail → set `currentPriceLocal: null` for that holding.
3. If all prices fail → set `pricesStale: true` on the snapshot.
4. After a successful fetch → write FX rates back to the `FxRates` sheet (fire-and-forget, absorb write errors silently).

---

## 10. FX Conversion (`src/lib/fx.ts`)

```ts
export function toSGD(amount: number, currency: Currency, fxRates: FxRates): number {
  if (currency === 'SGD') return amount;
  if (currency === 'USD') return amount * fxRates.USDSGD;
  if (currency === 'HKD') return amount * fxRates.HKDSGD;
  throw new Error(`Unsupported currency: ${currency}`);
}
```

Always pass `fxRates` explicitly — never access it from a global.

---

## 11. Portfolio Computation (`src/lib/portfolio.ts`)

Pure TypeScript, no I/O. Inputs: `Holding[]`, price map, `FxRates`, `CashPosition`. Returns `PortfolioSnapshot`.

**Formulas:**
- `costBasisSGD = toSGD(shares * avgCostLocal, currency, fxRates)`
- `totalValueSGD = toSGD(shares * currentPriceLocal, currency, fxRates)` — `null` if price is null
- `unrealizedGainSGD = totalValueSGD - costBasisSGD` — `null` if totalValueSGD is null
- `unrealizedGainPct = (unrealizedGainSGD / costBasisSGD) * 100`
- `grandTotalSGD = sum(holding.totalValueSGD) + cash.SGD` — only sum non-null values
- `allocationPct = (holding.totalValueSGD / grandTotalSGD) * 100`

When prices are stale: `totalValueSGD`, `unrealizedGainSGD`, `unrealizedGainPct`, and `allocationPct` are all `null`. Cost basis is always computable from stored data.

**Average cost recalculation on BUY (called from the log transaction action):**
```
newAvgCost = (oldShares * oldAvgCost + newShares * newPrice) / (oldShares + newShares)
```
On SELL: reduce `shares` by the sold amount. If shares reach 0, delete the holding row.

---

## 12. Server Actions (`src/app/lib/actions.ts`)

File starts with `'use server'`. Each action validates input, calls the appropriate Sheets helper, then calls `revalidatePath` on affected routes.

```ts
'use server'
import { revalidatePath } from 'next/cache';

export async function upsertHoldingAction(data: Holding): Promise<void>
export async function deleteHoldingAction(ticker: string): Promise<void>
export async function logTransactionAction(data: Omit<Transaction, 'id'>): Promise<void>
// logTransactionAction also recalculates and updates the holding's shares + avgCost
export async function updateCashAction(amount: number): Promise<void>
export async function updatePlanAction(plan: MonthlyPlanRow[]): Promise<void>
```

After each mutation, revalidate: `/dashboard`, and the relevant listing page (`/holdings`, `/transactions`, `/cash`, `/plan`).

---

## 13. Next.js 16 Patterns to Follow

- **Async Server Components** — pages and layouts can directly `await` data-fetching functions.
- **`params` is a Promise in dynamic routes:**
  ```ts
  export default async function Page({ params }: { params: Promise<{ ticker: string }> }) {
    const { ticker } = await params;
  ```
- **`export const dynamic = 'force-dynamic'`** on the dashboard page and all API routes — market data must be live, no static pre-rendering.
- **Client Components only at leaves** — nav, forms, and the allocation chart need `'use client'`. Pages themselves should stay as Server Components.
- **Route Handlers use Web APIs** — `Request` and `Response.json(...)`, not `NextApiRequest`/`NextApiResponse`.
- **No `use cache` directive** unless `cacheComponents: true` is set in `next.config.ts` (it is not currently set).

---

## 14. UI Pages

### `/dashboard`

Server Component. Directly calls portfolio computation functions (not via HTTP). Renders:

1. **Header**: "Wellspring", last prices fetched timestamp, stale warning if `pricesStale: true`
2. **Total Value stat**: e.g. `S$142,350.00` (large, prominent)
3. **FX rate badges**: USDSGD and HKDSGD displayed as small read-only badges
4. **Holdings table**: columns → Name, Shares, Avg Cost (local), Current Price (local), Value (SGD), Gain/Loss (SGD), Gain/Loss (%), Allocation (%). Null price cells show `—`.
5. **Cash row**: below the holdings table, showing SGD cash and its allocation %.
6. **Allocation donut chart**: Client Component, receives `{ ticker, allocationPct }[]` as props.
7. **Monthly plan summary**: target vs. current allocation per ticker.

### `/holdings`

Server Component. Table of raw holding data (no live prices). Each row: ticker, name, shares, avg cost, currency, Edit button (→ `/holdings/[ticker]`), Delete button. "Add Holding" button → `/holdings/new`.

### `/holdings/new` and `/holdings/[ticker]`

Server Component wrapping a `<HoldingForm>` Client Component. New holding: all fields editable. Edit: ticker and currency are read-only. On submit → `upsertHoldingAction`.

### `/transactions`

Server Component. Full list of transactions sorted newest-first: date, ticker, type badge (BUY=green / SELL=red), shares, price (local), currency. "Log Transaction" → `/transactions/new`.

### `/transactions/new`

Server Component wrapping `<TransactionForm>` Client Component. Fields: date (defaults to today), ticker (select), type (BUY/SELL), shares, price per share, currency (auto-filled from ticker selection). On submit → `logTransactionAction` (which also updates holding shares and avg cost).

### `/cash`

Server Component wrapping `<CashForm>` Client Component. Shows current SGD cash balance (read-only), input for new amount. On submit → `updateCashAction`.

### `/plan`

Server Component wrapping `<PlanForm>` Client Component. Table: one row per ticker (including CASH), with a `targetSGD` number input. Total row summing all targets. On submit → `updatePlanAction` (full replace).

---

## 15. Navigation

Root `layout.tsx` renders `<Nav>` Client Component (needs `usePathname()` for active link highlighting). Nav links: **Dashboard**, **Holdings**, **Transactions**, **Cash**, **Plan**.

---

## 16. Styling

Tailwind v4 is already configured. Extend the existing `@theme inline` block in `globals.css` with these tokens:

```css
@theme inline {
  /* existing tokens ... */
  --color-gain: #16a34a;      /* green-600 */
  --color-loss: #dc2626;      /* red-600 */
  --color-primary: #0f766e;   /* teal-700 */
}
```

Display format for SGD values: `S$1,234.56` (always 2 decimal places, thousands separator).

---

## 17. One-Time Google Cloud Setup (for implementer)

1. Create a Google Cloud project.
2. Enable the **Google Sheets API**.
3. Create a **Service Account**. Download the JSON key.
4. Copy `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL` in `.env.local`.
5. Copy `private_key` → `GOOGLE_PRIVATE_KEY` in `.env.local` (keep the `\n` sequences).
6. Copy the spreadsheet ID from the URL → `GOOGLE_SHEETS_SPREADSHEET_ID` in `.env.local`.
7. Share the spreadsheet with the service account email as **Editor**.
8. Create the five tabs with the exact names and headers from Section 4.

---

## 18. Graceful Fallback Behaviour

| Failure scenario | Expected behaviour |
|---|---|
| Yahoo Finance unreachable | Use cached FX from `FxRates` sheet; set `pricesStale: true`; show stale banner on dashboard |
| Individual ticker price fails | Show `—` for that holding's price/value/gain; other holdings unaffected |
| Google Sheets unreachable | Return 500 from API route; page shows an error state |
| FX rates sheet empty (first run) | Default to hardcoded fallback rates (e.g. USDSGD=1.34, HKDSGD=0.17) with stale flag |
