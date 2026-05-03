# Wellspring — Implementation Plan

## Status

| Version | Date | Status |
|---|---|---|
| v0.1 | 2026-04-14 | ✅ Complete |
| v0.2 | 2026-04-16 | ✅ Complete |
| v0.3 | 2026-04-16 | ✅ Complete |
| v0.4 | 2026-04-18 | ✅ Complete |
| v0.4.1 | 2026-04-20 | ✅ Complete |
| v0.5 | TBD | 🔲 In progress |

---

## v0.5 — Expense Tracker

Parse Singapore bank/credit card statement PDFs into a unified transaction list, categorize by keyword rules, and display monthly summaries.

**Reference:** `statement-parser-spec.md` — full format spec for all 7 statement types.

**Test runner:** Vitest (no existing test setup). Tests live in `src/lib/expenses/__tests__/`.

---

### Data model

**`Expenses` sheet** — one row per transaction:
```
id | date | post_date | description | amount | direction | balance | account | category | source_file | imported_at
```

**`ExpenseRules` sheet** — user-defined merchant→category overrides:
```
merchant | category
```

**`id`** — SHA-256 hash of `date + description + amount + source_file` (hex, first 16 chars). Used for deduplication.

**Categories (fixed taxonomy):**
`Food & Drink`, `Transport`, `Groceries`, `Shopping`, `Healthcare`, `Entertainment`, `Travel`, `Utilities`, `Subscriptions`, `Bank Charges`, `Income`, `Transfer`, `Other`

CCY conversion fee rows from Citi → `Bank Charges`.

**`direction`:**
- Bank accounts: inferred from balance delta (`balance < prev → debit`, `balance > prev → credit`)
- Credit cards: per-statement rules (CR suffix, parentheses, GIRO PAYMENT direction from amount sign)

---

### New types (`src/types/index.ts`)

```ts
export interface ExpenseTransaction {
  id: string;
  date: string;           // YYYY-MM-DD (transaction date)
  postDate: string;       // YYYY-MM-DD (same as date if only one date col)
  description: string;
  amount: number;         // always positive
  direction: 'debit' | 'credit';
  balance: number | null; // null for credit cards
  account: string;        // e.g. "UOB Preferred Visa"
  category: string;
  sourceFile: string;
}

export interface ExpenseRule {
  merchant: string;  // case-insensitive substring match
  category: string;
}
```

---

### New files

```
src/lib/expenses/
  detect.ts          — statement type detection from filename + text
  categorize.ts      — keyword rule engine
  pipeline.ts        — orchestrator: detect → parse → categorize → dedup → write
  sheets.ts          — getExpenses, appendExpenses, getExpenseRules, replaceExpenseRules
  parsers/
    uob-deposit.ts   — UOB Lady's Savings + One Account (text-layer)
    uob-credit.ts    — UOB Preferred Visa + One Card + Lady's Card (text-layer)
    citi-credit.ts   — Citi Rewards + Cash Back Plus (text-layer)
    hsbc-credit.ts   — HSBC Premier CC + Revolution CC (OCR)
    hsbc-composite.ts — HSBC Premier composite savings section only (OCR)
src/app/
  expenses/page.tsx           — monthly summary + transaction list (Server Component)
  api/expenses/import/route.ts — POST, reads folder, runs pipeline
src/components/expenses/
  ExpensesClient.tsx  — filter state, monthly chart, transaction table
  ImportButton.tsx    — trigger import, shows progress/result
scripts/
  import-statements.ts  — CLI entry point
```

---

### Phase 0 — Test infrastructure

#### Task 0.1 — Install and configure Vitest
**Build:** `npm install -D vitest @vitest/coverage-v8`. Add to `package.json`:
```json
"scripts": { "test": "vitest run", "test:watch": "vitest", "test:coverage": "vitest run --coverage" }
```
Add `vitest.config.ts` at project root with `resolve.alias` mirroring `tsconfig.json` `@/` path.

**AC:**
- `npm test` finds and runs test files matching `**/__tests__/**/*.test.ts`
- `@/` alias resolves correctly in test files

---

### Phase 1 — Types and constants

#### Task 1.1 — Add types (`src/types/index.ts`)
**Build:** `ExpenseTransaction` and `ExpenseRule` interfaces (already shown above in Data model section).
**AC:** File compiles; `direction` is a union `'debit' | 'credit'`; `balance` allows `null`.
**Tests:** None — compile-time only.

