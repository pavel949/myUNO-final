import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * The existing revocation column also identifies the credential/session generation.
 * One row-locked UPDATE makes every rotation strictly newer, even within the same
 * millisecond, under clock skew, or when concurrent requests arrive out of order.
 * No migration or new session table is needed.
 */
export async function advanceSessionGeneration(
  db: PrismaClient | Prisma.TransactionClient,
  identityId: string,
): Promise<Date> {
  const rows = await db.$queryRaw<{ sessionsValidFrom: Date }[]>`
    UPDATE identity SET sessions_valid_from = GREATEST(
      COALESCE(sessions_valid_from, TIMESTAMP '1970-01-01 00:00:00') + interval '1 millisecond',
      date_trunc('milliseconds', clock_timestamp() AT TIME ZONE 'UTC')
    )
    WHERE id = ${identityId}
    RETURNING sessions_valid_from AS "sessionsValidFrom"`;
  if (!rows[0]) throw new Error('Identity not found');
  return rows[0].sessionsValidFrom;
}
