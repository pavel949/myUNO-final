import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { canAccessThread, getStatementThreadParticipants } from './statement-thread-access';
import { OWNER_VISIBLE_STATEMENT_STATUSES } from '@/modules/finance/statement-signoff.service';

const identities = [
  { id: 'historical-owner', isAdmin: false, status: 'active' },
  { id: 'new-owner', isAdmin: false, status: 'active' },
  { id: 'admin', isAdmin: true, status: 'active' },
  ...['nonfinance', 'foreign-unit', 'revoked-staff', 'finance-reader', 'demoted-admin', 'foreign-owner'].map(id => ({ id, isAdmin: false, status: 'active' })),
  { id: 'blocked-admin', isAdmin: true, status: 'blocked' },
];
let status: string;
let currentIdentities: typeof identities;
let db: PrismaClient;
beforeEach(() => {
  status = 'published'; currentIdentities = structuredClone(identities);
  db = {
    ownerStatement: { findFirst: vi.fn(async ({ where }: any) => where.id === 'statement-a' && where.status.in.includes(status)
      ? { ownerIdentityId: 'historical-owner', unit: { projectId: 'project-a' } } : null) },
    identity: { findMany: vi.fn(async ({ where }: any) => currentIdentities.filter(identity => identity.status === where.status && where.OR.some((condition: any) => condition.id === identity.id || condition.isAdmin === identity.isAdmin))) },
    thread: { findUnique: vi.fn(async () => ({ id: 'thread-a', contextType: 'statement', contextId: 'statement-a' })) },
    threadParticipant: { findMany: vi.fn(async () => currentIdentities.filter(identity => identity.status === 'active').map(identity => ({ identityId: identity.id, identity, participantRole: identity.id === 'historical-owner' ? 'owner' : identity.id.endsWith('admin') ? 'admin' : 'staff_ops' }))) },
  } as unknown as PrismaClient;
});

describe('statement conversations use live financial authority and immutable beneficiary', () => {
  it('derives only active admins and historical owner, not current property owner or operational staff', async () => {
    expect((await getStatementThreadParticipants(db, 'statement-a'))?.participantIdentityIds).toEqual(['historical-owner', 'admin']);
  });
  it.each(['nonfinance', 'foreign-unit', 'revoked-staff', 'finance-reader', 'demoted-admin', 'foreign-owner', 'new-owner', 'blocked-admin'])('denies a legacy participant: %s', async actor => {
    expect(await canAccessThread(db, 'thread-a', actor)).toBe(false);
  });
  it.each(OWNER_VISIBLE_STATEMENT_STATUSES)('preserves historical owner access to %s records after transfer/offboarding', async visibleStatus => {
    status = visibleStatus;
    expect(await canAccessThread(db, 'thread-a', 'historical-owner')).toBe(true);
    expect(await canAccessThread(db, 'thread-a', 'admin')).toBe(true);
  });
  it('rechecks admin demotion and identity suspension', async () => {
    expect(await canAccessThread(db, 'thread-a', 'admin')).toBe(true);
    currentIdentities.find(identity => identity.id === 'admin')!.isAdmin = false;
    expect(await canAccessThread(db, 'thread-a', 'admin')).toBe(false);
    currentIdentities.find(identity => identity.id === 'historical-owner')!.status = 'blocked';
    expect(await canAccessThread(db, 'thread-a', 'historical-owner')).toBe(false);
  });
  it('fails closed for a draft, missing statement or context', async () => {
    status = 'draft';
    expect(await canAccessThread(db, 'thread-a', 'historical-owner')).toBe(false);
    expect(await getStatementThreadParticipants(db, 'missing')).toBeNull();
    vi.mocked(db.thread.findUnique).mockResolvedValue({ id: 'thread-a', contextType: 'statement', contextId: null } as any);
    expect(await canAccessThread(db, 'thread-a', 'admin')).toBe(false);
  });
});
