# Standing Instructions

Instructions I give once and expect applied automatically. Edit this file between sessions — no need to repeat yourself in chat.

---

## Response style

- Keep responses short and direct. No trailing summaries ("I've now done X, Y, Z").
- No emojis.
- Reference code by `file:line` or markdown link — never just prose.

---

## Code behaviour

- Never add comments unless the WHY is non-obvious.
- No extra error handling for impossible cases.
- No new abstractions or refactors beyond the task scope.
- No backwards-compat shims for removed code.

---

## Workflow

- Before starting any non-trivial feature, confirm the approach in one sentence and wait for a go-ahead — don't jump straight to code.
- After completing a feature, update HANDOVER.md and CLAUDE.md if anything there is now stale.
- Archive completed or stale feature specs from `.kiro/specs/<feature>/` into `.kiro/specs/archive/<feature>/`.
- When proposing new features, check ROADMAP.md first and note if the idea is already tracked.

---

## Project-specific

- **Current Focus:** v0.8 in progress (2026-05-07). Phases 1–3, 5, and most of 6 not yet implemented. See HANDOVER.md "v0.8 In Progress" section for exact gap list before touching anything.
- **Annual Fees:** When displaying annual fees, group them by card/account to deduplicate GST items. Omit the specific amount and description; only show the card name and date to track waivers.
- **Expense Charts:** Keep the "Hide investment" filter alongside "Hide excluded" so the Investment category doesn't skew the visual overview.
