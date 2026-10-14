import { describe, it, expect, beforeEach } from 'vitest';
import { db as prisma, resetDb, createIdentity } from '@/test/util';
import { clearVaultValue, listVaultEntries, revealVaultEntry, saveVaultEntry } from './secret-vault.service';
import type { Prisma, PrismaClient } from '@prisma/client';

// Wrap this call's clients rather than spying on the suite's shared Prisma delegates.
function withFailingAudit(client: PrismaClient): PrismaClient {
  const wrap = <T extends PrismaClient | Prisma.TransactionClient>(db: T): T => new Proxy(db, {
    get(target, property) {
      if (property === 'auditLog') return new Proxy(target.auditLog, {
        get(delegate, operation) {
          if (operation === 'create') return async () => { throw new Error('audit unavailable'); };
          return Reflect.get(delegate, operation);
        },
      });
      if (property === '$transaction') {
        return (work: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
          client.$transaction((tx) => work(wrap(tx)));
      }
      return Reflect.get(target, property);
    },
  });
  return wrap(client);
}

describe('Founder key register', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('rolls a save or clear back when its audit cannot be committed', async () => {
    const admin = await createIdentity({ isAdmin: true });
    const input = { name: 'ATOMIC_TEST', value: 'original-test-value', actorIdentityId: admin.id };
    await saveVaultEntry(prisma, input);
    const before = await prisma.secretVaultEntry.findUniqueOrThrow({ where: { name: input.name } });
    const failing = withFailingAudit(prisma);
    await expect(saveVaultEntry(failing, { ...input, value: 'replacement-test-value' })).rejects.toThrow('audit unavailable');
    expect(await prisma.secretVaultEntry.findUniqueOrThrow({ where: { name: input.name } })).toEqual(before);
    await expect(clearVaultValue(failing, input)).rejects.toThrow('audit unavailable');
    expect(await prisma.secretVaultEntry.findUniqueOrThrow({ where: { name: input.name } })).toEqual(before);
    await expect(revealVaultEntry(failing, input)).rejects.toThrow('audit unavailable');
  });

  it('stores the value encrypted, lists only the last four, and audits save and reveal without the value', async () => {
    const admin = await createIdentity({ isAdmin: true });
    await saveVaultEntry(prisma, { name: 'RESEND_API_KEY', value: 're_live_abcdef123456', actorIdentityId: admin.id });

    const raw = await prisma.secretVaultEntry.findUniqueOrThrow({ where: { name: 'RESEND_API_KEY' } });
    expect(raw.valueEncrypted).not.toContain('re_live');
    const listed = await listVaultEntries(prisma);
    expect(listed).toEqual([expect.objectContaining({ name: 'RESEND_API_KEY', hasValue: true, last4: '3456' })]);
    expect(JSON.stringify(listed)).not.toContain('re_live_abcdef');

    expect(await revealVaultEntry(prisma, { name: 'RESEND_API_KEY', actorIdentityId: admin.id })).toBe('re_live_abcdef123456');

    const audit = await prisma.auditLog.findMany({ where: { entityType: 'SecretVaultEntry' } });
    expect(audit.map((a) => a.action).sort()).toEqual(['secret_vault:revealed', 'secret_vault:saved']);
    expect(JSON.stringify(audit)).not.toContain('abcdef');
  });

  it('shows no fragment for short values, keeps a note when the value is cleared, and rejects bad names', async () => {
    const admin = await createIdentity({ isAdmin: true });
    await saveVaultEntry(prisma, { name: 'SHORT', value: 'abc', notes: 'owner: Pavel', actorIdentityId: admin.id });
    expect((await listVaultEntries(prisma))[0].last4).toBe('');

    await clearVaultValue(prisma, { name: 'SHORT', actorIdentityId: admin.id });
    const [row] = await listVaultEntries(prisma);
    expect(row).toMatchObject({ hasValue: false, notes: 'owner: Pavel' });
    expect(await revealVaultEntry(prisma, { name: 'SHORT', actorIdentityId: admin.id })).toBeNull();

    await expect(saveVaultEntry(prisma, { name: 'bad name!', value: 'x', actorIdentityId: admin.id })).rejects.toThrow(/Invalid/);
  });
});
