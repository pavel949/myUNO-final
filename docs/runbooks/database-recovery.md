# Database recovery and reproducibility

How to rebuild this system's database from the repository, prove a backup can
actually be restored, and keep the datamodel honest about what the database
contains.

## The failure this exists to prevent

In September 2026 the canonical v3 application layer was reverted (#71, 130
files, 8,368 deletions) and six later commits restored **only** the migrations.
The result was a system split in half: the database half shipped, the
application half did not.

Nothing failed. The build was green, 2,147 tests passed, production stayed
READY. The repository had simply stopped being able to describe its own
database — `schema.prisma` knew nine fewer tables than the migration chain
creates — and no check existed that could notice.

Three consequences, all of which were true at once and none of which were
visible:

1. **The chain could not replay.** `20260912000000_secure_canonical_v3_operational_tables`
   REVOKEs Supabase's Data API grants from `anon` and `authenticated`. On a
   database without those roles the statement aborts with
   `role "anon" does not exist`. That blocked CI, fresh provisioning, and
   restoring a backup into a scratch database.
2. **`prisma migrate diff` proposed destruction.** Against the reverted
   datamodel it generated 9 `DROP TABLE` and 20 `DROP COLUMN` statements. Any
   `prisma migrate dev` would have offered to delete production's v3 schema.
3. **Types were lying.** `service_order.project_id` had become nullable in the
   database while the datamodel still said non-null, so authorization and money
   paths were typed against a shape the database no longer guaranteed.

## The guard

```
npm run db:verify
```

Creates a throwaway database beside the one in `DATABASE_URL`, and runs five
gates. It never touches the database named in `DATABASE_URL`, and it needs no
production credentials.

| Gate | What it proves |
|---|---|
| migration replay | The whole chain applies to an empty database — what a new environment or a restore drill does |
| data api closed | The v3 operational tables are unreachable by `anon`/`authenticated` after the chain runs |
| row level security | RLS is enabled on those tables |
| schema.prisma matches migrations | Zero drift between the datamodel and what the chain builds |
| replay is idempotent | A second `migrate deploy` changes nothing |

It runs in CI on every pull request. Run it locally before any schema change.

### When the drift gate fails

It means `schema.prisma` and `prisma/migrations/` disagree. Decide which is
right before touching either:

- **The migration is right** (the usual case — it is what production ran).
  Reconcile the datamodel *towards* the database. Introspect a database built
  from the chain, then hand-merge. Do not commit `prisma db pull` output
  wholesale: it reorders the file, drops comments and renames relations —
  ~3,700 changed lines for a ~120-line change.
- **The datamodel is right.** Write a new migration. Never edit an applied one.

Never resolve drift by deleting a table because `src/` does not reference it.
A dormant model is inert; an unknown table makes every future diff propose
dropping it.

## Supabase roles on plain PostgreSQL

Production is Supabase, which owns `anon`, `authenticated` and `service_role`
and grants new public tables to them by default — which is why the Data API
closing migration exists at all.

`scripts/sql/supabase-compat-roles.sql` recreates those roles *and their
default grants* on a plain PostgreSQL server. It is applied to test, CI and
scratch databases, never to production.

It deliberately grants before the chain revokes. Empty roles would make the
REVOKE a no-op, and the security gate would pass while proving nothing.

**The already-applied migration is left byte-identical.** The roles are an
environment fixture, not a schema concern — a `pg_dump` of production carries
`GRANT ... TO anon` statements, so any restore into plain PostgreSQL needs them
present regardless of what the migration chain does.

## Restoring a backup into a scratch database

```bash
# 1. Dump production. Use a read-only role, never the application's credential:
#      CREATE ROLE backup_reader LOGIN PASSWORD '<generated>';
#      GRANT pg_read_all_data TO backup_reader;
pg_dump "$BACKUP_DATABASE_URL" --no-owner --no-privileges -Fc -f prod.dump

# 2. Restore into a scratch database — never over production.
createdb restore_drill
psql -d restore_drill -f scripts/sql/supabase-compat-roles.sql
pg_restore -d restore_drill --no-owner --no-privileges prod.dump

# 3. Verify it is intact, not merely that the file exists.
psql -d restore_drill -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
```

`.github/workflows/backup.yml` automates exactly this nightly and fails the run
if the dump cannot be restored. It needs two repository secrets,
`BACKUP_DATABASE_URL` and `BACKUP_PASSPHRASE`; without them it cannot run.

## Two ledgers, not one

This project has **two** migration ledgers, and they do not agree:

- `_prisma_migrations` — what Prisma has applied.
- `supabase_migrations.schema_migrations` — what the Supabase CLI has applied.

Several canonical v3 migrations show `applied_steps_count = 0` in
`_prisma_migrations`: they were marked resolved rather than executed, because
the SQL was applied through the Supabase path instead. That is a workable
pattern, but it means **a migration file can be recorded as applied without its
SQL ever having run through Prisma** — which is precisely how the `anon` bug
reached `main` without anyone hitting it.

If you apply schema through the Supabase path, run `npm run db:verify` on the
branch afterwards. It executes the file for real.
