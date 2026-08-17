<!--
  Keep this short and factual. The diff shows what changed; this explains why,
  and what you did to convince yourself it works.
-->

## What this changes

<!-- One or two sentences. Name the task id from docs/16_build_plan.md if there is one. -->

## Why

<!-- The problem being solved. Link the spec section, decision (D1–D10) or open
     question (Q…) that governs it. If this contradicts a locked decision, say so
     explicitly — that needs founder approval before the code lands. -->

## Verification

<!-- Not "tests pass" — say which ones, and what you ran them against. A fix
     without a test that fails before it is a fix that comes back. -->

- [ ] `npm test` — full suite green (state the count)
- [ ] `npm run build` — compiles
- [ ] `npm run lint` — clean (`--max-warnings 0`)
- [ ] New behaviour has a test that fails without the change
- [ ] Walked the affected flow in a browser (UI changes only)

## Registry updates

<!-- The registries are part of the change, not follow-up work. Tick what applies,
     delete what does not. -->

- [ ] New config parameters → `docs/04_configuration.md`
- [ ] New content keys → `docs/05_content_i18n.md` + content seed (`needs_review`)
- [ ] New events → `docs/13_analytics.md`
- [ ] New notifications → `docs/11_notifications.md`
- [ ] Schema change → migration file committed (never `db push`)

## Money, PII and compliance

<!-- Delete this section only if the change touches none of it. -->

- [ ] Amounts are server-computed; no client-sent total is trusted
- [ ] Ledger writes are append-only and paired atomically with what they record
- [ ] No PII in logs, analytics dimensions, or URLs
- [ ] 🔒 fields stay encrypted; access is logged
- [ ] Role scoping enforced server-side in the query, not just in the UI

## Risks and follow-ups

<!-- What could this break, and what did you deliberately leave undone?
     Known-incomplete is fine; silently-incomplete is not. -->
