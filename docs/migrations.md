# Database migrations — how they work and how they recovered

Plain-language note for the founder, plus the operational detail a builder needs.

## What a migration is

The database has a shape: which tables exist, which columns each one holds. A
migration is one numbered step that changes that shape. They are files in
`prisma/migrations/`, applied in order, and each one is recorded in the database
once it succeeds. Production runs `prisma migrate deploy`, which applies every
step not yet recorded.

Two rules follow from that, and both were broken:

1. **Order is the folder name.** Prisma sorts folder names as text, not as
   numbers, and applies them in that order.
2. **A step that fails stops everything.** Prisma refuses to apply any further
   migration until the failed one is resolved. That is error `P3009`.

## What went wrong

On 15 July 2026 a migration named `1_add_analytics_tables` tried to create the
analytics tables. They already existed — `0_init` creates them — so it failed
half-way and left a failure marker in the database.

From that moment every deployment failed on the same error, roughly thirty times
in a row. The marker pointed at a migration folder that had since been deleted
from the repository, so `prisma migrate resolve --rolled-back` could not address
it either: the command needs a migration it can find.

Six further migrations were written to clear the marker from inside a migration.
None could ever run — Prisma stops *before* applying anything when a failure is
recorded — and all six referenced columns that do not exist in Prisma's tracking
table (`migration`, `execution_time_ms`, `rolled_back`; the real names are
`migration_name`, `started_at`, `rolled_back_at`).

Underneath sat a second fault that nobody had seen. Because names sort as text,
`10_`, `11_` … `19_` sorted *before* `2_`, `3_` … `9_`. The August migrations ran
before `9_crm_foundation`, which creates the tables they depend on. Applying the
chain to a completely empty database failed too:

```
Applying migration `10_customer_lifecycle_and_asset_status`
ERROR: relation "crm_profile" does not exist
```

So deleting and recreating the database — the obvious remedy — would not have
helped. CI never caught it because CI applied the schema with `prisma db push`,
which skips migrations entirely.

### And a third fault, underneath both

Clearing the block let a deploy get further than it had since July, and it
surfaced the deepest problem: `type "NotificationType" does not exist`.

`0_init` was rewritten on 16 July — the commit is called "Fix broken migration
chain: squash to a single schema-true 0_init" — **after** it had already been
applied to the deployed database on 14 July. Prisma never re-applies a migration
it has already recorded, so the new content never reached that database. It
still holds the original 437-line schema, while the current `0_init` is 1789
lines. Thirty-nine tables and forty-eight enums that every later migration
depends on were simply absent.

That is also the origin of the whole incident: the migration files and the real
database diverged back in July, and `1_add_analytics_tables` was the first thing
to trip over the gap.

The fix is `20260716000000_align_init_baseline` — the difference between the two
`0_init` versions, generated with `prisma migrate diff` and then made
idempotent. Where the schema is already complete (a fresh database, CI) every
statement is a no-op; where it is not, it creates exactly what is missing. All
309 statements only add.

## What was changed

- **Names are timestamps now** (`20260719000001_…`), Prisma's own convention, so
  text order and intended order are the same thing.
- **The six repair migrations were deleted.** They never applied anywhere, and
  each created its own conflicting version of the analytics tables.
- **Two duplicate lifecycle migrations were replaced by one**, generated with
  `prisma migrate diff` so its column types, index names and foreign keys match
  `schema.prisma` exactly.
- **A repair step now runs before every deploy** —
  `scripts/repair-failed-migrations.mjs`, wired into `postinstall` and `build`.
  It clears a failure marker automatically, so a stuck migration can no longer
  block deployments for weeks. It also prints the migration state into the build
  log on every deploy.
- **CI applies migrations instead of pushing the schema**, and does it *before*
  the build. A chain that cannot apply from scratch now fails CI immediately.

## The repair step, precisely

`scripts/repair-failed-migrations.sql` marks rows in `_prisma_migrations` that
never finished as rolled back — which is exactly what
`prisma migrate resolve --rolled-back` does, written as SQL so it also reaches a
migration whose folder no longer exists.

It is deliberately narrow:

- only rows where `finished_at IS NULL` **and** `rolled_back_at IS NULL`;
- only rows older than two minutes, so a migration currently running is never
  cut off;
- it never drops a table, a column, or a row.

The window is two minutes rather than something longer for a reason worth
recording: a failed deploy leaves a fresh marker, so a long window would leave
the *next* deploy blocked by it — exactly the failure this script exists to end.
Two minutes comfortably outlasts a migration actually applying (well under a
second here), `migrate deploy` holds its own advisory lock while it works so
overlapping deploys serialise anyway, and Prisma runs each migration in a
transaction, so a failed one leaves no partial objects behind and is safe to
retry.

Without `DATABASE_URL` it prints why it is skipping and exits successfully, so
installs without a database still work.

Run it by hand with `npm run db:repair`.

## Verified, not assumed

Every claim above was checked against a real PostgreSQL 16 database:

| Check | Result |
| --- | --- |
| Old chain on an empty database | fails on `10_…` — `relation "crm_profile" does not exist` |
| New chain on an empty database | all 12 migrations apply |
| New chain vs `schema.prisma` | no difference, except the structures in Q31 |
| Production state reproduced (`0_init` + failure marker) | same `P3009`, same date, word for word |
| Repair, then deploy, against that database | marker cleared, 11 pending migrations applied |
| Repair and deploy run twice | no-op both times |
| Test suite on a migration-built vs `db push` database | identical results, so the chain changes no behaviour |

## No remaining difference

`statement_line_item` and the twelve `owner_statement` reporting columns existed
in the database but not in `schema.prisma`, so the application could not use
them. They were kept rather than dropped, because dropping them destroys
owner-reporting data, and the gap was raised as **Q31**.

The founder ruled in favour of the full reporting model, so the schema now
declares all of it and the two agree exactly: `prisma migrate diff` reports no
difference in either direction, and the reconciliation migration no longer drops
anything. What is still missing is the code on top — statement generation
writing those figures and their line items, and the endpoints that read them.
