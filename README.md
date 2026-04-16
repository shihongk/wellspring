# Wellspring

Personal SGD-denominated investment portfolio tracker. Backed by Google Sheets — no database required. Live market prices from Yahoo Finance.

![Wellspring](public/logo-square.png)

---

## Features

- **Dashboard** — total portfolio value, per-holding P&L, allocation donut chart, target % and gap columns, ex-cash allocation toggle
- **Holdings** — add, edit, delete positions
- **Transactions** — log BUY/SELL trades; automatically recalculates weighted average cost
- **Cash** — track balances across multiple accounts/banks
- **Plan** — set target allocation % per equity; view current portfolio vs targets with cash-constrained buy recommendations; manage a forward-looking monthly investment schedule with bidirectional units ↔ SGD calculation
- **Setup** — browser-based credential entry, connection test, automatic sheet provisioning and migration

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.3 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Data store | Google Sheets API |
| Market data | `yahoo-finance2` (server-side only) |
| Auth | Google Service Account |

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/shihongk/wellspring.git
cd wellspring
npm install
```

### 2. Google Cloud setup

1. Go to [Google Cloud Console](https://console.cloud.google.com) and create a project
2. Enable the **Google Sheets API**
3. Go to **IAM & Admin → Service Accounts → Create service account**
4. On the service account, go to **Keys → Add Key → JSON** and download the file
5. Create a blank Google Spreadsheet and share it with the service account email as **Editor**

### 3. Configure credentials

Either create `.env.local` manually:

```
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id_from_url
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
```

Or use the in-app setup page (recommended):

```bash
npm run dev
```

Open [http://localhost:3000/setup](http://localhost:3000/setup), paste your credentials, click **Test Connection** then **Set up sheet structure**. The app creates all required tabs automatically.

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — redirects to the dashboard.

> **After saving credentials via /setup, restart the dev server** — Next.js only reads `.env.local` at startup.

---

## Google Sheets Structure

Six tabs are required. The `/setup` page creates them automatically.

| Tab | Columns |
|---|---|
| `Holdings` | ticker, name, shares, avg_cost_local, currency |
| `Cash` | account, currency, amount |
| `Transactions` | id, date, ticker, type, shares, price_local, currency |
| `TargetAllocation` | ticker, target_pct |
| `InvestmentSchedule` | month, ticker, name, planned_sgd |
| `FxRates` | pair, rate, fetched_at |

### Migrations from v0.1

If you set up the sheet before v0.2, run the migration buttons on `/setup`:

- **Migrate Cash tab** — converts old `(currency, amount)` format to `(account, currency, amount)`
- **Add plan tabs** — creates the new `TargetAllocation` and `InvestmentSchedule` tabs (replaces `MonthlyPlan`)

---

## Holdings in Scope

| Ticker | Exchange | Currency |
|---|---|---|
| BRK-B | NYSE | USD |
| JK8.SI | SGX | SGD |
| 2823.HK | HKEX | HKD |
| 2838.HK | HKEX | HKD |
| TSM | NYSE | USD |
| CASH | — | SGD |

FX pairs fetched: `USDSGD=X`, `HKDSGD=X`

---

## How Transactions Work

Transactions are the source of truth for holdings. When you log a trade:

- **BUY** — creates or updates the holding with a weighted average cost recalculation
- **SELL** — reduces shares; deletes the holding row if shares reach zero

---

## Plan Tab

The Plan tab has three sections:

1. **Current Portfolio** — reference table showing value, price, alloc %, target %, gap, and cash-constrained buy recommendations (how many units/SGD to buy to close the gap using available cash)
2. **Target Allocation editor** — set target % per equity; running total shown
3. **Investment Schedule** — editable monthly purchase plan; units and planned SGD are bidirectional (edit either, the other updates live)

### Buy Recommendation Logic

Uses iterative convergence to ensure total spend ≤ available cash:
- `newTotal = equityValue + cashSGD`
- For each underweight holding: `toBuy = targetPct% × newTotal − currentValue`
- If total toBuy ≤ cash → use as-is (gaps fully closed)
- If total toBuy > cash → scale proportionally to fit cash exactly

---

## Fallback Behaviour

| Failure | Behaviour |
|---|---|
| Yahoo Finance unreachable | Uses cached FX rates from the `FxRates` sheet; shows stale banner |
| Individual price fails | Shows `—` for that holding; others unaffected |
| FxRates sheet empty | Falls back to hardcoded rates (USDSGD 1.34, HKDSGD 0.17) |
| Google Sheets unreachable | API returns 500; dashboard shows error boundary |
| Plan data source fails | Each section (allocation editor / schedule) fails independently; the other still renders |

---

## Development

```bash
npm run dev      # development server
npm run build    # production build
npm run lint     # ESLint
npx tsc --noEmit # type check
```

---

## Project Structure

```
src/
├── app/
│   ├── dashboard/        # Main portfolio view
│   ├── holdings/         # Holdings CRUD
│   ├── transactions/     # Transaction log
│   ├── cash/             # Cash balances
│   ├── plan/             # Target allocation + investment schedule
│   ├── setup/            # Credential setup + sheet provisioning + migrations
│   ├── api/              # REST API routes (thin wrappers over lib/)
│   └── lib/actions.ts    # Server Actions
├── components/
│   ├── ui/               # Primitives: Button, Card, Input, Label, Select
│   ├── allocation-editor.tsx   # Target % editor (client)
│   ├── schedule-viewer.tsx     # Investment schedule editor (client)
│   ├── plan-snapshot.tsx       # Current portfolio reference + buy recs (client)
│   ├── holdings-table.tsx      # Holdings table with colour-coded column groups
│   ├── dashboard-client.tsx    # Dashboard client wrapper (ex-cash toggle)
│   └── ...
├── lib/
│   ├── google-sheets.ts  # All Sheets CRUD
│   ├── yahoo-finance.ts  # Price + FX fetch
│   ├── portfolio.ts      # Pure computation (snapshot, gap, units, groupByMonth)
│   ├── fx.ts             # Currency conversion + formatting
│   └── constants.ts      # Tickers, sheet names, fallback rates
└── types/index.ts        # All shared TypeScript interfaces
```

---

## Environment Variables

All server-only — never use `NEXT_PUBLIC_` prefix.

| Variable | Description |
|---|---|
| `GOOGLE_SHEETS_SPREADSHEET_ID` | The ID from the spreadsheet URL |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account `client_email` |
| `GOOGLE_PRIVATE_KEY` | Service account `private_key` (with literal `\n`) |
