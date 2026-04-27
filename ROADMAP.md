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

**Decisions made**
- Build inside Wellspring (not a separate project) — same codebase, nav, auth, deploy. "Merge later" is a trap.
- Storage: Google Sheets — personal volume (~1–2k rows/year) is well within Sheets limits; no new service or schema migrations needed. Reassess if it feels slow after real usage.
- CSV only, no PDF — PDF parsing is fragile and bank-dependent; CSV is clean and predictable.
- Start with one bank's CSV format first (DBS or whichever the user actually uses).
- Categorization via Claude API — batch merchant names in one prompt per upload; add `ANTHROPIC_API_KEY` to Vercel env vars when ready.
- Build into `src/app/expenses/` and `src/components/expenses/` — no overlap with existing portfolio code.

**Still to decide before designing**
- Which bank's CSV to start with? (Determines the exact column layout and parser logic.)
- Categories: use a fixed taxonomy for now (Food & Drink, Transport, Groceries, Shopping, Healthcare, Entertainment, Travel, Utilities, Subscriptions, Income, Transfer, Other) — user-defined categories later.
- Import credits (income/transfers) or debit transactions only?
- Deduplication strategy: hash of (date + description + amount) to detect duplicate uploads?

**Technical notes**
- File upload: Next.js App Router route handler accepting `multipart/form-data`; Vercel free tier limits body to 4.5MB (fine for CSVs)
- Claude API cost: ~200 transactions × ~20 tokens = ~4k tokens per upload; negligible
- New Sheets tabs needed: `Expenses` (one row per transaction) and possibly `ExpenseCategories` (user overrides / merchant→category rules)
- `ANTHROPIC_API_KEY` env var needed in Vercel and `.env.local` when building this

**Minimum viable scope**
- Upload CSV → parse → Claude categorizes → user reviews/overrides → saved to Sheets
- Views: monthly total by category (bar/pie), transaction list with filter by month/category
- Manual override per transaction, persisted back to Sheets

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
