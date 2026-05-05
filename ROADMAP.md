# Wellspring — Roadmap

Ideas and future work. **Do not design here** — just capture intent. When ready to build, promote to PLAN.md with a proper design.

---

## Up next (prioritised)

<!-- Move items here when you've decided what to build next, in order. -->

---

## Backlog

### Wealth & Holistic Projections
- **CPF Integration:** Ability to upload and parse CPF statements (monthly contribution, ordinary/special/medisave balances).
- **Holistic Wealth Projections:** Combine cash flow projections (income/expenses) with portfolio holdings and CPF to project long-term net worth. Key inputs: projection horizon, CPF draw-down age, investment return assumption.

### Expense tracker — open items

**Parsing / categorization**
- **Exclude credit card bill payments from income** — `GIRO PAYMENT`, `AUTOPAY`, `BILL PAYMENT` on a credit card account should be `Transfer` (debit), not income; currently these flip to `credit` direction in the parsers which makes them appear as income
- **Richer built-in rules** — `Other` category still catches a lot; worth another pass to add common SG merchants to `BUILT_IN_RULES`

**Transaction management**
- **Self-transfer exclusion** — transfers between own accounts (e.g. UOB One → UOB Lady's) are double-counted; Option A (user marks both legs as `Transfer (own)`, excluded from all stats) preferred over auto-detect

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
