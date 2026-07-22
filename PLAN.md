# Wellspring — Implementation Plan

## Status

| Version | Date | Status |
|---|---|---|
| v0.1 | 2026-04-14 | ✅ Complete |
| v0.2 | 2026-04-16 | ✅ Complete |
| v0.3 | 2026-04-16 | ✅ Complete |
| v0.4 | 2026-04-18 | ✅ Complete |
| v0.4.1 | 2026-04-20 | ✅ Complete |
| v0.5 | 2026-05-03 | ✅ Complete |
| v0.6 | 2026-05-04 | ✅ Complete |
| v0.7 | 2026-05-06 | ✅ Complete |
| v0.8 | 2026-05-07 | ✅ Complete |
| v0.8.1 | 2026-07-21 | ✅ Complete |
| v0.9 | 2026-07-21 | ✅ Complete |

---

## v0.9 — Expense Data Integrity + Rules Engine

### Objective

Three phases, risk-ordered. Full task specs in `tasks/v0.9-phase*.md`.

1. **Balance-continuity validation** — automate the manual OCR-integrity check from the v0.8.1 debugging session: after any import (and on demand), flag rows where `balance != prevBalance ± amount`.
2. **Extended rules engine** — generalize `ExpenseRules` from `merchant → category` to structured match (description-contains + optional account / exact amount / direction) → action (set category and/or exclude). Subsumes four backlog items: CC bill payments counted as income, richer built-in rules, self-transfer double-counting, recurring-exclusion rules ($1 HSBC `OTHR` verification transfers). Plus a "Hide transfers" filter (default on) in the income/spending views.
3. **Retirement wiring** — replace hardcoded `initialGrossMonthlySalary={9000}` / `initialNetMonthlyCashFlow={3000}` in `retirement/page.tsx`: gross salary derived from recent CPF `CON` transactions ÷ contribution rate; net cash flow derived from the expense projection engine. Manual overrides stay.

### Decisions (2026-07-21)

- Rule matching stays structured fields, no regex — extend the existing per-row rule-creation flow, don't build a new one.
- Gross salary from CPF contributions (ceiling-capped is fine — the projection only uses gross to compute CPF contributions, which are capped anyway).
- CPF statement upload backlog item was stale — already shipped in v0.7/v0.8 (`cpf-annual.ts`).

### Checklist

- [x] Phase 1 — balance-continuity validation (`tasks/v0.9-phase1-balance-validation.md`)
- [x] Phase 2 — extended rules engine (`tasks/v0.9-phase2-rules-engine.md`)
- [x] Phase 3 — retirement wiring (`tasks/v0.9-phase3-retirement-wiring.md`)

### v0.10 (parked, direction agreed)

Margin financing: model margin as a cash account allowed to go negative (e.g. "IBKR Margin"); reframe "All-time Return" against net contributed capital (deposits − withdrawals, excluding margin proceeds). Open design question: Cash sheet holds balances, not flows — contributed capital needs deposit/withdrawal events. Design pass before build.

---

## v0.8.1 — Expense Import Bug Fixes (Complete)

Patch release fixing multiple OCR-parsing and data-integrity bugs found while auditing HSBC composite statement imports, plus 4 new expense categories.

### Changes shipped