#### Task 1.2 — Add constants (`src/lib/constants.ts`)
**Build:**
- `SHEET_NAMES.EXPENSES = 'Expenses'`
- `SHEET_NAMES.EXPENSE_RULES = 'ExpenseRules'`
- `EXPENSE_CATEGORIES: string[]` — the 13-item fixed taxonomy
- `BUILT_IN_RULES: Record<string, string>` — at minimum:
  ```ts
  GRAB, COMFORT, GOJEK → Transport
  NTUC, COLD STORAGE, FAIRPRICE, GIANT, SHENG SIONG → Groceries
  SPOTIFY, NETFLIX, APPLE.COM, GOOGLE → Subscriptions
  LAZADA, SHOPEE, AMAZON → Shopping
  GUARDIAN, WATSONS → Healthcare
  SINGTEL, STARHUB, M1, SP GROUP → Utilities
  GIRO PAYMENT, FAST PAYMENT, PAYNOW → Transfer
  CCY CONVERSION FEE → Bank Charges
  ```

**AC:** `EXPENSE_CATEGORIES.length === 13`; every value in `BUILT_IN_RULES` is a member of `EXPENSE_CATEGORIES`.
**Tests:** None.

#### Task 1.3 — Document env var
**Build:** Add `# STATEMENTS_FOLDER=/path/to/statements` comment to `.env.local`.
**AC:** Comment present.
**Tests:** None.

---

### Phase 2 — Shared parsing utilities (`src/lib/expenses/utils.ts`)

Pure functions shared by all parsers. These are the primary unit-test target.

#### Task 2.1 — `generateId`
**Build:**
```ts
generateId(date: string, description: string, amount: number, account: string): string
```
SHA-256 of `${date}|${description}|${amount}|${account}`, return first 16 hex chars. Use Node.js `crypto.createHash`.

**AC:** Same inputs → same output always. `generateId('2026-03-09', 'GRAB', 12.5, 'UOB One')` returns a 16-char hex string.
**Tests** (`utils.test.ts`):
- Determinism: call twice with same args → equal
- Sensitivity: changing any one argument produces a different id

#### Task 2.2 — `parseAmount`
**Build:**
```ts
parseAmount(raw: string): number
```
Strip commas, strip leading `(` and trailing `)`, strip trailing `CR`. Return `parseFloat`.

**AC:** Never returns `NaN` for valid bank statement amount strings.
**Tests** (`utils.test.ts`):
```
'1,234.56'  → 1234.56
'(990.27)'  → 990.27
'224.95CR'  → 224.95
'20.00'     → 20.00
'1,000'     → 1000
```

#### Task 2.3 — `parseDDMMM` and `parseDDMMMYYYY`
**Build:**
```ts
parseDDMMM(raw: string, year: number): string        // '09 Mar', 2026 → '2026-03-09'
parseDDMMMYYYY(raw: string): string                  // '19Mar2026' → '2026-03-19'
```
Map 3-letter month names (case-insensitive) to 1-based month index. Zero-pad day and month. Use `Date.UTC` — never `new Date('...')`.

**AC:** Output is always `YYYY-MM-DD`. Invalid input throws.
**Tests** (`utils.test.ts`):
```
parseDDMMM('09 Mar', 2026)  → '2026-03-09'
parseDDMMM('02 APR', 2026)  → '2026-04-02'   // uppercase months (UOB credit)
parseDDMMMYYYY('19Mar2026') → '2026-03-19'
parseDDMMMYYYY('31Mar2026') → '2026-03-31'
```

#### Task 2.4 — `inferYear`
**Build:**
```ts
inferYear(txMonth: number, stmtEndMonth: number, stmtEndYear: number): number
```
If `txMonth > stmtEndMonth` → transaction is from prior year, return `stmtEndYear - 1`. Otherwise return `stmtEndYear`.

**AC:** Handles year-boundary correctly (Dec tx in Jan statement).
**Tests** (`utils.test.ts`):
```
inferYear(12, 1, 2026)  → 2025   // Dec tx in Jan statement
inferYear(3, 3, 2026)   → 2026   // same month
inferYear(1, 3, 2026)   → 2026   // normal prior-month tx
```

#### Task 2.5 — `directionFromDelta`
**Build:**
```ts
directionFromDelta(balance: number, prevBalance: number): 'debit' | 'credit'
```
`balance < prevBalance` → `'debit'`. `balance > prevBalance` → `'credit'`. Equal → `'debit'`.

