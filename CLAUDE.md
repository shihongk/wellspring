@AGENTS.md

# Wellspring — Claude Instructions

SPEC.md is the authoritative source of truth for this project. Read it before making any design decisions. Do not deviate from it without being explicitly asked.

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
Import as `import YahooFinance from 'yahoo-finance2'` and use `new YahooFinance()`. Batch-fetch all tickers and FX pairs with `Promise.allSettled`. Use `result.regularMarketPrice` for price.

### FX conversion
Always call `toSGD(amount, currency, fxRates)` from `src/lib/fx.ts`. Never access FX rates from a global or module-level cache.

### Server Actions
All actions in `src/app/lib/actions.ts` start with `'use server'`. After every mutation, call `revalidatePath` on `/dashboard` and the relevant listing page.

### API error shape
All API routes return `{ error: string }` with the appropriate HTTP status on failure.

---

## Styling

Tailwind v4. SGD display format: `S$1,234.56` (2 decimal places, thousands separator). Custom tokens in `globals.css`:
- `--color-gain: #16a34a`
- `--color-loss: #dc2626`
- `--color-primary: #0f766e`

---

## Graceful Fallbacks

- Yahoo Finance down → use `FxRates` sheet as fallback; set `pricesStale: true`
- Individual price fails → `currentPriceLocal: null`; show `—` in UI
- FX sheet empty (first run) → hardcoded fallback: USDSGD=1.34, HKDSGD=0.17
- Sheets unreachable → 500 from API route

---

## Holdings in Scope

`BRK-B` (USD), `JK8.SI` (SGD), `2823.HK` (HKD), `2838.HK` (HKD), `CASH` (SGD).
FX pairs: `USDSGD=X`, `HKDSGD=X`.

---

## What NOT to do

- Do not use `NextApiRequest`/`NextApiResponse`.
- Do not use `getServerSideProps` or `getStaticProps` — this is App Router only.
- Do not read Google Sheets credentials from anywhere other than `process.env`.
- Do not call Yahoo Finance from client-side code — server-side only.
- Do not create a module-level Sheets singleton.
- Do not add `NEXT_PUBLIC_` prefixed env vars.
- Do not manually edit the Google Sheets — all mutations go through the API/actions.
