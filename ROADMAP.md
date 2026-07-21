# Wellspring — Roadmap

Ideas and future work. **Do not design here** — just capture intent. When ready to build, promote to PLAN.md with a proper design.

---

## Up next (prioritised)

<!-- Move items here when you've decided what to build next, in order. -->

---

## Backlog

### Portfolio / accounting

- **Margin financing distorts asset value & returns** — Holdings/Cash/PortfolioHistory have no concept of debt. If a BUY is funded by margin (broker credit) rather than real cash, shares and `costBasisSGD` increase (`src/lib/portfolio.ts:58`) with nothing recorded to offset it — total portfolio value and "All-time Return" (gain ÷ cost basis) both read as if the position were fully equity-funded, when part of it is leveraged. Two candidate approaches, not yet designed:
  - (A) Reuse the existing multi-account Cash system — model a margin account as a "cash" account allowed to carry a negative balance (e.g. "IBKR Margin"); a margin-funded BUY debits it into more-negative territory, same mechanism as a cash-funded BUY. Net worth math self-corrects since cash accounts already sum into `totalValueSGD`. Cheapest to build, reuses everything, but semantically overloads "cash" with debt and doesn't track interest rate/accrual.
  - (B) First-class `Liabilities` sheet tab (`account | currency | balance | interest_rate_pct`), parallel to how HDB loan is already handled separately in the retirement engine. Enables an explicit Assets / Liabilities / Net Worth split on the dashboard and automatic interest accrual. More design work, more consistent with existing patterns (CPF/HDB already kept separate from Cash rather than folded in).
  - Either way, "All-time Return" should probably be reframed against net contributed capital (deposits − withdrawals, excluding margin proceeds) rather than raw cost basis, so leverage doesn't inflate the displayed return %.

### Retirement projections — post-v0.7 improvements
- **Gross salary from expense projections** — `netMonthlyCashFlow` and `grossMonthlySalary` are currently hardcoded defaults (3000/9000); wire them to the expense projection engine so actuals drive the retirement model.
- **CPF statement upload** — parse CPF annual statement PDF to auto-populate `CpfBalances` instead of manual entry.
- **Sensitivity analysis** — show a range band on the projection chart for ±2% return scenarios.

### Expense tracker — open items

**Parsing / categorization**
- **Exclude credit card bill payments from income** — `GIRO PAYMENT`, `AUTOPAY`, `BILL PAYMENT` on a credit card account should be `Transfer` (debit), not income; currently these flip to `credit` direction in the parsers which makes them appear as income
- **Richer built-in rules** — `Other` category still catches a lot; worth another pass to add common SG merchants to `BUILT_IN_RULES`
- **Post-import balance-continuity validation for OCR'd statements** — 2026-07-21 debugging found an HSBC composite import (`hsbc-composite.ts`) with a Tesseract-misread leading digit: an amount and a balance both silently lost a "9" (982.39 → 82.39; 9,684.25 → 684.25), which also cascaded into a wrong debit/credit direction downstream since direction is derived from comparing to the (corrupted) prior balance. Caught only by manually checking that each row's balance equals prior ± amount, then confirming against the actual PDF page image. Could be automated: after any OCR-sourced import, walk each account's rows in date order and flag any row where `balance != prevBalance ± amount` for manual review, instead of trusting OCR output silently.

**Transaction management**
- **Self-transfer exclusion** — transfers between own accounts (e.g. UOB One → UOB Lady's) are double-counted; Option A (user marks both legs as `Transfer (own)`, excluded from all stats) preferred over auto-detect
- **Exclusion rules (not just per-row toggle)** — today `excluded` is a one-at-a-time manual toggle per transaction; user wants a saved rule so matching transactions are auto-excluded from totals going forward, not just this once. Concrete example: the recurring `$1.00 OTHR` HSBC verification/link transfers (`HIB-...` reference codes, no stable merchant name — one per linked account, e.g. `SGV02056JGB61HMQ ... HIB- 363236X591802 ... OTHR`) currently have to be excluded by hand every import. Likely overlaps with self-transfer exclusion above — a general "exclusion rule" mechanism could subsume both. Design questions for later: rule matching probably needs more than the substring matching `ExpenseRules` uses today (these transactions don't share merchant text, just a pattern — `OTHR` + amount `$1.00`, or account + description regex), and rules should apply both retroactively (like `applyRuleToExisting` does for categories) and to future imports.

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