**AC:** Correct for standard cases.
**Tests** (`utils.test.ts`):
```
directionFromDelta(900, 1000) → 'debit'
directionFromDelta(1100, 1000) → 'credit'
directionFromDelta(1000, 1000) → 'debit'
```

#### Task 2.6 — `isCreditFromSuffix` and `isCreditFromParens`
**Build:**
```ts
isCreditFromSuffix(raw: string): boolean   // '224.95CR' → true; '20.00' → false
isCreditFromParens(raw: string): boolean   // '(990.27)' → true; '20.00' → false
```

**AC:** Correctly identifies format without mutating input.
**Tests** (`utils.test.ts`): one positive + one negative case each.

---

### Phase 3 — Category rule engine (`src/lib/expenses/categorize.ts`)

#### Task 3.1 — `categorize`
**Build:**
```ts
categorize(description: string, userRules: ExpenseRule[]): string
```
1. Check user rules first (order preserved) — case-insensitive substring match
2. Check `BUILT_IN_RULES` — case-insensitive
3. Return `'Other'` if no match

**AC:** User rule beats built-in for same merchant. Returns exactly a member of `EXPENSE_CATEGORIES`. Case-insensitive.
**Tests** (`categorize.test.ts`):
- Built-in match: `'GRAB SG'` → `'Transport'`
- User override beats built-in: userRule `{ merchant: 'GRAB', category: 'Food & Drink' }` → `'Food & Drink'`
- No match → `'Other'`
- Case insensitivity: `'grab'` matches `'GRAB'` rule

---

### Phase 4 — Statement type detection (`src/lib/expenses/detect.ts`)

#### Task 4.1 — `detectStatementType`
**Build:**
```ts
type StatementType = 'uob-deposit' | 'uob-credit' | 'citi-credit'
  | 'hsbc-credit-premier' | 'hsbc-credit-revolution' | 'hsbc-composite' | 'unknown'

detectStatementType(filename: string, text: string): StatementType
```

Text signals (checked first):
| Text contains | Result |
|---|---|
| `customer.service@uobgroup.com` | `uob-deposit` |
| `card.centre@uobgroup.com` | `uob-credit` |
| `Citibank Singapore` | `citi-credit` |
| `HSBC` + `COMPOSITE` | `hsbc-composite` |
| `HSBC` + `REVOLUTION` | `hsbc-credit-revolution` |
| `HSBC` (neither above) | `hsbc-credit-premier` |

Filename fallback (when text is empty — HSBC image PDFs):
- Filename contains `REVOLUTION` → `hsbc-credit-revolution`
- Filename contains `COMPOSITE` or `Composite` → `hsbc-composite`
- Otherwise → `hsbc-credit-premier`

**AC:** All 6 types detectable. Empty text falls back to filename.
**Tests** (`detect.test.ts`): one fixture string per type (minimal — just the signal substring):
```ts
detectStatementType('x.pdf', 'customer.service@uobgroup.com ...')  → 'uob-deposit'
detectStatementType('x.pdf', 'card.centre@uobgroup.com ...')        → 'uob-credit'
detectStatementType('x.pdf', 'Citibank Singapore ...')              → 'citi-credit'
detectStatementType('x.pdf', 'HSBC COMPOSITE ...')                  → 'hsbc-composite'
detectStatementType('x.pdf', 'HSBC REVOLUTION ...')                 → 'hsbc-credit-revolution'
detectStatementType('x.pdf', 'HSBC Premier ...')                    → 'hsbc-credit-premier'
// filename fallback:
detectStatementType('2026-04-28_Statement.pdf', '')                 → 'hsbc-credit-revolution'
```

---

### Phase 5 — Text-layer parsers

Each signature: `parse*(text: string, filename: string, year: number): ExpenseTransaction[]`

Year passed in explicitly (extracted from statement header by the pipeline). Each parser tested with a minimal inline fixture string representing realistic extracted text.

#### Task 5.1 — `parseUOBDeposit` (`parsers/uob-deposit.ts`)
**Build:**
- Anchor: line matching `^\d{2} [A-Z][a-z]{2}$`
- Collect lines until next anchor: first non-empty non-ref line = description; last two floats = amount + balance
- Direction: `directionFromDelta(balance, prevBalance)`
- Skip: `BALANCE B/F` row; lines after UOB footer (`United Overseas Bank Limited`); sections before `Account Transaction Details`

**AC:** Returns correct `direction` from balance delta. `BALANCE B/F` row absent from output. `balance` field populated.
**Tests** (`parsers/uob-deposit.test.ts`) — fixture with 3 transactions (2 debits, 1 credit inward transfer):
- Correct count (3 rows)
- First row: debit, correct date, amount, balance
- Credit row: direction `'credit'`
- `BALANCE B/F` row not present

