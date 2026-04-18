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

### Tab: `PortfolioHistory`

| A: date | B: total_value_sgd | C: fx_usdsgd | D: fx_hkdsgd | E: recorded_at |
|---|---|---|---|---|
| 2024-04-13 | 142350.00 | 1.34 | 0.172 | 2024-04-13T10:15:00Z |

- One row per calendar date. **Upsert by date**: find existing row for the date and overwrite, or append if not found.
- `recorded_at` is ISO 8601 UTC.
- FX rates stored alongside value so historical calculations can be reproduced.
- Never delete rows.

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
│   ├── history/
│   │   └── page.tsx                  # Server Component — portfolio value over time
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
    ├── value-history-chart.tsx       # Line chart for portfolio value over time ('use client')
    ├── snapshot-button.tsx           # Manual "Record Snapshot" button ('use client')
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

scripts/
└── snapshot.ts                       # Standalone Node.js script — records daily snapshot
                                      # Called directly by macOS launchd, no HTTP server needed
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

export interface PortfolioHistoryEntry {
  date: string;         // YYYY-MM-DD
  totalValueSGD: number;
  fxUSDSGD: number;
  fxHKDSGD: number;
  recordedAt: string;   // ISO 8601 UTC
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

### `POST /api/setup/migrate-history`

Creates the `PortfolioHistory` tab in the existing spreadsheet, exactly matching the pattern of `migrate-plan`. Accepts the same body as all other setup routes: `{ spreadsheetId, serviceAccountEmail, privateKey }`.

- If the tab already exists → return `{ alreadyExists: true }`
- Otherwise → create the tab, write the header row, return `{ success: true, created: ['PortfolioHistory'] }`
- Error shape: `{ error: string }` with status 400

Also: add `PortfolioHistory` to the `TABS` array in `/api/setup/provision/route.ts` so new full-setup runs include it automatically.

---

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

Root `layout.tsx` renders `<Nav>` Client Component (needs `usePathname()` for active link highlighting). Nav links: **Dashboard**, **History**, **Holdings**, **Transactions**, **Cash**, **Plan**.

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
8. Create the six tabs with the exact names and headers from Section 4 (including `PortfolioHistory`).

---

## 18. Graceful Fallback Behaviour

| Failure scenario | Expected behaviour |
|---|---|
| Yahoo Finance unreachable | Use cached FX from `FxRates` sheet; set `pricesStale: true`; show stale banner on dashboard |
| Individual ticker price fails | Show `—` for that holding's price/value/gain; other holdings unaffected |
| Google Sheets unreachable | Return 500 from API route; page shows an error state |
| FX rates sheet empty (first run) | Default to hardcoded fallback rates (e.g. USDSGD=1.34, HKDSGD=0.17) with stale flag |
| `PortfolioHistory` sheet empty | `/history` shows empty-state message: "No snapshots yet — run the snapshot script or visit your dashboard" |
| Snapshot script: Yahoo Finance unreachable | Script exits with non-zero code and logs error; no row written; launchd logs the failure |
| Snapshot script: Sheets write fails | Script exits with non-zero code and logs error; retry will occur on next scheduled run |
| Dashboard auto-snapshot: prices stale | Skip writing snapshot; do not record stale values |

---

## 19. Portfolio History Feature

### Overview

Records total portfolio value (SGD) once per trading day. Two triggers:
1. **Automated** — `scripts/snapshot.ts` run by macOS launchd on a schedule (primary)
2. **Manual fallback** — "Record Snapshot" button on `/history` page, and auto-record on dashboard load when prices are fresh

### Google Sheets helpers (additions to `src/lib/google-sheets.ts`)

```ts
// Check if a snapshot for a given date already exists. Returns row index (1-based) or null.
async function findHistoryRowByDate(sheets, date: string): Promise<number | null>

// Upsert: overwrite row if date exists, append otherwise.
async function upsertHistoryEntry(entry: PortfolioHistoryEntry): Promise<void>

// Read all history, sorted ascending by date.
async function getPortfolioHistory(): Promise<PortfolioHistoryEntry[]>
```

### Server Action (addition to `src/app/lib/actions.ts`)

```ts
// Records a snapshot for today. Called from dashboard auto-record and manual button.
// No-ops if prices are stale. Upserts (overwrites today's row if it already exists).
export async function recordSnapshotAction(): Promise<{ recorded: boolean; reason?: string }>
```

After a successful write, revalidates `/history`.

### Dashboard auto-record (`src/app/dashboard/page.tsx`)

After computing the portfolio snapshot:
- If `pricesStale === false` — call `recordSnapshotAction()` as a fire-and-forget (do not `await`; do not block render).
- The dashboard renders identically regardless of whether the write succeeds.

### `scripts/snapshot.ts` — standalone script

Runs independently of the Next.js server. Loads `.env.local` via `dotenv`. Imports directly from `src/lib/`.

```
Flow:
1. Load env vars from .env.local (dotenv)
2. Fetch holdings from Google Sheets
3. Fetch live prices + FX from Yahoo Finance
4. If Yahoo Finance fails entirely → exit with error (do not record stale data)
5. Compute totalValueSGD using portfolio.ts logic
6. Upsert row into PortfolioHistory sheet
7. Log success: "Snapshot recorded: YYYY-MM-DD S$142,350.00"
```

Run manually: `npx tsx scripts/snapshot.ts`

Requires `tsx` and `dotenv` as dev dependencies.

### `/history` page (`src/app/history/page.tsx`)

Server Component. Reads all rows from `PortfolioHistory` sheet and renders:

1. **Page header**: "Portfolio History"
2. **Key stats row** (Server Component, 3 stat cards using `<Stat>`):
   - Latest value: `totalValueSGD` from most recent entry
   - Change this month: difference from first entry in current month to latest, formatted as `S$X,XXX (+X.X%)`
   - All-time change: difference from very first entry to latest
3. **`<ValueHistoryChart>`** Client Component — receives full dataset as props
4. **`<SnapshotButton>`** Client Component — manual record trigger

**Empty state**: if no history rows, show a message with instructions to run the script or visit the dashboard.

### `src/components/value-history-chart.tsx` — pure SVG line chart

`'use client'`. No third-party charting library. Consistent with existing `<AllocationChart>`.

**Props:**
```ts
interface Props {
  data: { date: string; totalValueSGD: number }[];
}
```

**Internal state:**
```ts
const [range, setRange] = useState<'1M' | '3M' | '6M' | '1Y' | 'ALL'>('3M');
const [tooltip, setTooltip] = useState<{ x: number; y: number; date: string; value: number } | null>(null);
```

**Rendering:**
- Range selector buttons (`1M | 3M | 6M | 1Y | All`) filter `data` before rendering
- SVG viewBox: `0 0 600 280`. Padding: top 20, right 20, bottom 40, left 70.
- Plot area: 510 × 220px
- Y-axis: 5 evenly spaced grid lines + labels (`S$XXX,XXX`)
- X-axis: up to 6 evenly spaced date labels (`MMM 'YY`)
- Area fill: semi-transparent teal (`--color-primary` at 10% opacity) under the line
- Polyline: 2px stroke, `--color-primary` colour
- Data point circles: 4px radius, visible on hover only (controlled by `tooltip` state)
- Hover target: transparent `<rect>` covering full plot area, `onMouseMove` computes nearest data point by x-position and sets `tooltip` state; `onMouseLeave` clears it
- Tooltip: absolutely positioned `<div>` (outside SVG, using `foreignObject` or a sibling div positioned via pixel offset) showing date (`DD MMM YYYY`) and value (`S$XXX,XXX.XX`)
- If fewer than 2 data points: render empty state text inside the SVG

**Responsive**: wrap SVG in a `<div className="w-full overflow-x-auto">`. SVG has fixed viewBox but `width="100%"`.

### `src/components/snapshot-button.tsx`

`'use client'`. Calls `recordSnapshotAction()` on click.

```ts
interface Props {}  // no props needed
```

States:
- **Idle**: button labelled "Record Snapshot" with a camera/save icon
- **Loading**: button disabled, spinner icon, "Recording…"
- **Success**: green checkmark, "Recorded" — resets to idle after 3 seconds
- **Skipped**: grey, "Already recorded today" — resets after 3 seconds
- **Error**: red, "Failed — try again" — resets after 5 seconds

### Sheet migration for existing users (`src/app/setup/page.tsx`)

A `MigrateHistorySection` component is added at the bottom of the setup page, following the identical pattern as `MigrateCashSection` and `MigratePlanSection`:

- Description: "If your sheet was set up before portfolio history was added, click below to create the PortfolioHistory tab."
- Button: "Add PortfolioHistory tab"
- Calls `POST /api/setup/migrate-history` with the stored credentials fields
- States: idle / running ("Adding tab…") / done ("✓ PortfolioHistory tab created") / already-exists ("✓ PortfolioHistory tab already exists — nothing to do") / error

Also update `TABS` in `/api/setup/provision/route.ts` to include:
```ts
{ title: 'PortfolioHistory', headers: ['date', 'total_value_sgd', 'fx_usdsgd', 'fx_hkdsgd', 'recorded_at'] }
```
so fresh full-setup runs create the tab automatically.

---

## 20. macOS launchd Setup (one-time, for local deployment)

Install `tsx` and `dotenv`:
```bash
npm install --save-dev tsx dotenv
```

Create the plist at `~/Library/LaunchAgents/com.wellspring.snapshot.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.wellspring.snapshot</string>

  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/usr/local/bin/npx</string>
    <string>tsx</string>
    <string>/Users/YOUR_USERNAME/Documents/Kiro/wellspring/scripts/snapshot.ts</string>
  </array>

  <key>StartCalendarInterval</key>
  <array>
    <!-- Weekdays at 18:00 local time (after SGX + NYSE pre-market open) -->
    <dict>
      <key>Hour</key><integer>18</integer>
      <key>Minute</key><integer>0</integer>
      <key>Weekday</key><integer>1</integer>
    </dict>
    <dict>
      <key>Hour</key><integer>18</integer>
      <key>Minute</key><integer>0</integer>
      <key>Weekday</key><integer>2</integer>
    </dict>
    <dict>
      <key>Hour</key><integer>18</integer>
      <key>Minute</key><integer>0</integer>
      <key>Weekday</key><integer>3</integer>
    </dict>
    <dict>
      <key>Hour</key><integer>18</integer>
      <key>Minute</key><integer>0</integer>
      <key>Weekday</key><integer>4</integer>
    </dict>
    <dict>
      <key>Hour</key><integer>18</integer>
      <key>Minute</key><integer>0</integer>
      <key>Weekday</key><integer>5</integer>
    </dict>
  </array>

  <key>StandardOutPath</key>
  <string>/tmp/wellspring-snapshot.log</string>

  <key>StandardErrorPath</key>
  <string>/tmp/wellspring-snapshot.error.log</string>

  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>
```

**Key behaviour**: if the Mac is asleep at 18:00, launchd runs the job the next time the Mac wakes. At most one missed run is retried per interval.

Load the agent:
```bash
launchctl load ~/Library/LaunchAgents/com.wellspring.snapshot.plist
```

Unload (to edit or disable):
```bash
launchctl unload ~/Library/LaunchAgents/com.wellspring.snapshot.plist
```

Check logs:
```bash
tail -f /tmp/wellspring-snapshot.log
tail -f /tmp/wellspring-snapshot.error.log
```

**Why 18:00 local (SGT)?**: SGX closes at 17:00 SGT. NYSE opens at 21:30 SGT. 18:00 captures end-of-SGX prices before US markets open — a clean daily snapshot of what your SGX and HKD positions closed at.
