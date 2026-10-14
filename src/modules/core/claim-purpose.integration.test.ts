import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { db, resetDb, createIdentity } from '@/test/util';
import { claimIdentity } from './people.service';
import { GET as inspectClaim } from '@/app/api/auth/claim/[token]/route';

const proof = 'test-claim-purpose-proof';
const tokenHash = createHash('sha256').update(proof).digest('hex');

describe('claim proof purpose boundary', () => {
  beforeEach(async () => { await resetDb(); });

  it.each(['password_reset', 'email_verify'] as const)('does not use a %s proof for account activation', async (purpose) => {
    const identity = await createIdentity({ status: 'invited' });
    await db.oneTimeToken.create({ data: { identityId: identity.id, tokenHash, purpose, expiresAt: new Date(Date.now() + 60_000) } });
    await expect(claimIdentity(db, { tokenHash, password: 'NewPassword123' })).rejects.toThrow('Invalid or expired claim link');
    const response = await inspectClaim(new NextRequest(`http://localhost/api/auth/claim/${proof}`), { params: { token: proof } });
    expect(response.status).toBe(404);
    const after = await db.identity.findUniqueOrThrow({ where: { id: identity.id } });
    expect(after.status).toBe('invited');
    expect(after.hashedPassword).toBeNull();
    expect((await db.oneTimeToken.findFirstOrThrow({ where: { tokenHash } })).consumedAt).toBeNull();
  });

  it('continues to accept an account-claim proof', async () => {
    const identity = await createIdentity({ status: 'invited' });
    await db.oneTimeToken.create({ data: { identityId: identity.id, tokenHash, purpose: 'account_claim', expiresAt: new Date(Date.now() + 60_000) } });
    const response = await inspectClaim(new NextRequest(`http://localhost/api/auth/claim/${proof}`), { params: { token: proof } });
    expect(response.status).toBe(200);
    expect((await claimIdentity(db, { tokenHash, password: 'NewPassword123' })).status).toBe('active');
  });
});
