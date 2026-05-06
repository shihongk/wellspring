# Wellspring — Roadmap

Ideas and future work. **Do not design here** — just capture intent. When ready to build, promote to PLAN.md with a proper design.

---

## Up next (prioritised)

<!-- Move items here when you've decided what to build next, in order. -->

---

## Backlog

### Retirement projections — post-v0.7 improvements
- **Gross salary from expense projections** — `netMonthlyCashFlow` and `grossMonthlySalary` are currently hardcoded defaults (3000/9000); wire them to the expense projection engine so actuals drive the retirement model.
- **CPF statement upload** — parse CPF annual statement PDF to auto-populate `CpfBalances` instead of manual entry.
- **Sensitivity analysis** — show a range band on the projection chart for ±2% return scenarios.

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
