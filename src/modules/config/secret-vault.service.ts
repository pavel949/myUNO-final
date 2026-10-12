import type { PrismaClient } from '@prisma/client';
import { decrypt, encrypt } from '@/lib/encryption';
import { SECRET_NAME_PATTERN } from '@/lib/secret-catalog';
import { logAudit } from '@/modules/audit';

/**
 * Founder's key register. Storage only — nothing at runtime reads these values.
 * The value is encrypted with lib/encryption; listings expose only `last4`.
 * Every write and every reveal is audited, and the audit data never carries
 * the value itself.
 */

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
  await db.secretVaultEntry.upsert({
    where: { name: input.name },
    create: { name: input.name, ...data },
    update: data,
  });
  await logAudit({
    actorIdentityId: input.actorIdentityId,
    action: 'secret_vault:saved',
    entityType: 'SecretVaultEntry',
    entityId: input.name,
    data: { valueChanged: typeof input.value === 'string' && input.value.length > 0 },
  });
}

export async function revealVaultEntry(
  db: PrismaClient,
  input: { name: string; actorIdentityId: string }
): Promise<string | null> {
  assertName(input.name);
  const row = await db.secretVaultEntry.findUnique({ where: { name: input.name } });
  await logAudit({
    actorIdentityId: input.actorIdentityId,
    action: 'secret_vault:revealed',
    entityType: 'SecretVaultEntry',
    entityId: input.name,
    data: { found: Boolean(row?.valueEncrypted) },
  });
  return row?.valueEncrypted ? decrypt(row.valueEncrypted) : null;
}

export async function clearVaultValue(
  db: PrismaClient,
  input: { name: string; actorIdentityId: string }
): Promise<void> {
  assertName(input.name);
  await db.secretVaultEntry.updateMany({
    where: { name: input.name },
    data: { valueEncrypted: null, last4: null, updatedByIdentityId: input.actorIdentityId },
  });
  await logAudit({
    actorIdentityId: input.actorIdentityId,
    action: 'secret_vault:cleared',
    entityType: 'SecretVaultEntry',
    entityId: input.name,
    data: {},
  });
}
