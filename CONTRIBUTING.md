# Contributing

`CLAUDE.md` is the constitution — read it before the first change. This file is
the mechanics: how to get running, what the gates are, and what will get a pull
request sent back.

## Getting running

```bash
npm install
cp .env.example .env          # fill in DATABASE_URL and the secrets it names
npx prisma migrate deploy     # apply the migration chain
npm run db:seed               # staging seed: config, content, demo inventory
npm run dev
```

Two seeds, and the difference matters:

| Command | Seeds | Use on |
|---|---|---|
| `npm run db:seed` | config, content, **plus demo projects, units, providers, identities** | local and staging only |
| `npm run db:seed:registries` | config and content only | anywhere, including production |

Never run `db:seed` against production. Demo inventory on a live domain is
indistinguishable from real listings to a visitor.

## The gates

Every change ends green on all three. CI runs them; running them locally first is
faster than a round trip.

```bash
npm test          # vitest: unit, integration, component
npm run build     # also the typecheck — there is no separate script
npm run lint      # --max-warnings 0, so a warning fails
```

**Integration tests share one Postgres database and truncate between tests.** If
you see deadlocks or foreign-key violations that move around between runs, that
is connection-pool contention, not your code — cap the pool:

```bash
DATABASE_URL_TEST="postgresql://…/myuno_test?connection_limit=1" npm test
```

Do not run two suites against the same database at once, for the same reason.

## What gets a pull request sent back

- **A fix with no test that fails without it.** Write the test, watch it fail
  against the unfixed code, then fix it. A test that passes either way proves
  nothing.
- **Hardcoded user-facing text.** Every string is a content key (doc 05),
  rendered through `t()`, with a `needs_review` draft in the seed.
- **A business rule in code.** Commissions, fees, caps, SLAs, cancellation
  policy — all `config.get()` parameters (doc 04), registered in the same commit.
- **Invented UI.** Colours, type and components come from the design system
  (doc 06). Every list and screen ships empty, loading and error states.
- **A registry addition without its doc.** New event, notification, config
  parameter or content namespace updates docs 13/11/04/05 in the same commit, or
  the addition is invalid.
- **`prisma db push`.** Migration files only, forward-only, reviewed.
- **Scope creep.** One task per pull request, per `docs/16_build_plan.md`.

## Money, PII and scope rules

These are not style preferences — they are the reasons the platform is allowed to
operate:

- Amounts are **server-computed**. A client-sent total is never trusted. THB in
  satang integers.
- The **ledger is append-only**. Any write that records a money movement is
  paired with that movement in one transaction, or the two can disagree.
- **Never log PII**, never put it in analytics dimensions or URLs, never store
  card data. 🔒 fields are encrypted and their access is logged.
- **Scope is enforced in the query**, server-side, on every read and write.
  Hiding a control in the UI is not access control.
- **Never operate FX and never hold guest funds.** Deposits are provider
  pre-authorisations only. Both are licensing boundaries (AMLO, Bank of
  Thailand), not product choices.

## When something is missing

If a text, rule, field, flow step or component is not specified: **stop and ask.**
Log it in `docs/open_questions.md` and stop at that edge. A plausible guess in a
money or compliance path is worse than an unfinished feature, because it looks
finished.

## Branches and commits

Work on a branch, never directly on `main`. Write commit messages that explain
the *why* — the diff already shows the what. Name the task id (`T-0xx`) where one
applies. Open the pull request as a draft until the three gates are green.