#### Task 5.2 — `parseUOBCredit` (`parsers/uob-credit.ts`)
**Build:**
- Split text into card sections by detecting `PREFERRED VISA` / `UOB ONE CARD` / `LADY'S CARD` headers; set `account` per section
- Anchor: `^\d{2} [A-Z]{3}$` (Post Date); next `^\d{2} [A-Z]{3}$` = Trans Date
- Description: lines between Trans Date and amount, excluding `Ref No. :` lines
- Direction: default `'debit'`; `GIRO PAYMENT` description → `'credit'`
- Skip: `PREVIOUS BALANCE` row + its trailing `CR` amount line; `SUB TOTAL`; `TOTAL BALANCE FOR`; separator lines (`---`)
- `balance: null` (credit cards)

**AC:** Transactions attributed to correct card `account`. `GIRO PAYMENT` → `direction: 'credit'`. `Ref No.` stripped from description.
**Tests** (`parsers/uob-credit.test.ts`) — fixture with 2 transactions per card section (6 total), including 1 GIRO PAYMENT:
- Correct `account` per transaction
- GIRO PAYMENT → `'credit'`
- No `Ref No.` in any description
- `balance === null`

#### Task 5.3 — `parseCitiCredit` (`parsers/citi-credit.ts`)
**Build:**
- Split into card sections by `CITI REWARDS` / `CITI CASH BACK PLUS` headers; set `account`
- Anchor: `^\d{2} [A-Z]{3}$`
- Strip location/country lines after description (lines matching 2-letter country code or city name that appear before the amount float)
- Strip `FOREIGN AMOUNT ...` lines
- Credits: amount in parentheses `(990.27)` → `direction: 'credit'`, `amount: 990.27`
- `CCY CONVERSION FEE` description → pre-set `category: 'Bank Charges'`
- Skip: `BALANCE PREVIOUS STATEMENT`; `FAST INCOMING PAYMENT`; `SUB-TOTAL:`; `GRAND TOTAL`; rewards section
- `balance: null`

**AC:** Parentheses → credit direction. CCY CONVERSION FEE pre-categorized. Location lines absent from description.
**Tests** (`parsers/citi-credit.test.ts`):
- Parenthesised amount → `direction: 'credit'`, `amount` positive
- Plain amount → `direction: 'debit'`
- CCY CONVERSION FEE row → `category: 'Bank Charges'`
- Foreign transaction: `FOREIGN AMOUNT` line not in description, SGD amount used

---

### Phase 6 — OCR utilities and HSBC parsers

#### Task 6.1 — OCR utils (`parsers/ocr-utils.ts`)
**Build:**
```ts
pdfToImages(filePath: string): Promise<string[]>   // pdf2pic at 150 DPI → temp PNG paths
ocrImage(imagePath: string): Promise<string>        // tesseract.js → text string
ocrPdf(filePath: string): Promise<string>           // pdfToImages → ocrImage each → join '\n'
```

**Dependencies:** `npm install tesseract.js pdf2pic` + `brew install poppler graphicsmagick`

**AC:** Given a known HSBC PDF, `ocrPdf` returns a non-empty string. Temp image files cleaned up after OCR.
**Tests:** None (depends on external binaries; integration-test only against a real file).

#### Task 6.2 — `parseHSBCCredit` (`parsers/hsbc-credit.ts`)
**Build:**
- Input: OCR text (post `ocrPdf`)
- Anchor: `^\d{2}\s?[A-Z][a-z]{2}` (Post Date may have OCR spacing artefacts)
- Strip page-1 sidebar: discard lines matching `Previous Statement Balance`, `Payment`, `Purchases & Debits`, `GST Charges`, `Total Account Balance`
- Credits: raw amount ends with `CR` → `isCreditFromSuffix` → `direction: 'credit'`
- Skip: `Previous Statement Balance`; `Total Due`; rewards section; credit limit section
- `balance: null`

**AC:** `CR`-suffixed amounts → credit. Sidebar content absent. Date parsed correctly accounting for OCR spacing.
**Tests** (`parsers/hsbc-credit.test.ts`) — fixture using realistic post-OCR text (2 debits + 1 CR credit):
- CR row → `direction: 'credit'`, amount positive
- Sidebar labels not in output
- Correct transaction count