**Parser fixes — `hsbc-composite.ts`:**
- Multi-transaction date grouping — HSBC only prints the date once per day; multiple same-day transactions were being merged into one row (only the last transaction's amount survived, the rest silently lost)
- Page-break boilerplate filtering — disclaimer text, branch letterhead, name/address block, "Statement Details" box, repeated "EVERYDAY GLOBAL ACC" header, and column headers no longer leak into transaction descriptions
- "CLOSING BALANCE" / "Transaction Turnover" / "Transaction Count" end-of-account summary rows no longer parsed as bogus transactions
- Date-anchor line content preservation — real transaction content sharing a line with the date anchor (e.g. `11May2026 |TO 4835 8500 2021 9896`) is no longer silently dropped
- HSBC logo/letterhead OCR garble (`Wh. HSBC pd Premier`, `X) Premier`) filtered from descriptions

**Parser fixes — `uob-deposit.ts`:**
- Foreign-currency wallet sub-accounts (e.g. JPY) now use the printed SGD-equivalent figure instead of the raw foreign-currency amount

**Parser fixes — `citi-credit.ts`:**
- `CCY CONVERSION FEE` lines in concatenated (no-space) PDFs now correctly split into their two constituent figures (reference amount + actual fee) instead of mis-parsing a merged digit run

**Parser fixes — `hsbc-credit.ts`:**
- `CREDIT LIMIT AND INTEREST RATES` sidebar box no longer bleeds onto a transaction row, replacing its real amount with the card's credit limit figure

**Import pipeline — `pipeline.ts`:**
- `importStatements(folder)` now consistently reads from `folder/Pending` and writes to `folder/Processed` as siblings, instead of nesting `Processed` inside whatever path was passed
- Validates `Pending/` exists before creating anything, so a wrong path fails cleanly instead of leaving a stray folder

**New categories:** Insurance, Personal Care, Electronics, Sports — added to the taxonomy, category dropdown, donut colors, and projection subgroup mapping; built-in rules added for common merchants where known (FWD, AIA, Prudential, etc. for Insurance; Courts, Harvey Norman, Challenger, Gain City, Best Denki for Electronics)

**Data corrections:** Deleted and reimported all 7 HSBC Savings composite statements (Jan–Jul 2026) with the fixed parser; manually corrected ~8 additional OCR digit-misreads found via balance-continuity verification (each row's balance should equal prior ± amount) and cross-checked against the actual statement PDF page images; corrected 2 JPY-wallet amounts, 2 CCY conversion fee amounts, and deleted 1 bogus credit-limit transaction

### Tests
165/165 passing (up from 145 at session start).

---

## v0.8 — CPF Tab, Transaction History & Projection Corrections

### Objective

Three improvements to the CPF/retirement feature:
1. Move CPF into its own dedicated tab in the Expenses page.
2. Store and display CPF transactions from the annual statement.
3. Fix retirement projections to deduct HDB loan payments (OA) and MediSave premiums (MA).

---

### Key facts (user-provided)

- **HDB loan:** started Sep 2023, 25-year term → ends Sep 2048. Monthly OA deduction: **$1,205**.
- **MediSave (MSL + CSL):** from the 2025 statement: ~$591 MSL + ~$227 CSL ≈ **$818/year from MA**. Scale by healthcare inflation (~5%/year) in projections.

---

### Change 1 — CPF tab in Expenses

Current tabs: `transactions | projections`
New tabs: `transactions | cpf | projections`

- Move `<CpfPanel>` from always-visible (above tab bar) into the CPF tab body.
- CPF tab shows: CPF balance panel (top) + CPF transaction list (below).
- No changes to `ImportButton` placement or behaviour.

**Files:** `src/components/expenses/ExpensesClient.tsx`

---

### Change 2 — Store & display CPF transactions

**New sheet tab:** `CpfTransactions`

| Column | Value |
|---|---|
| `date` | `YYYY-MM-DD` |
| `code` | e.g. `CON`, `HSE`, `INT`, `MSL`, `CSL`, `MED` |
| `ref` | employer/ref label from statement footer (e.g. `A`, `B`, `C`), empty if none |
| `oa_change` | signed number (negative = deduction) |
| `sa_change` | signed number |
| `ma_change` | signed number |

**New type (`src/types/index.ts`):**
```ts
export interface CpfTransaction {
  date: string;       // YYYY-MM-DD
  code: string;
  ref: string;        // '' if none
  oaChange: number;
  saChange: number;
  maChange: number;
}
```

**Parser update (`src/lib/expenses/parsers/cpf-annual.ts`):**
- Add `parseCpfTransactions(text: string): CpfTransaction[]` alongside the existing `parseCpfAnnual`.
- Parse every data row (not just BAL rows): `DD MMM CODE [REF] $X.XX $X.XX $X.XX`.
- Skip appendix/legend lines.

**Pipeline update (`src/lib/expenses/pipeline.ts`):**
- After `upsertCpfBalance`, call `appendCpfTransactions(txs)` (new sheet helper).
- Deduplication: skip rows where the same `date + code + ref` already exists in the sheet (load existing set once at the start of the import run, same pattern as `getExpenseIds`).

**New sheet helpers (`src/lib/retirement/sheets.ts`):**
- `getCpfTransactionKeys(): Promise<Set<string>>` — returns `Set<"date|code|ref">` for dedup.
- `appendCpfTransactions(rows: CpfTransaction[]): Promise<void>` — batch append.

**New provision tab (`src/app/api/setup/provision/route.ts`):**
```
{ title: 'CpfTransactions', headers: ['date','code','ref','oa_change','sa_change','ma_change'] }
```

**Display (CPF tab in `ExpensesClient`):**
- Chronological list of `CpfTransaction` rows fetched from the sheet.
- Group by month. Each row: date | code | ref | OA Δ | SA Δ | MA Δ.
- Colour: positive = gain colour, negative = loss colour.

**New sheet helper:** `getCpfTransactions(): Promise<CpfTransaction[]>` — all rows ascending.

**New page data fetch (`src/app/expenses/page.tsx`):** add `getCpfTransactions()` alongside existing fetches, pass to `ExpensesClient`.

---

### Change 3 — HDB deduction in OA projection

**In `src/lib/retirement/cpf.ts` → `projectCpfYear`:**

After adding annual contributions but before computing interest, deduct HDB loan payment from OA:

```ts
// HDB loan: Sep 2023 – Sep 2048, $1,205/month from OA
const HDB_MONTHLY = 1205;
const HDB_END_YEAR = 2048; // Sep 2048 — treated as full year 2048, stops in 2049

if (currentYear <= HDB_END_YEAR && grossMonthlySalary > 0) {
  oa -= HDB_MONTHLY * 12;
  oa = Math.max(0, oa); // OA can't go negative
}
```

Note: deduction only applies while employed (salary > 0). At retirement, HDB would switch to cash payments — but the loan ends 2048 and retirement is 2049, so the deduction covers the full loan period without hitting retirement.

---

### Change 4 — MediSave deductions in MA projection

**In `src/lib/retirement/cpf.ts` → `projectCpfYear`:**

After contributions, deduct annual MediSave outflows from MA:

```ts
// MediShield Life + CareShield Life: ~$818/year at age 40, scaled 5%/year healthcare inflation
const BASE_MA_DEDUCTION = 818;  // 2025 actuals
const BASE_YEAR = 2025;
const HEALTHCARE_INFLATION = 0.05;

const maDeduction = BASE_MA_DEDUCTION * Math.pow(1 + HEALTHCARE_INFLATION, currentYear - BASE_YEAR);
ma -= maDeduction;
ma = Math.max(0, ma); // MA can't go negative (topped up by contributions)
```

---

### New constants (`src/lib/constants.ts`)

```ts
export const HDB_MONTHLY_OA = 1205;
export const HDB_LOAN_END_YEAR = 2048;
export const MA_BASE_ANNUAL_DEDUCTION = 818;   // MSL + CSL actuals from 2025 statement
export const MA_DEDUCTION_BASE_YEAR = 2025;
export const MA_HEALTHCARE_INFLATION = 0.05;
export const SHEET_NAMES = { ..., CPF_TRANSACTIONS: 'CpfTransactions' };
```

---

### Migration

New route `POST /api/setup/migrate-cpf-transactions` — adds `CpfTransactions` tab to existing sheet, idempotent. Add button to setup page.

---

### Phase checklist

- [x] **Phase 1 — Types & schema:** `CpfTransaction` type, `CPF_TRANSACTIONS` constant, provision + migrate route
- [x] **Phase 2 — Parser:** `parseCpfTransactions` in `cpf-annual.ts`
- [x] **Phase 3 — Data layer:** `getCpfTransactionKeys`, `appendCpfTransactions`, `getCpfTransactions` in `retirement/sheets.ts`
- [x] **Phase 4 — Pipeline:** `appendCpfTransactions` wired into `pipeline.ts` for `cpf-annual` statements
- [x] **Phase 5 — Projection fixes:** HDB deduction + MediSave deduction in `projectCpfYear`; constants added
- [x] **Phase 6 — UI:** `CpfTransactionList` component created; `ExpensesClient` restructured with dedicated CPF tab; `page.tsx` fetches and passes transactions down

---

## v0.7 — Retirement & CPF Projection

### Objective

New `/retirement` nav page projecting long-term net worth (investments + CPF + cash) for retirement planning. CPF balance panel added to the expenses tab as a companion widget. Strategy preferences (BRS target, per-ticker returns, one-off expenses) encoded per `cpf-retirement-KB.md`.

---

### Key design decisions

- **CPF strategy:** Target BRS at 55, not FRS/ERS. Excess above BRS withdrawn and reinvested proportionally into existing holdings.
- **Net monthly surplus** (income − expenses − employee CPF): auto-reinvested proportionally into existing holdings by current ticker weight.
- **Investment returns:** per-ticker assumption (5 tickers). Set by user in UI, persisted to `localStorage`.
- **CPF computation:** derived from law — contribution rates, allocation, interest, SA→RA at 55, CPF LIFE from RA at 65.
- **CPF LIFE payout model:** BRS-scaled — `monthly = (RA_at_65 / projectedBRS_at_65) × basePayout`. Deferral to 70 adds +7%/yr.
- **Retirement sums growth:** BRS/FRS/ERS grow ~3.5%/yr from 2026 base.
- **User DOB:** June 1984 → age 55 in 2039, age 65 in 2049. Pre-filled in UI.
- **CPF balances source:** `CpfBalances` Sheet tab, seeded from yearly statement upload (manual data entry for now).
- **One-off expenses:** stored in `RetirementOneOffs` Sheet tab; reduce investable cash in that calendar year.

---

### CPF rules to encode (from 1 Jan 2026)

**Contribution rates (total = employee + employer, applied to gross monthly wage):**

| Age | Employer | Employee | Total |
|---|---|---|---|
| ≤55 | 17% | 20% | 37% |
| 55–60 | 16% | 18% | 34% |
| 60–65 | 12.5% | 12.5% | 25% |
| 65–70 | 9% | 7.5% | 16.5% |
| >70 | 7.5% | 5% | 12.5% |

**Allocation rates (% of gross wage going to each account):**

| Age | OA | SA | MA |
|---|---|---|---|
| ≤35 | 23% | 6% | 8% |
| 35–45 | 21% | 7% | 9% |
| 45–50 | 19% | 8% | 10% |
| 50–55 | 15% | 11.5% | 10.5% |
| 55–60 | 12% | 0% → RA | 10.5% (11.5% total→RA/OA split per CPF rules) |
| 60–65 | 3.5% | 0% → RA | 10.5% |
| >65 | 1% | 0% | 10.5% |

Note: From age 55, SA is closed; contributions route to RA (up to FRS) then OA.

**Interest rates:** OA 2.5% p.a. | SA 4% | MA 4% | RA 4%
Extra 1% on first $60k combined (capped at $20k from OA).

**Retirement sums (2026 base, growing 3.5%/yr):**
BRS $110,200 | FRS $220,400 | ERS $440,800

**CPF LIFE payout (Standard Plan, BRS cohort):**
`monthly_payout = (RA_balance_at_payout_age / projected_BRS_at_payout_age) × $950`
Deferral past 65: +7% per year, max age 70.

---

### New types (`src/types/index.ts`)

```ts
export interface CpfBalance {
  date: string;          // YYYY-MM-DD (as of date)
  oa: number;
  sa: number;
  ma: number;
}

export interface RetirementOneOff {
  id: string;
  year: number;
  description: string;
  amountSGD: number;
}

export interface CpfProjectionYear {
  year: number;
  age: number;
  oa: number;
  sa: number;           // 0 after age 55
  ma: number;
  ra: number;           // created at 55
  totalCpf: number;
  monthlyContribEmployee: number;
  monthlyContribEmployer: number;
  cpfLifeMonthlyPayout: number | null;   // non-null from payout start age
}

export interface RetirementProjectionYear {
  year: number;
  age: number;
  investments: number;       // total portfolio value SGD
  cpf: CpfProjectionYear;
  cashReserve: number;
  netWorth: number;
  netMonthlyCashFlow: number;
  oneOffExpenses: number;    // total one-offs in this year
}

export interface RetirementSettings {
  dob: string;               // 'YYYY-MM' — June 1984 → '1984-06'
  retirementAge: number;     // default 65
  payoutStartAge: number;    // default 65, max 70
  tickerReturns: Record<string, number>;  // ticker → annual % e.g. { 'BRK-B': 8 }
  grossMonthlySalaryOverride: number | null;  // null = derived from expense projections
}
```

---

### New Sheet tabs

| Tab | Columns |
|---|---|
| `CpfBalances` | `date \| oa \| sa \| ma` |
| `RetirementOneOffs` | `id \| year \| description \| amount_sgd` |

---

### Phase 1 — Types, Schema & Data Layer ✅

**Priority: 1 (foundation for all phases)**

#### Tasks

**1.1** Add types to `src/types/index.ts`: `CpfBalance`, `RetirementOneOff`, `CpfProjectionYear`, `RetirementProjectionYear`, `RetirementSettings`.

**1.2** Add constants to `src/lib/constants.ts`:
- `SHEET_NAMES.CPF_BALANCES = 'CpfBalances'`
- `SHEET_NAMES.RETIREMENT_ONE_OFFS = 'RetirementOneOffs'`
- `CPF_CONTRIBUTION_RATES` — array of `{ maxAge, employer, employee, total }` entries (5 brackets from law table above)
- `CPF_ALLOCATION_RATES` — array of `{ maxAge, oa, sa, ma }` entries
- `CPF_INTEREST = { oa: 0.025, sa: 0.04, ma: 0.04, ra: 0.04, extraOnFirst60k: 0.01 }`
- `CPF_RETIREMENT_SUMS_2026 = { brs: 110200, frs: 220400, ers: 440800, growthRate: 0.035 }`
- `CPF_LIFE_BASE_BRS_MONTHLY = 950` — estimated monthly payout at 2026 BRS
- `CPF_LIFE_DEFERRAL_BONUS = 0.07` — 7% per year deferred past 65

**1.3** Add Sheet helpers to a new file `src/lib/retirement/sheets.ts`:
- `getCpfBalances(): Promise<CpfBalance[]>` — all rows, ascending by date
- `getLatestCpfBalance(): Promise<CpfBalance | null>`
- `upsertCpfBalance(balance: CpfBalance): Promise<void>` — keyed on date
- `getRetirementOneOffs(): Promise<RetirementOneOff[]>`
- `upsertRetirementOneOff(item: RetirementOneOff): Promise<void>`
- `deleteRetirementOneOff(id: string): Promise<void>`

**1.4** Add Server Actions to `src/app/lib/actions.ts`:
- `saveCpfBalanceAction(balance: CpfBalance)`
- `saveRetirementOneOffAction(item: RetirementOneOff)`
- `deleteRetirementOneOffAction(id: string)`

**1.5** Update `src/app/api/setup/provision/route.ts` to include `CpfBalances` and `RetirementOneOffs` tabs.

**1.6** Create `src/app/api/setup/migrate-retirement/route.ts` — adds `CpfBalances` and `RetirementOneOffs` tabs to existing sheet. Returns `{ created: string[] }`.

**AC:** Sheet helpers compile; provision route creates both tabs with correct headers; migrate route is idempotent.

---

### Phase 2 — CPF Computation Engine ✅

**Priority: 2**

**File:** `src/lib/retirement/cpf.ts`

#### Functions

**`getCpfContributionRate(age: number)`** → `{ employer, employee, total }` — looks up `CPF_CONTRIBUTION_RATES` by age bracket.

**`getCpfAllocationRates(age: number)`** → `{ oa, sa, ma }` — looks up `CPF_ALLOCATION_RATES`. At age ≥55, `sa` is 0.

**`projectCpfYear(params)`:**
```ts
{
  currentYear: number;
  dob: string;
  balances: { oa, sa, ma, ra };
  grossMonthlySalary: number;
  brsAtAge55: number;        // pre-computed
}
→ CpfProjectionYear
```
- Computes age from dob + currentYear
- Applies 12 months of contributions using `getCpfContributionRate` + `getCpfAllocationRates`
- Applies annual interest on OA/SA/MA/RA (including extra 1% on first $60k combined)
- At age 55: transfers SA to RA up to projected FRS; excess OA above BRS flagged as withdrawable
- At age 65 (or `payoutStartAge`): RA converts to CPF LIFE; computes `cpfLifeMonthlyPayout`

**`projectCpf(params)`:**
```ts
{
  startBalances: CpfBalance;
  dob: string;
  grossMonthlySalary: number;
  endYear: number;
  payoutStartAge: number;
}
→ CpfProjectionYear[]
```
Year-by-year from start date through `endYear`.

**Tests** (`src/lib/retirement/__tests__/cpf.test.ts`):
- Contribution rate correct for each age bracket
- Interest computes correctly for a known year
- SA→RA transfer happens at age 55, SA becomes 0
- CPF LIFE payout non-null from payout age
- BRS withdrawal: excess above BRS extracted at age 55 and added to investable pool

---

### Phase 3 — Retirement Projection Engine ✅

**Priority: 3**

**File:** `src/lib/retirement/projections.ts`

#### Function: `projectRetirement(params)`

```ts
{
  cpfStartBalances: CpfBalance;
  dob: string;
  retirementAge: number;
  payoutStartAge: number;
  grossMonthlySalary: number;        // from expense projections or override
  netMonthlyCashFlow: number;        // income − expenses (from expense projection engine)
  currentPortfolioByTicker: Record<string, number>;   // SGD value per ticker
  tickerReturns: Record<string, number>;              // annual % per ticker
  tickerWeights: Record<string, number>;              // current weight per ticker (sum=1)
  oneOffs: RetirementOneOff[];
  horizonYears: number;
}
→ RetirementProjectionYear[]
```

**Logic per year:**
1. CPF: call `projectCpfYear`; capture `brsWithdrawal` at age 55
2. Employee CPF contribution deducted from gross salary → reduces investable cash
3. Net investable cash = `netMonthlyCashFlow × 12` + `brsWithdrawal` (at 55) − `oneOffExpenses`
4. If `netInvestable > 0`: distribute proportionally across tickers by weight
5. Each ticker grows by its annual return %
6. `netWorth = investments + totalCpf + cashReserve`

**Tests** (`src/lib/retirement/__tests__/projections.test.ts`):
- Without any income or one-offs: investments grow purely by ticker return
- One-off expense in year Y reduces investments in that year
- BRS withdrawal at 55 is added to investments
- CPF LIFE payout starts at `payoutStartAge`, adds to net monthly cash flow from that year

---

### Phase 4 — CPF Panel in Expenses Tab ⬜

**Priority: 4**

**New component:** `src/components/expenses/CpfPanel.tsx` (`'use client'`)

Displays a compact read-only panel showing latest CPF balances and computed monthly contribution estimate.

**Props:** `balance: CpfBalance | null`, `grossMonthlySalary: number`, `userAge: number`

**UI:**
- Three balance cards: OA | SA | MA with formatted SGD amounts and an as-of date label
- Monthly contribution row: employee share | employer share | total (computed via `getCpfContributionRate` + `getCpfAllocationRates`)
- "Update balances" button → opens inline form to enter new OA/SA/MA + date, calls `saveCpfBalanceAction`
- If `balance === null`: empty state prompting user to enter balances

**Wiring:**
- `src/app/expenses/page.tsx`: fetch `getLatestCpfBalance()`, compute `userAge` from DOB constant, pass to `ExpensesClient`
- `ExpensesClient.tsx`: render `<CpfPanel>` below the import button row, above the tab bar

---

### Phase 5 — Retirement Page ⬜

**Priority: 5**

#### Server Component: `src/app/retirement/page.tsx`

`force-dynamic`. Fetches: `getLatestCpfBalance()`, `getRetirementOneOffs()`, portfolio holdings + prices (reuse existing `computePortfolioSnapshot`). Passes all to `RetirementClient`.

#### Client Component: `src/components/retirement/RetirementClient.tsx`

**Settings panel** (collapsible, localStorage-persisted):
- DOB: pre-filled `'1984-06'`, editable
- Retirement age: default 65
- Payout start age: default 65, range 65–70 (deferral shown: "+X% per year")
- Gross monthly salary: pre-filled from CPF derivation, overridable
- Per-ticker return inputs: one `%` field per current holding (BRK-B, TSM, JK8.SI, 2823.HK, 2838.HK)

**One-off expenses editor:**
- Table: year | description | amount SGD | delete button
- Add row form: year input, description, amount → `saveRetirementOneOffAction`
- Optimistic updates

**Projection chart:**
- Stacked area chart (SVG, same pattern as existing charts)
- Layers (bottom to top): Investments | OA | SA/RA | MA | Cash Reserve
- X-axis: years to retirement age + 10 post-retirement
- Vertical marker line at retirement age and at CPF LIFE start age
- Toggle: show net worth only vs. stacked breakdown

**KPI cards (at retirement age):**
- Total net worth
- Investment value
- Total CPF (OA+RA+MA)
- Monthly CPF LIFE payout (SGD/month)
- Monthly cash flow required to fund retirement (from expense projection at that year)

---

### Phase 6 — Navigation & Provisioning ✅

**Priority: 6**

**6.1** Add **Retirement** link to `src/components/nav.tsx` (after Expenses, before Setup).

**6.2** Ensure `provision/route.ts` includes both new tabs (done in Phase 1.5).

**6.3** Add `MigrateRetirementSection` to `src/app/setup/page.tsx` — button to run `POST /api/setup/migrate-retirement`.

---

### Completion checklist

**Phase 1 — Data layer**
- [x] `CpfBalance`, `RetirementOneOff`, `CpfProjectionYear`, `RetirementProjectionYear`, `RetirementSettings` types
- [x] CPF rate/allocation/interest/retirement sum constants
- [x] `src/lib/retirement/sheets.ts` helpers
- [x] Server actions for CPF balance + one-off CRUD
- [x] Provision route updated; migrate-retirement route created

**Phase 2 — CPF engine**
- [x] `getCpfContributionRate`, `getCpfAllocationRates`
- [x] `projectCpfYear` (contributions, interest, SA→RA at 55, CPF LIFE at 65)
- [x] `projectCpf` (year-by-year array)
- [x] Tests passing (17)

**Phase 3 — Retirement projection engine**
- [x] `projectRetirement` (combines CPF + investments + one-offs)
- [x] Tests passing (9)

**Phase 4 — CPF panel** ✅
- [x] `CpfPanel` component (balance display + contribution estimate + update form)
- [x] Wired into `ExpensesClient`
- [x] `getLatestCpfBalance` fetched in expenses page

**Phase 5 — Retirement page** ✅
- [x] `src/app/retirement/page.tsx`
- [x] `RetirementClient` — settings panel (DOB, ages, returns)
- [x] One-off expenses editor
- [x] Stacked area projection chart
- [x] KPI cards at retirement age

**Phase 6 — Nav & provisioning**
- [x] Retirement nav link
- [x] `MigrateRetirementSection` in setup page

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
# v0.6 — Historical & Predictive Projections

## Objective

Dedicated "Projections" tab in the Expenses view. Forecasts future cash flow from historical averages with manual overrides, multi-year horizon, and configurable inflation.

---

### Key design decisions

- **Baseline exclusions:** `excluded: true`, `oneOff: true`, `Transfer` category, `Investment` category all excluded from baseline.
- **Averaging:** sum per category ÷ total months in baseline (even if category absent in some months).
- **One-off flag:** new `oneOff` boolean on `ExpenseTransaction` (col M in sheet). Excluded from baseline, not projected forward.
- **Inflation:** two rates — `expenseInflationRate` and `incomeGrowthRate`. Compounded annually.
- **Projection horizon:** rolling from next full month. Multi-year: to end of current year, then full calendar years. MAX = 50 years feasible (computation is trivial).
- **Range toggles:** 3M / 6M / 12M / 3Y / 5Y / 10Y / MAX.
- **Chart granularity:** monthly bars ≤ 24 months; annual bars > 24 months.
- **KPI cards:** rolling next 3M / 6M / 12M from next full month.
- **Baseline period:** stored in `localStorage`, read in `useEffect` (avoids SSR mismatch). Default: last 3 complete months.
- **Override deletion:** clear cell → delete.
- **Income categories:** `Salary`, `Interest`, `Other Income`, `Income` — treated as cash inflows.

---

### Data model

**`ExpenseTransaction`** — add `oneOff?: boolean` (column M, sheet header `one_off`).

**`ExpenseProjections` sheet:**
```
month | category | amount
```

**`ExpenseProjectionOverride`:**
```ts
{ month: string; category: string; amount: number }
```

**`InflationSettings`:**
```ts
{ expenseInflationRate: number; incomeGrowthRate: number }
```

---

### Phase 1 — Types, Schema & Data Layer ✅

- [x] `oneOff` field on `ExpenseTransaction`; `ExpenseProjectionOverride` type
- [x] `EXPENSE_PROJECTIONS` constant
- [x] `getExpenses` / `appendExpenses` updated to col M; `updateExpenseOneOff` added
- [x] `getProjectionOverrides`, `upsertProjectionOverride`, `deleteProjectionOverride`
- [x] Provision route: `Expenses` headers updated; `ExpenseProjections` tab added
- [x] `/api/setup/migrate-projections` route
- [x] `setExpenseOneOffAction`, `saveProjectionOverrideAction`, `deleteProjectionOverrideAction`
- [x] One-off toggle in `TxRow` (ExpensesClient)
- [x] Migration script run — `ExpenseProjections` tab created in sheet

---

### Phase 2 — Core Projection Logic ✅

- [x] `src/lib/expenses/projections.ts`
  - `computeBaselineAverages(transactions, startMonth, endMonth)`
  - `generateProjections(baselineAverages, overrides, targetMonths, inflationSettings)`
  - `aggregateCashFlow(projections, incomeCategories)` → `{ next3M, next6M, next12M }`
- [x] Tests — missing months, one-off/excluded exclusions, overrides, inflation, rolling sums

---

### Phase 3 — UI Components ✅

- [x] `expenses/page.tsx` — fetch and pass `overrides`
- [x] `ExpensesClient` — add `'projections'` tab; hide month nav + KPI row on projections tab
- [x] `ProjectionsTab.tsx`
  - Baseline period controls + inflation controls
  - Rolling KPI cards (3M / 6M / 12M net cash flow)
  - Range selector + combined bar chart (solid actuals / faded projections; monthly/annual granularity)
  - Category matrix table with inline cell editor + override save/delete