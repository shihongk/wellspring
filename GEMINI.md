# Wellspring — Project Instructions for Gemini

Personal SGD-denominated investment portfolio and expense tracker. Web app backed by Google Sheets (no database). Built with Next.js 16.2.3 App Router, TypeScript, Tailwind CSS v4.

---

## Key documents

| File | Purpose |
|---|---|
| `HANDOVER.md` | Current implementation state — what exists and how it works |
| `PLAN.md` | Versioned implementation plans with per-phase checklists |
| `tasks/` | Self-contained task documents for individual phases |
| `src/types/index.ts` | All shared TypeScript interfaces |
| `src/lib/constants.ts` | All shared constants (tickers, sheet names, categories) |

**Before implementing anything:** read `HANDOVER.md` to understand what already exists. Read the relevant task document in `tasks/` for exact specifications.

---

## Tech stack

- Next.js 16.2.3 App Router (no Pages Router)
- TypeScript strict mode
- Tailwind CSS v4
- Google Sheets API via `googleapis` npm package
- No database — all persistence is Google Sheets

---

## Critical Next.js 16 rules

These differ from older Next.js — do not rely on training data patterns:

- **`params` is a Promise** in dynamic routes — always `await` it:
  ```ts
  export default async function Page({ params }: { params: Promise<{ ticker: string }> }) {
    const { ticker } = await params;
  }
  ```
- **`export const dynamic = 'force-dynamic'`** on every `route.ts` file and every data-fetching page. Never omit this.
- **Route Handlers use Web APIs only** — `Request`, `Response.json(...)`. Never `NextApiRequest`/`NextApiResponse`.
- **No `use cache` directive** — not enabled in this project.
- **No `getServerSideProps` or `getStaticProps`** — App Router only.
- **Client Components only at leaves** — pages are Server Components; interactive widgets use `'use client'`.

---

## Project conventions

### TypeScript types

All shared types live in `src/types/index.ts`. Never define types inline in route files, lib files, or components — always import from `@/types`. The `@/` alias maps to `src/`.

### Imports

Always use `@/` alias, never relative paths like `../../lib/foo`.

### Google Sheets client

**Never create a module-level singleton.** Every file that talks to Sheets defines its own local `getSheetsClient()` function. Copy this pattern exactly:

```ts
import { google } from 'googleapis';

function getSheetsClient() {
  const {
    GOOGLE_SHEETS_SPREADSHEET_ID,
    GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_PRIVATE_KEY,
  } = process.env;

  if (!GOOGLE_SHEETS_SPREADSHEET_ID || !GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    throw new Error('Missing Google Sheets credentials in environment variables.');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return {
    sheets: google.sheets({ version: 'v4', auth }),
    spreadsheetId: GOOGLE_SHEETS_SPREADSHEET_ID,
  };
}
```

The private key **must** be transformed with `.replace(/\\n/g, '\n')` — the `.env.local` file stores literal `\n` escape sequences.

### Environment variables

Server-only. Never use `NEXT_PUBLIC_` prefix:
- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`

### Server Actions

All Server Actions live in `src/app/lib/actions.ts`, which begins with `'use server'`. After every mutation, call `revalidatePath` on the affected pages.

### API routes error shape

```ts
return Response.json({ error: 'message here' }, { status: 400 });
```

Always `{ error: string }` on failure. Never throw raw errors to the client.

### FX conversion

Always call `toSGD(amount, currency, fxRates)` from `src/lib/fx.ts`. Never access FX rates from module-level state.

### SGD display format

`S$1,234.56` — 2 decimal places, thousands separator. Use `formatSGD()` from `src/lib/fx.ts`.

### Scripts (`scripts/`)

- Load `.env.local` via `config({ path: resolve(__dirname, '../.env.local') })` from `dotenv`
- Use UTC-safe dates: `Date.UTC(y, m-1, d)`. Never `new Date('YYYY-MM-DD')` — timezone shift.
- Run via `npx tsx scripts/<name>.ts`

---

## Google Sheets tab structure

| Tab | Columns |
|---|---|
| `Holdings` | ticker, name, shares, avg_cost_local, currency |
| `Cash` | account, currency, amount |
| `Transactions` | id, date, ticker, type, shares, price_local, currency |
| `TargetAllocation` | ticker, target_pct |
| `InvestmentSchedule` | month, ticker, name, planned_sgd |
| `FxRates` | pair, rate, fetched_at |
| `PortfolioHistory` | date, total_value_sgd, fx_usdsgd, fx_hkdsgd, recorded_at |
| `Expenses` | id, date, post_date, description, amount, direction, balance, account, category, source_file, imported_at, excluded, one_off |
| `ExpenseRules` | merchant, category |
| `ExpenseProjections` | month, category, amount |
| `CpfBalances` | date, oa, sa, ma |
| `RetirementOneOffs` | id, year, description, amount_sgd |

Row 1 = header in all tabs. Data starts at row 2.

---

## Styling tokens (Tailwind v4 CSS custom properties)

```
--color-gain:         #16a34a   (positive P&L, income)
--color-loss:         #dc2626   (negative P&L, expenses)
--color-primary:      #0e7490   (buttons, focus rings)
--color-primary-dark: #4338ca   (total value text)
--color-accent:       #22c55e
--color-nav-bg:       #0f172a
--color-nav-text:     #cbd5e1
--color-nav-active:   #67e8f9
--color-page-bg:      #f0f9ff
```

---

## Holdings in scope

`BRK-B` (USD), `JK8.SI` (SGD), `2823.HK` (HKD), `2838.HK` (HKD), `TSM` (USD), `CASH` (SGD).
FX pairs: `USDSGD=X`, `HKDSGD=X`.

---

## Code style rules

- **No comments** unless the WHY is genuinely non-obvious (a hidden constraint, workaround, or subtle invariant). Never explain what the code does — well-named identifiers do that.
- **No extra error handling** for impossible internal cases. Only validate at system boundaries (user input, API routes).
- **No new abstractions** beyond the task scope. Three similar lines is better than a premature abstraction.
- **No backwards-compat shims** for removed code.
- **No emojis** anywhere in code or UI text.

---

## After completing implementation

When you finish a phase or task, **update `HANDOVER.md`** so Claude can pick up context in the next session:

1. Add a "Current State — vX.Y" section at the top of the existing version history describing what changed.
2. Update any stale entries (e.g. sheet schema, file list, "What to Build Next").
3. Do **not** update `CLAUDE.md`, `GEMINI.md`, or `ROADMAP.md` unless the task explicitly says to.

This is the handover signal that design work can resume in Claude.

---

## What NOT to do

- Do not use `NextApiRequest` or `NextApiResponse`.
- Do not use `getServerSideProps` or `getStaticProps`.
- Do not create a module-level Sheets client singleton.
- Do not add `NEXT_PUBLIC_` prefixed env vars.
- Do not define types inline — use `src/types/index.ts`.
- Do not call Yahoo Finance from client-side components.
- Do not manually describe changes in code comments — put reasoning in commit messages.
- Do not add features, refactors, or abstractions beyond what the task specifies.
- Do not create `*.md` documentation files unless explicitly asked.
