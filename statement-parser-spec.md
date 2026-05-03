# Bank Statement Parser — Format Specification

## Overview

This document describes the format and structure of 7 bank/credit card statement PDFs used as input for a transaction parser. All statements are from Singapore banks. The goal is to parse each into a unified transaction list.

**Source folder:** `Financial Planning/`

**Files:**

| File | Bank | Type | Text Layer |
|---|---|---|---|
| `eStatement.pdf` | UOB | Savings account (Lady's Savings A/c) | ✅ |
| `eStatement 2.pdf` | UOB | Current account (One Account) | ✅ |
| `eStatement 3.pdf` | UOB | Credit cards (3 cards, combined) | ✅ |
| `eStatement_Apr2026.pdf` | Citibank | Credit cards (2 cards, combined) | ✅ |
| `2026-04-06_Statement.pdf` | HSBC | Premier credit card | ❌ OCR needed |
| `2026-04-28_Statement.pdf` | HSBC | Visa Revolution credit card | ❌ OCR needed |
| `2026-04-07_Statement.pdf` | HSBC | Premier composite (savings + securities) | ❌ OCR needed |

---

## Unified Output Schema

Every parsed transaction should produce one row with these fields:

```
date          # transaction date (YYYY-MM-DD)
post_date     # posting date (YYYY-MM-DD) — same as date if only one date col
description   # cleaned merchant/description string
amount        # float, always positive
direction     # "debit" or "credit"
balance       # float or None (credit cards have no running balance)
account       # e.g. "UOB Lady's Savings", "UOB Preferred Visa", "Citi Rewards"
source_file   # filename
```

---

## Statement 1 & 2 — UOB Deposit Accounts

**Files:** `eStatement.pdf` (Lady's Savings A/c), `eStatement 2.pdf` (One Account)

### Extraction method
Use `pdfplumber` or `pdftotext`. Text layer is clean.

### Table structure
Columns in order: **Date · Description · Withdrawals SGD · Deposits SGD · Balance SGD**

### Date format
`DD MMM` — no year. e.g. `09 Mar`. Infer year from the statement period header:
```
Period: 01 Mar 2026 to 31 Mar 2026
```

### Extracted text layout
Each field appears on its own line. A debit row looks like:
```
09 Mar

[MERCHANT]
xxxxxx0065

[AMOUNT]

[BALANCE]
```
A credit row looks like:
```
02 Mar

Inward Credit-FAST
OTHR Other
[SENDER]
[REF]

[AMOUNT]

[BALANCE]
```

**Row-start anchor:** A line matching `^\d{2} [A-Z][a-z]{2}$` (e.g. `09 Mar`).

**Determining debit vs credit:**
- The amount appears in either the Withdrawals or Deposits column. Since columns collapse in plain text, use the balance delta: if `balance < prev_balance` → debit; if `balance > prev_balance` → credit.
- Alternatively, use layout-aware extraction (pdfplumber bounding boxes) to determine which column the amount falls under.

### What to skip
- Line matching `BALANCE B/F` → opening balance row, skip
- Page-end orphan numbers: bare floats with no date anchor that appear after the UOB footer line (`United Overseas Bank Limited • 80 Raffles Place...`) — these are column subtotals, skip
- Pages 1–2 of `eStatement 2.pdf`: account overview, FX+ currency rows, ONE Account Interest Overview section — skip everything before `Account Transaction Details`
- Line matching `One Bonus Interest` with no associated amount on the same logical row — skip or handle separately

### Multi-page
Column header repeats each page. Account name line reads e.g.:
```
One Account 779-358-006-5 (continued)
```
Use this to confirm account context across pages.

---

## Statement 3 — UOB Credit Cards

**File:** `eStatement 3.pdf`

Three cards in one PDF: **Preferred Visa**, **UOB One Card**, **Lady's Card**

### Extraction method
`pdfplumber` or `pdftotext`. Text layer is clean.

### Table structure
Columns: **Post Date · Trans Date · Description of Transaction · Transaction Amount SGD**

No running balance column.

### Date format
`DD MMM` for both dates. e.g. `02 APR`, `14 MAR`.

### Card section boundaries
Each card section starts with a header block:
```
[CARD NAME]
[CARD NUMBER] KHOR SHIHONG
Post       Trans
Date       Date       Description of Transaction    Transaction Amount SGD
```
Detect card name from lines like `PREFERRED VISA`, `UOB ONE CARD`, `LADY'S CARD`.

Sections end with:
```
SUB TOTAL        [AMOUNT]
TOTAL BALANCE FOR [CARD NAME]    [AMOUNT]
```
followed by a long dash separator line.

### Extracted text layout
```
16 MAR          ← Post Date

14 MAR          ← Trans Date

[MERCHANT] SINGAPORE    ← Description line 1
Ref No. : 74541836073...  ← Reference (skip this line)

[AMOUNT]        ← Transaction amount
```

**Row-start anchor:** Line matching `^\d{2} [A-Z]{3}$` (Post Date).

### Debits vs credits
All purchases are positive. Payments appear as a `GIRO PAYMENT` row with a positive amount — treat as credit (direction = "credit"). The `PREVIOUS BALANCE` row shows the prior-period balance with a `CR` suffix — skip this row entirely.

```
PREVIOUS BALANCE
174.45 CR        ← skip
02 APR
02 APR
GIRO PAYMENT     ← direction = credit
```

### What to skip
- `PREVIOUS BALANCE` row (and the `[AMOUNT] CR` line below it)
- `GIRO PAYMENT` row — record as credit if tracking payments, else skip
- `Ref No. :` lines — strip from description
- `SUB TOTAL` and `TOTAL BALANCE FOR...` rows
- Long dash separator lines (`---...---`)
- Statement Summary / card summary table on page 1 (before the first card section)

### Multi-page
Header repeats with `(continued)` suffix on card name line.

---

## Statement 4 — Citibank Credit Cards

**File:** `eStatement_Apr2026.pdf`

Two cards: **Citi Rewards World Mastercard**, **Citi Cash Back Plus Mastercard**

### Extraction method
`pdfplumber` or `pdftotext`. Text layer is clean.

### Table structure
Columns: **DATE · DESCRIPTION · AMOUNT (SGD)**

Single date column (post date only). No running balance.

### Date format
`DD MMM`. e.g. `12 MAR`, `06 APR`.

### Card section boundaries
Each card section starts with:
```
CITI REWARDS WORLD MASTERCARD [CARD NUMBER]
...
DATE    DESCRIPTION    AMOUNT (SGD)
TRANSACTIONS FOR CITI REWARDS WORLD MASTERCARD
ALL TRANSACTIONS BILLED IN SINGAPORE DOLLARS
```
Ends with:
```
SUB-TOTAL:    [AMOUNT]
GRAND TOTAL   [AMOUNT]
```

### Extracted text layout
```
12 MAR
[MERCHANT]
[CITY/COUNTRY]    ← location line, appears between description and amount
[AMOUNT]

27 MAR
[MERCHANT]        ← foreign transaction
[CITY] [COUNTRY]
FOREIGN AMOUNT U.S. DOLLAR 69.95   ← original currency line
[SGD AMOUNT]
```

**Row-start anchor:** Line matching `^\d{2} [A-Z]{3}$`.

After each description, one or more location/country lines appear before the amount. Strip these (they're not part of the description). Detect them as lines matching country codes (`SG`, `US`, `CA`) or city names that appear before a float.

### Debits vs credits
Single column. Credits (payments) are in parentheses: `(990.27)` → direction = "credit", amount = 990.27. All other amounts → direction = "debit".

### What to skip
- `BALANCE PREVIOUS STATEMENT` and `FAST INCOMING PAYMENT` rows (prior period entries)
- `SUB-TOTAL:` and `GRAND TOTAL` rows
- `TRANSACTIONS FOR [CARD]` and `ALL TRANSACTIONS BILLED IN SINGAPORE DOLLARS` subheaders
- Bill summary / payment slip section (pages 1–2, before `DATE DESCRIPTION AMOUNT` header)
- Rewards points summary section (after `GRAND TOTAL`)
- `CCY CONVERSION FEE` rows — include or exclude based on requirements

---

## Statement 5 & 6 — HSBC Credit Cards

**Files:** `2026-04-06_Statement.pdf` (HSBC Premier), `2026-04-28_Statement.pdf` (HSBC Visa Revolution)

### Extraction method
**No text layer — OCR required.** Use `pytesseract` + `pdf2image` (or `pdfplumber` with image fallback).

Recommended: `pdftoppm -r 150` to render pages, then `tesseract` per page.

### Table structure
Columns: **POST DATE · TRAN DATE · DESCRIPTION · AMOUNT(SGD)**

### Date format
`DD MMM` for both dates. e.g. `31 Mar`, `04 Apr`.

### Extracted text layout (after OCR)
OCR from page 1 interleaves the transaction table (left side) with the account summary box (right side). Example:
```
POST TRAN    ACCOUNT SUMMARY SGD
DATE DATE DESCRIPTION AMOUNT(SGD)  Previous Statement Balance  221.95
                                   Payment                     221.95CR
31Mar 28Mar  [MERCHANT] [LOC]  20.00  Purchases & Debits       183.67
```

**Handling:** Detect and discard the right-side summary box content. Anchor on the transaction table using `POST` / `TRAN` / `DATE` header. The summary box content matches labels like `Previous Statement Balance`, `Payment`, `Purchases & Debits`, `GST Charges`, `Total Account Balance`.

Page 2 is clean — no sidebar.

### Debits vs credits
Single column. Credits have `CR` suffix directly appended: `224.95CR`. Strip `CR`, set direction = "credit". Plain floats → direction = "debit".

### What to skip
- `Previous Statement Balance` row
- `Total Due` row
- Account summary sidebar content (right side of page 1)
- Rewards summary section (`REWARDS SUMMARY`, points rows)
- Credit limit section (`CREDIT LIMIT AND INTEREST RATES`)

---

## Statement 7 — HSBC Premier Composite Statement

**File:** `2026-04-07_Statement.pdf`

Savings account + securities in one PDF. **Only parse the savings account section.**

### Extraction method
**No text layer — OCR required.** Same approach as statements 5 & 6.

### Table structure (savings section only)
Columns: **Date · Transaction Details · Deposits · Withdrawals · Balance (DR=Debit)**

### Date format
`DDMMMYYYY` concatenated, no spaces. e.g. `19Mar2026`. Parse with: `datetime.strptime(s, "%d%b%Y")`.

### Row-start anchor
Line matching `^\d{2}[A-Z][a-z]{2}\d{4}$` (e.g. `19Mar2026`).

### Transaction details (multi-line)
Each transaction's details span many lines:
```
19Mar2026
SGV19036MB76M5VK
HIB-19232X980213
Khor Shihong
7793580065
19232X980213
OTHR
REF IB12-57316
[AMOUNT]    [BALANCE]
```
Collapse all lines between two date anchors into a single description string. Take the last two floats on the last line as (withdrawal_or_deposit, balance).

### Debits vs credits
Separate columns — use balance delta to determine direction, same as UOB deposit accounts.

### What to skip
- `BALANCE BROUGHT FORWARD` row
- Pages 1 and the portfolio summary section ("Your Portfolio at a Glance", "Summary of Your Portfolio")
- Securities & Unit Trusts section (starts with `SECURITIES & UNIT TRUSTS` header) — skip entirely
- `TOTAL RELATIONSHIP BALANCE` footnote
- `END OF STATEMENT` marker

---

## Suggested Implementation Notes

### Library stack
```
pdfplumber      # text extraction for UOB + Citi PDFs
pdf2image       # render image PDFs (HSBC) — wraps pdftoppm
pytesseract     # OCR for HSBC image PDFs
pandas          # output to DataFrame / CSV
openpyxl        # output to Excel if needed
```

### Parser structure
- One parser class/function per statement type
- Each returns a `List[dict]` matching the unified output schema
- A dispatcher detects statement type from filename or content (e.g. presence of "UOB", "Citibank", "HSBC" in first-page text)
- Final step: concatenate all lists → single DataFrame → export

### Statement type detection
| Signal | Type |
|---|---|
| `customer.service@uobgroup.com` in text | UOB deposit account |
| `card.centre@uobgroup.com` in text | UOB credit cards |
| `Citibank Singapore` in text | Citibank credit cards |
| `HSBC` + `REVOLUTION` in OCR | HSBC Revolution CC |
| `HSBC` + `PREMIER` + `COMPOSITE` in OCR | HSBC Composite |
| `HSBC` + `PREMIER` (no composite) in OCR | HSBC Premier CC |

### Date normalisation
All dates should be resolved to `YYYY-MM-DD`. For statements with `DD MMM` only, use the statement period year. Handle year-boundary edge cases (e.g. a December transaction in a January statement).
