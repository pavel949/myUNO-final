# myUNO — Platform Build Kit

Starter repository for building the **myUNO** platform (the Ignatev Estate operating platform) with Claude Code.

## The idea in one line
The most powerful Claude model (**Fable**) writes the full documentation **once**; cheaper models (**Sonnet**, **Haiku**) build from it. Good documentation is the lever — the coding models never guess.

## The one rule
Single source of truth: **project → unit → identity → roles**. A person holds roles scoped to projects and units. Messaging, tickets, announcements, and services belong to a *person and their role*, not to any one feature.

## Three things you edit yourself, no developer
- **Texts** — every word a user sees, in RU / EN / TH, via an admin panel.
- **Business rules** — every commission, fee, cap, SLA, per project (e.g. the 10–15% management-company fee).
- **Look** — one design system that expands the myUNO brand.

## Steps
1. Put your old repos into `legacy/` (reference only — a parts bin, not the look).
2. Open in Claude Code, select **Fable**.
3. Paste the contents of `START_HERE_FABLE.md` as your first message.
4. Answer Fable's questions — including those it logs in `docs/open_questions.md`.
5. Let Fable write the docs into `docs/`, committing as it goes (documentation only).
6. Review; the task list is `docs/16_build_plan.md`.
7. Switch to **Sonnet/Haiku** and build from the plan, one task at a time.

## Guardrails
- **First loop only, first.** Owners + guests + services + guest→buyer signal, one project.
- **Legal no-go zones.** No operating FX; no holding guest funds/deposits without a license; TM30 within 24h; permitted-use per property; PII under PDPA.
- **Old code is a parts bin — not a foundation, not the look.**

## What's in this repo
`README.md` · `CLAUDE.md` · `START_HERE_FABLE.md` · `docs/business/` (model, positioning, user-journey audit) · `docs/brand/` · `docs/` (Fable's docs + `open_questions.md`) · `legacy/` · `.gitignore`
