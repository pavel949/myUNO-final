-- Clear the P3009 block: a migration that started but never finished.
--
-- Prisma refuses to apply ANY migration while a failed one sits in
-- _prisma_migrations, so this has to run before `prisma migrate deploy`.
-- Marking the row rolled back is what `prisma migrate resolve --rolled-back`
-- does; it is written as SQL here because the row can name a migration whose
-- folder no longer exists in the repo, which the CLI command cannot address.
--
-- Safe to run on every deploy: it touches only rows that both never finished
-- and were never rolled back, and it leaves anything started in the last hour
-- alone so a genuinely in-flight migration is never cut off.

DO $$
DECLARE
  repaired INTEGER := 0;
  stuck RECORD;
BEGIN
  IF to_regclass('public._prisma_migrations') IS NULL THEN
    RAISE NOTICE '[repair] no _prisma_migrations table yet - nothing to repair';
    RETURN;
  END IF;

  FOR stuck IN
    SELECT migration_name, started_at
    FROM "_prisma_migrations"
    WHERE finished_at IS NULL
      AND rolled_back_at IS NULL
      AND started_at < now() - interval '1 hour'
  LOOP
    RAISE NOTICE '[repair] stuck migration: % (started %)', stuck.migration_name, stuck.started_at;
  END LOOP;

  UPDATE "_prisma_migrations"
  SET rolled_back_at = now()
  WHERE finished_at IS NULL
    AND rolled_back_at IS NULL
    AND started_at < now() - interval '1 hour';

  GET DIAGNOSTICS repaired = ROW_COUNT;

  IF repaired = 0 THEN
    RAISE NOTICE '[repair] no stuck migrations found';
  ELSE
    RAISE NOTICE '[repair] marked % stuck migration(s) as rolled back', repaired;
  END IF;
END $$;
