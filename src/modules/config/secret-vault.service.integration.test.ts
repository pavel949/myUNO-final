import { describe, it, expect, beforeEach } from 'vitest';
import { db as prisma, resetDb, createIdentity } from '@/test/util';
import { clearVaultValue, listVaultEntries, revealVaultEntry, saveVaultEntry } from './secret-vault.service';

describe('Founder key register', () => {
  beforeEach(async () => {
    await resetDb();
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
