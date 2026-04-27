# Wellspring — Roadmap

Ideas and future work. **Do not design here** — just capture intent. When ready to build, promote to PLAN.md with a proper design.

---

## Up next (prioritised)

<!-- Move items here when you've decided what to build next, in order. -->

---

## Backlog

### Expense tracker (major feature)

Dobin-style expense categorization: upload bank statements → auto-categorize → review → monthly/category breakdown.

**Core flow**
1. User uploads CSV/PDF bank statement
2. Parser extracts rows: date, description, amount, debit/credit
3. Claude API categorizes each transaction by merchant name (Food, Transport, Shopping, Healthcare, Entertainment, Travel, Income, etc.)
4. User reviews and can override categories
5. Transactions stored; viewable as monthly summary and category breakdown

**Design questions to resolve before building**
- Which banks to support first? DBS, OCBC, and UOB each export different CSV formats. PDF is harder (needs text extraction). Start with one bank's CSV only?
- Storage: add an `Expenses` tab to Google Sheets (simple, fits the pattern), or is it too much data? Sheets handles ~50k rows fine for personal use.
- Categories: fixed taxonomy or user-defined? Suggested set: Food & Drink, Transport, Groceries, Shopping, Healthcare, Entertainment, Travel, Utilities, Subscriptions, Income, Transfer, Other.
- Deduplication: if the same statement is uploaded twice, how to detect and skip already-imported rows?
- Income tracking: import credit rows too (salary, transfers), or expenses only?
- Does this live inside Wellspring (new nav section) or become a separate app?

**Technical unknowns**
- File upload in Next.js App Router — needs a route handler that accepts `multipart/form-data`; Vercel limits request body to 4.5MB on free tier (fine for CSVs, not PDFs)
- PDF parsing — `pdf-parse` or similar; results vary widely by bank's PDF layout; might need OCR fallback
- Claude API for categorization — batch transactions in one prompt; needs `ANTHROPIC_API_KEY` env var added
- Token cost estimate: ~200 transactions × ~20 tokens each = ~4k tokens per statement upload; negligible cost

**Minimum viable scope (to discuss)**
- DBS current account CSV only (simplest format to start)
- CSV upload only, no PDF
- Claude API batch categorization with fixed category list
- Google Sheets `Expenses` tab storage
- Read-only views: monthly total by category, transaction list with search/filter
- Manual category override per transaction

---

### Deployment
- **Vercel deployment** — ~~host the app publicly~~ ✅ done (v0.5)

### Data & holdings
- **Additional tickers** — expand beyond the 5 current equities
- **TSM split handling** — verify `computeGap` + recommendations still hold after any stock split

### UX
- **Transaction history filter** — filter `/transactions` by ticker; useful as the log grows
- **Plan schedule "next buy" highlight** — visually call out the next upcoming schedule month

### Quality
- **Property-based tests** — cover `computeGap`, `computeRecommendedUnits`, `groupByMonth` in `portfolio.ts`
- **Yahoo Finance `historical()` → `chart()` migration** — `historical()` is deprecated; non-breaking for now

---

## Explored / rejected

<!-- Log ideas that were considered and ruled out, and why. -->

---

## Notes on promoting ideas

When an item from Backlog is ready to design:
1. Move it to PLAN.md as a new version section with phases and a completion checklist.
2. Remove it from this file.
3. Update HANDOVER.md once the version ships.