#### Task 6.3 — `parseHSBCComposite` (`parsers/hsbc-composite.ts`)
**Build:**
- Skip everything before savings section header; skip `SECURITIES & UNIT TRUSTS` section onwards
- Anchor: `^\d{2}[A-Z][a-z]{2}\d{4}$` (e.g. `19Mar2026`)
- Collapse all lines between two anchors into a single description string
- Last two floats on last line of block = (amount, balance)
- Direction: `directionFromDelta`
- Skip: `BALANCE BROUGHT FORWARD`; `TOTAL RELATIONSHIP BALANCE`; `END OF STATEMENT`

**AC:** Only savings transactions parsed (no securities rows). Direction from balance delta. Multi-line description collapsed.
**Tests** (`parsers/hsbc-composite.test.ts`) — fixture with 2 transactions:
- Correct direction from balance delta
- Multi-line description collapsed to single string
- Securities section rows not present

---

### Phase 7 — Sheets helpers (`src/lib/expenses/sheets.ts`)

#### Task 7.1 — Read/write helpers
**Build:**
- `getExpenses(): Promise<ExpenseTransaction[]>` — reads `Expenses` sheet, maps rows to type
- `getExpenseIds(): Promise<Set<string>>` — reads column A only (efficient dedup check)
- `appendExpenses(rows: ExpenseTransaction[]): Promise<void>` — single batch append, column order matches sheet header
- `getExpenseRules(): Promise<ExpenseRule[]>` — reads `ExpenseRules` sheet
- `upsertExpenseRule(rule: ExpenseRule): Promise<void>` — find-and-overwrite or append

**AC:** `appendExpenses` writes columns in the exact order: `id, date, post_date, description, amount, direction, balance, account, category, source_file, imported_at`. Empty `balance` written as empty string (not `null` literal).
**Tests:** None (Sheets API; mocking adds no value per project convention).

---

### Phase 8 — Import pipeline (`src/lib/expenses/pipeline.ts`)

