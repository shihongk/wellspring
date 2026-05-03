# Wellspring — Roadmap

Ideas and future work. **Do not design here** — just capture intent. When ready to build, promote to PLAN.md with a proper design.

---

## Up next (prioritised)

<!-- Move items here when you've decided what to build next, in order. -->

---

## Backlog

### Historical & Predictive Projections
- **Projection Logic:** Calculate future projections based on simple historical averages.
  - Category-specific: Project both expenses and income at the category level.
  - Configurable Period: Custom month picker allowing selection of complete past months to form the baseline average (avoiding incomplete current months).
  - Exclusions: Allow specific transactions or categories to be excluded from the projection calculation.
- **Manual Adjustments:** Provide the ability to manually override/adjust the calculated projection for specific categories/months. Store these manual overrides in a new Google Sheets tab (e.g., `ExpenseProjections`).
- **Visualization & UI:**
  - Create a dedicated "Projections" tab within the existing Expenses view.
  - Use bar charts to clearly differentiate between historical data and projected data.
  - Summarize projected quarterly, 6-monthly, and annual expenditure patterns and net cash flow (since income is included).

### Wealth & Holistic Projections
- **CPF Integration:** Ability to upload and parse CPF statements.
- **Holistic Wealth Projections:** Combine cash flow projections (income/expenses) with investment/holdings data and CPF to create long-term wealth projections.

### Expense tracker — v0.5.x improvements

These came out of first real-data use. Group them into a patch release when ready.

**Display**
- **Number formatting** — amounts should display as `1,000.00` not `1000.00` throughout the expenses UI
- **Income panel** — credit transactions are currently hidden from the breakdown; add a separate collapsible panel within `/expenses` to show income/credits for the month (e.g. salary, PayNow received, interest)
- **Annual fee flag** — detect `ANNUAL MEMBERSHIP FEE` (or similar) on any credit card transaction; surface these in a dedicated notice/panel so the user remembers to call the bank and request a waiver

**Categorization**
- **Richer built-in rules** — `Other` category is too large; recommended additions to `BUILT_IN_RULES`:
  - `GRAB FOOD`, `DELIVEROO`, `FOODPANDA`, `MCDONALDS`, `KFC`, `STARBUCKS`, `KOPITIAM`, `HAWKER` → `Food & Drink`
  - `COMFORT`, `GOJEK`, `TADA`, `BUS`, `MRT`, `EZ-LINK`, `LTA`, `SMRT` → `Transport`
  - `GUARDIAN`, `WATSONS`, `UNITY`, `NTUC PHARMACY`, `RAFFLES MEDICAL`, `POLYCLINIC` → `Healthcare`
  - `SHAW`, `CATHAY`, `GV`, `GOLDEN VILLAGE`, `NETFLIX`, `SPOTIFY`, `DISNEY`, `APPLE.COM/BILL` → `Entertainment`
  - `IKEA`, `COURTS`, `HARVEY NORMAN`, `CHALLENGER`, `DYSON` → `Shopping`
  - `NTUC`, `COLD STORAGE`, `FAIRPRICE`, `GIANT`, `SHENG SIONG`, `PRIME SUPERMARKET` → `Groceries`
  - `SINGTEL`, `STARHUB`, `M1`, `CIRCLES`, `SP GROUP`, `PUB` → `Utilities`
  - `GOOGLE ONE`, `ICLOUD`, `DROPBOX`, `ADOBE`, `GITHUB`, `CHATGPT`, `CLAUDE` → `Subscriptions`
  - `AGODA`, `BOOKING.COM`, `EXPEDIA`, `AIRBNB`, `SINGAPORE AIRLINES`, `SCOOT`, `CHANGI` → `Travel`
- **New category: `Investment`** — add to `EXPENSE_CATEGORIES`; for recurring outward transfers to investment platforms (Tiger Brokers, Moomoo, Interactive Brokers, etc.); user can assign via rule or manually
- **Exclude credit card bill payments from income** — `GIRO PAYMENT`, `AUTOPAY`, `BILL PAYMENT` on a credit card account should be `Transfer` (debit), not income; currently these flip to `credit` direction in the parsers which makes them appear as income

**Transaction management**
- **Self-transfer exclusion** — transfers between own accounts (e.g. UOB One → UOB Lady's) are double-counted (debit on one, credit on the other); design options:
  - Option A: user marks both legs as `Transfer (own)` and they are excluded from all stats
  - Option B: auto-detect same-amount same-date debit+credit pair across accounts
  - Lean towards Option A (user-controlled, safer for ambiguous amounts)
- **Exclusion flag** — individual transactions can be flagged as excluded (e.g. wife transferring money in); excluded rows still stored in sheet but omitted from breakdown totals and charts; UI needs a toggle per row and a "show excluded" option
- **Vendor rule generalization** — when a transaction has a verbose reference (e.g. `NETS Debit-Consumer WESTERN12157400`), allow user to define a prefix/substring rule that maps all matching future transactions to a category; stored in `ExpenseRules` sheet (same as today) — just need UI to make rule creation easy from a transaction row (e.g. "Create rule from this" button that pre-fills merchant with the common prefix)

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
