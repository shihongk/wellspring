# Wellspring — Roadmap

Ideas and future work. **Do not design here** — just capture intent. When ready to build, promote to PLAN.md with a proper design.

---

## Up next (prioritised)

1. **v0.10 — margin financing** — direction agreed (negative-balance margin cash account + return reframed on net contributed capital); needs a design pass before build. See `PLAN.md` § v0.9 → "v0.10 (parked)".

---

## Backlog

### Portfolio / accounting

### Retirement projections — post-v0.7 improvements
- **Sensitivity analysis** — show a range band on the projection chart for ±2% return scenarios.

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

- **CPF statement upload** (removed 2026-07-21) — was already shipped in v0.7/v0.8: `src/lib/expenses/parsers/cpf-annual.ts` + pipeline auto-populate `CpfBalances` and `CpfTransactions`. Stale backlog entry, not a rejection.

---

## Notes on promoting ideas

When an item from Backlog is ready to design:
1. Move it to PLAN.md as a new version section with phases and a completion checklist.
2. Remove it from this file.
3. Update HANDOVER.md once the version ships.