#### Task 8.1 — `importStatements`
**Build:**
```ts
interface ImportResult {
  imported: number;
  skipped: number;
  errors: { file: string; message: string }[];
}

async function importStatements(folder: string): Promise<ImportResult>
```
Steps:
1. Read `.pdf` files from `folder`
2. For each: extract text via `pdf-parse`; if text is empty, fall back to `ocrPdf`
3. `detectStatementType` → dispatch to parser
4. Apply `categorize` to each transaction (pass user rules loaded once at start)
5. Load `existingIds` via `getExpenseIds()`
6. Filter duplicates
7. `appendExpenses(newRows)` in one call
8. Accumulate errors per file (don't abort on single-file failure)

**AC:** Duplicate ids never written twice. Single-file parse error does not abort other files. Returns accurate `imported` / `skipped` counts.
**Tests** (`pipeline.test.ts`) — mock `getExpenseIds`, `appendExpenses`, and the parser dispatch:
- All-new transactions: `imported === N`, `skipped === 0`, `appendExpenses` called with N rows
- All-duplicate transactions: `imported === 0`, `skipped === N`, `appendExpenses` called with empty array (or not called)
- One file throws: `errors.length === 1`, other files still processed, `imported` counts the successful ones

---

### Phase 9 — CLI script (`scripts/import-statements.ts`)

#### Task 9.1 — CLI entry point
**Build:**
- Load `.env.local` via dotenv
- Folder from `process.argv[2]` or `process.env.STATEMENTS_FOLDER`; exit with clear message if neither set
- Call `importStatements(folder)`
- Print:
  ```
  Import complete: 47 new, 12 duplicates skipped
  Errors (1):
    2026-04-06_Statement.pdf — OCR failed: ...
  ```

**AC:** `npx tsx scripts/import-statements.ts /path/to/folder` runs without error on a valid folder. Missing folder arg prints usage and exits 1.
**Tests:** None.

---

### Phase 10 — API route (`src/app/api/expenses/import/route.ts`)

#### Task 10.1 — `POST /api/expenses/import`
**Build:**
- `export const dynamic = 'force-dynamic'`
- Reads `STATEMENTS_FOLDER` from `process.env`; returns `{ error: 'STATEMENTS_FOLDER not configured' }` with 400 if missing
- Calls `importStatements(folder)`
- Returns `{ imported, skipped, errors }` on success; `{ error: string }` with 500 on uncaught failure

**AC:** Returns correct JSON shape. 400 if env var missing. Does not read from request body.
**Tests:** None.

---

### Phase 11 — UI

#### Task 11.1 — `/expenses` page (`src/app/expenses/page.tsx`)
**Build:** Server Component, `force-dynamic`. Fetch `getExpenses()` and `getExpenseRules()`. Pass to `ExpensesClient`.
**AC:** Page renders without error when Sheets returns empty arrays.
**Tests:** None.

#### Task 11.2 — `ExpensesClient` (`src/components/expenses/ExpensesClient.tsx`)
**Build:** `'use client'`. Props: `transactions: ExpenseTransaction[]`, `rules: ExpenseRule[]`.
- Month selector state (default: latest month with data, fallback current month): `< Apr 2026 >`
- Category breakdown: debits only, sorted by total descending. Columns: category | S$total | inline bar | %
- Transaction list: date | account | description | category dropdown | S$amount | debit/credit badge
- Category dropdown onChange → calls `updateExpenseCategoryAction(id, newCategory)` → optimistic update

**AC:** Month with no transactions shows empty state message. Category % sums to 100 (debits only). Dropdown shows all 13 categories.
**Tests:** None.

#### Task 11.3 — `ImportButton` (`src/components/expenses/ImportButton.tsx`)
**Build:** `'use client'`. POST to `/api/expenses/import`. States: idle → loading → done (shows counts) / error. Auto-reset to idle after 5s on done/error.
**AC:** Disabled while loading. Done state shows `"N imported, M skipped"`. Error state shows message.
**Tests:** None.

#### Task 11.4 — `updateExpenseCategoryAction` (`src/app/lib/actions.ts`)
**Build:** `'use server'`. Find row in `Expenses` sheet by `id` (column A), update category column (column I). Call `revalidatePath('/expenses')`.
**AC:** Only the category column updated; other columns unchanged.
**Tests:** None.

---

### Phase 12 — Navigation and provisioning

#### Task 12.1 — Nav link
**Build:** Add **Expenses** link to `src/components/nav.tsx` after Cash.
**AC:** Link appears in sidebar; active state matches `/expenses` path.

#### Task 12.2 — Provision route
**Build:** Add two tabs to `TABS` in `src/app/api/setup/provision/route.ts`:
```ts
{ title: 'Expenses', headers: ['id','date','post_date','description','amount','direction','balance','account','category','source_file','imported_at'] },
{ title: 'ExpenseRules', headers: ['merchant','category'] },
```
**AC:** Running `/api/setup/provision` on a fresh sheet creates both tabs with correct headers.

---

### Completion checklist

**Infrastructure**
- [x] Vitest installed and `npm test` runs

**Phase 1**
- [x] `ExpenseTransaction`, `ExpenseRule` types added
- [x] `EXPENSE_CATEGORIES`, `BUILT_IN_RULES`, sheet name constants added
- [x] `STATEMENTS_FOLDER` documented in `.env.local`

**Phase 2 — utils (with tests)**
- [x] `generateId` + tests
- [x] `parseAmount` + tests
- [x] `parseDDMMM`, `parseDDMMMYYYY` + tests
- [x] `inferYear` + tests
- [x] `directionFromDelta` + tests
- [x] `isCreditFromSuffix`, `isCreditFromParens` + tests

**Phase 3 — categorize (with tests)**
- [x] `categorize` + tests

**Phase 4 — detect (with tests)**
- [x] `detectStatementType` + tests

**Phase 5 — text parsers (with tests)**
- [x] `parseUOBDeposit` + tests
- [x] `parseUOBCredit` + tests
- [x] `parseCitiCredit` + tests

**Phase 6 — OCR + HSBC parsers (with tests)**
- [x] OCR utils (`pdfToImages`, `ocrImage`, `ocrPdf`)
- [x] `parseHSBCCredit` + tests
- [x] `parseHSBCComposite` + tests

**Phase 7 — Sheets**
- [x] `getExpenses`, `getExpenseIds`, `appendExpenses`, `getExpenseRules`, `upsertExpenseRule`

**Phase 8 — pipeline (with tests)**
- [x] `importStatements` + tests (dedup, error isolation)

**Phase 9–10 — entry points**
- [x] `scripts/import-statements.ts` runnable
- [x] `POST /api/expenses/import` returns correct shape

**Phase 11 — UI**
- [x] `/expenses` page renders
- [x] `ExpensesClient` (month selector, breakdown, transaction list, category override)
- [x] `ImportButton` (all states)
- [x] `updateExpenseCategoryAction`

**Phase 12 — Nav + provision**
- [x] Expenses nav link
- [x] Expenses + ExpenseRules tabs in provision route

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
