import type { Prisma, PrismaClient } from '@prisma/client';
import { decrypt, encrypt } from '@/lib/encryption';
import { SECRET_NAME_PATTERN } from '@/lib/secret-catalog';

/**
 * Founder's key register. Storage only — nothing at runtime reads these values.
 * The value is encrypted with lib/encryption; listings expose only `last4`.
 * Every write and every reveal is audited, and the audit data never carries
 * the value itself.
 *
 * Audit rows are written through the caller's `db` rather than `@/modules/audit`:
 * that module imports the prisma singleton, and pulling it into the config
 * barrel creates an import cycle that deadlocks every test which mocks
 * `@/lib/prisma` with a factory importing the test utilities.
 */

async function audit(
  db: Prisma.TransactionClient,
  actorIdentityId: string,
  action: string,
  name: string,
  data: Record<string, boolean>
) {
  await db.auditLog.create({
    data: { actorIdentityId, action, entityType: 'SecretVaultEntry', entityId: name, data },
  });
}

export interface VaultEntryView {
  name: string;
  hasValue: boolean;
  last4: string | null;
  notes: string | null;
  updatedAt: Date;
}

const MAX_VALUE_LENGTH = 4000;

function assertName(name: string) {
  if (!SECRET_NAME_PATTERN.test(name)) throw new Error('Invalid key name');
}

export async function listVaultEntries(db: PrismaClient): Promise<VaultEntryView[]> {
  const rows = await db.secretVaultEntry.findMany({ orderBy: { name: 'asc' } });
  return rows.map((r) => ({
    name: r.name,
    hasValue: Boolean(r.valueEncrypted),
    last4: r.last4,
    notes: r.notes,
    updatedAt: r.updatedAt,
  }));
}

export async function saveVaultEntry(
  db: PrismaClient,
  input: { name: string; value?: string | null; notes?: string | null; actorIdentityId: string }
): Promise<void> {
  assertName(input.name);
  const data: { valueEncrypted?: string; last4?: string; notes?: string | null; updatedByIdentityId: string } = {
    updatedByIdentityId: input.actorIdentityId,
  };
  if (typeof input.value === 'string' && input.value.length > 0) {
    if (input.value.length > MAX_VALUE_LENGTH) throw new Error('Value too long');
    data.valueEncrypted = encrypt(input.value);
    data.last4 = input.value.length >= 8 ? input.value.slice(-4) : '';
  }
  if (input.notes !== undefined) data.notes = input.notes ? input.notes.slice(0, 500) : null;
  await db.$transaction(async (tx) => {
    await tx.secretVaultEntry.upsert({
      where: { name: input.name },
      create: { name: input.name, ...data },
      update: data,
    });
    await audit(tx, input.actorIdentityId, 'secret_vault:saved', input.name, { valueChanged: typeof input.value === 'string' && input.value.length > 0 });
  });
}

export async function revealVaultEntry(
  db: PrismaClient,
  input: { name: string; actorIdentityId: string }
): Promise<string | null> {
  assertName(input.name);
  const row = await db.secretVaultEntry.findUnique({ where: { name: input.name } });
  await audit(db, input.actorIdentityId, 'secret_vault:revealed', input.name, { found: Boolean(row?.valueEncrypted) });
  return row?.valueEncrypted ? decrypt(row.valueEncrypted) : null;
}

export async function clearVaultValue(
  db: PrismaClient,
  input: { name: string; actorIdentityId: string }
): Promise<void> {
  assertName(input.name);
  await db.$transaction(async (tx) => {
    await tx.secretVaultEntry.updateMany({
      where: { name: input.name },
      data: { valueEncrypted: null, last4: null, updatedByIdentityId: input.actorIdentityId },
    });
    await audit(tx, input.actorIdentityId, 'secret_vault:cleared', input.name, {});
  });
}
