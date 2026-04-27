# Wellspring — Roadmap

Ideas and future work. **Do not design here** — just capture intent. When ready to build, promote to PLAN.md with a proper design.

---

## Up next (prioritised)

<!-- Move items here when you've decided what to build next, in order. -->

---

## Backlog

### Deployment
- **Vercel deployment** — host the app publicly; configure env vars via Vercel dashboard (no `.env.local` needed)

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
