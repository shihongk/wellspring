@AGENTS.md
@MEMORY.md

# Wellspring — Claude Instructions

## Key documents

| File | Purpose | When to read |
|---|---|---|
| `SPEC.md` | Authoritative spec — design decisions, data model, UI rules | Before any design decision |
| `HANDOVER.md` | Current implementation state — what exists and how it works | Start of session / before touching a feature |
| `ROADMAP.md` | Idea backlog — features not yet designed | When a new feature comes up |
| `PLAN.md` | Versioned implementation plans with checklists | During active feature work |
| `MEMORY.md` | User's standing instructions (this file's sibling) | Auto-loaded every session |

Do not deviate from SPEC.md without being explicitly asked.

---

## Session workflow

1. **Before touching a feature** — check HANDOVER.md to understand what already exists.
2. **New feature request** — check ROADMAP.md to see if it's tracked; confirm approach before writing code.
3. **After shipping** — update HANDOVER.md (current state) and CLAUDE.md (if any convention changed).
4. **Idea, not ready to build** — add it to ROADMAP.md backlog, not PLAN.md.

---

## Next.js 16 — Breaking Changes to Know

Before writing any Next.js code, read the relevant guide in `node_modules/next/dist/docs/`.

Key patterns from this version (see SPEC.md §13 for full detail):

- **`params` is a Promise** in dynamic routes — always `await params`:
  ```ts
  export default async function Page({ params }: { params: Promise<{ ticker: string }> }) {
    const { ticker } = await params;
  }
  ```
- **`export const dynamic = 'force-dynamic'`** on every API route and the dashboard page. Market data must never be statically pre-rendered.
- **No `use cache` directive** — `cacheComponents` is not enabled in `next.config.ts`.
- **Route Handlers use Web APIs** — `Request` and `Response.json(...)`, not `NextApiRequest`/`NextApiResponse`.
- **Async Server Components** — pages and layouts can directly `await` data-fetching functions.
- **Client Components only at leaves** — nav, forms, chart need `'use client'`. Pages stay as Server Components.
- **Middleware is now `proxy.ts`** — file is `src/proxy.ts`, export is `export function proxy(request: NextRequest)`. The `middleware.ts` convention is deprecated.

---

## Project Conventions

### File structure
Follow the layout in SPEC.md §5 exactly. Do not add files outside this structure without a good reason.

### TypeScript types
All shared types live in `src/types/index.ts`. Do not define types inline in route files or components — import from there.

### Environment variables
Never use `NEXT_PUBLIC_` prefix. All env vars are server-only:
- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`

The private key uses literal `\n` in `.env.local`. Always transform in code:
```ts
process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n')
```

### Google Sheets client
Do not create a module-level singleton. Instantiate per invocation:
```ts
function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({ ... });
  return google.sheets({ version: 'v4', auth });
}
```

### Yahoo Finance
Import as `import YahooFinance from 'yahoo-finance2'`. Instantiate per-invocation inside the function (same pattern as the Sheets client — do not use a module-level `yf` singleton):
```ts
export async function fetchPricesAndFx() {
  const yf = new YahooFinance();
  // ...
}
```
Batch-fetch all tickers and FX pairs with `Promise.allSettled`. Use `result.regularMarketPrice` for price.

### FX conversion
Always call `toSGD(amount, currency, fxRates)` from `src/lib/fx.ts`. Never access FX rates from a global or module-level cache.

### Server Actions
All actions in `src/app/lib/actions.ts` start with `'use server'`. After every mutation, call `revalidatePath` on `/dashboard` and the relevant listing page.

### API error shape
All API routes return `{ error: string }` with the appropriate HTTP status on failure.

### Gap calculation in plan/allocation context
`computeGap(targetPct, currentPct)` returns `currentPct - targetPct`. **Negative = underweight** (shown in red/loss colour); positive = overweight. Do not invert.

When computing gaps in the plan snapshot, use equity-only allocation (exclude cash from the denominator), not the portfolio-wide `allocationPct` on each holding.

---

## Styling

Tailwind v4. SGD display format: `S$1,234.56` (2 decimal places, thousands separator). Custom tokens in `globals.css`:
- `--color-gain: #16a34a`
- `--color-loss: #dc2626`
- `--color-primary: #0e7490`
- `--color-primary-dark: #4338ca`
- `--color-accent: #22c55e`
- `--color-nav-bg: #0f172a`
- `--color-nav-text: #cbd5e1`
- `--color-nav-active: #67e8f9`
- `--color-page-bg: #f0f9ff`

---

## Graceful Fallbacks

- Yahoo Finance down → use `FxRates` sheet as fallback; set `pricesStale: true`
- Individual price fails → `currentPriceLocal: null`; show `—` in UI
- FX sheet empty (first run) → hardcoded fallback: USDSGD=1.34, HKDSGD=0.17
- Sheets unreachable → 500 from API route

---

## Holdings in Scope

`BRK-B` (USD), `JK8.SI` (SGD), `2823.HK` (HKD), `2838.HK` (HKD), `TSM` (USD), `CASH` (SGD).
FX pairs: `USDSGD=X`, `HKDSGD=X`.

---

## Scripts (`scripts/`)

- Load `.env.local` via `config({ path: resolve(__dirname, '../.env.local') })` from `dotenv` — never rely on the shell environment.
- Use UTC-safe date construction: parse date parts manually and use `Date.UTC(y, m-1, d)`. Never `new Date('YYYY-MM-DD')` — it shifts by timezone.
- Run via `npx tsx scripts/<name>.ts`.

---

## What NOT to do

- Do not use `NextApiRequest`/`NextApiResponse`.
- Do not use `getServerSideProps` or `getStaticProps` — this is App Router only.
- Do not read Google Sheets credentials from anywhere other than `process.env`.
- Do not call Yahoo Finance from client-side code — server-side only.
- Do not create a module-level Sheets singleton.
- Do not add `NEXT_PUBLIC_` prefixed env vars.
- Do not manually edit the Google Sheets — all mutations go through the API/actions.
