import { describe, it, expect, beforeEach } from 'vitest';
import { db as prisma, resetDb, createIdentity } from '@/test/util';
import {
  searchIdentities,
  grantRole,
  revokeRole,
  blockIdentity,
  unblockIdentity,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  generateClaimLink,
  claimIdentity,
  getIdentityRoles,
  listOrganizations,
} from './people.service';
import crypto from 'crypto';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

describe('People & roles service', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('searchIdentities', () => {
    it('searches by email', async () => {
      const admin = await createIdentity({ isAdmin: true });
      await createIdentity({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      });

      const { identities, total } = await searchIdentities(prisma, {
        query: 'john@example.com',
      });

      expect(total).toBe(1);
      expect(identities[0].email).toBe('john@example.com');
    });

    it('searches by name', async () => {
      const admin = await createIdentity({ isAdmin: true });
      await createIdentity({
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@example.com',
      });

      const { identities } = await searchIdentities(prisma, {
        query: 'Alice',
      });

      expect(identities).toHaveLength(1);
      expect(identities[0].firstName).toBe('Alice');
    });

    it('respects limit and offset', async () => {
      const admin = await createIdentity({ isAdmin: true });
      for (let i = 0; i < 5; i++) {
        await createIdentity({
          firstName: `User${i}`,
          lastName: 'Test',
          email: `user${i}@example.com`,
        });
      }

      const { identities, total } = await searchIdentities(prisma, {
        limit: 2,
        offset: 1,
      });

      expect(total).toBe(5);
      expect(identities).toHaveLength(2);
    });
  });

  describe('grantRole', () => {
    it('grants a platform role to an identity', async () => {
      const admin = await createIdentity({ isAdmin: true });
      const user = await createIdentity({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
      });

      const roleAssignment = await grantRole(prisma, {
        identityId: user.id,
        role: 'guest',
        scopeType: 'platform',
        grantedByIdentityId: admin.id,
      });

      expect(roleAssignment.identityId).toBe(user.id);
      expect(roleAssignment.role).toBe('guest');
      expect(roleAssignment.status).toBe('active');
    });

    it('rejects granting role to non-existent identity', async () => {
      const admin = await createIdentity({ isAdmin: true });

      await expect(
        grantRole(prisma, {
          identityId: 'non-existent-id',
          role: 'guest',
          scopeType: 'platform',
          grantedByIdentityId: admin.id,
        })
      ).rejects.toThrow('not found');
    });
  });

  describe('revokeRole', () => {
    it('revokes an active role assignment', async () => {
      const admin = await createIdentity({ isAdmin: true });
      const user = await createIdentity({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
      });

      const roleAssignment = await grantRole(prisma, {
        identityId: user.id,
        role: 'guest',
        scopeType: 'platform',
        grantedByIdentityId: admin.id,
      });

      const revoked = await revokeRole(prisma, {
        roleAssignmentId: roleAssignment.id,
      });

      expect(revoked.status).toBe('revoked');
    });
  });

  describe('blockIdentity', () => {
    it('blocks an active identity', async () => {
      const admin = await createIdentity({ isAdmin: true });
      const user = await createIdentity({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
      });

      const blocked = await blockIdentity(prisma, { identityId: user.id });

      expect(blocked.status).toBe('blocked');
    });

    it('rejects blocking non-existent identity', async () => {
      await expect(
        blockIdentity(prisma, { identityId: 'non-existent' })
      ).rejects.toThrow('not found');
    });
  });

  describe('unblockIdentity', () => {
    it('unblocks a blocked identity', async () => {
      const admin = await createIdentity({ isAdmin: true });
      const user = await createIdentity({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        status: 'blocked',
      });

      const unblocked = await unblockIdentity(prisma, { identityId: user.id });

      expect(unblocked.status).toBe('active');
    });

    it('rejects unblocking a non-blocked identity', async () => {
      const user = await createIdentity({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
      });

      await expect(
        unblockIdentity(prisma, { identityId: user.id })
      ).rejects.toThrow('not blocked');
    });
  });

  describe('Organizations', () => {
    it('creates an organization', async () => {
      const org = await createOrganization(prisma, {
        name: 'Test MC',
        orgType: 'management_company',
        contactEmail: 'mc@example.com',
        contactPhone: '+66812345678',
      });

      expect(org.name).toBe('Test MC');
      expect(org.orgType).toBe('management_company');
    });

    it('updates an organization', async () => {
      const org = await createOrganization(prisma, {
        name: 'Test MC',
        orgType: 'management_company',
        contactEmail: 'mc@example.com',
        contactPhone: '+66812345678',
      });

      const updated = await updateOrganization(prisma, org.id, {
        name: 'Updated MC',
      });

      expect(updated.name).toBe('Updated MC');
    });

    it('deletes an organization', async () => {
      const org = await createOrganization(prisma, {
        name: 'Test MC',
        orgType: 'management_company',
        contactEmail: 'mc@example.com',
        contactPhone: '+66812345678',
      });

      await deleteOrganization(prisma, org.id);

      const found = await prisma.organization.findUnique({ where: { id: org.id } });
      expect(found).toBeNull();
    });

    it('lists organizations with filter', async () => {
      await createOrganization(prisma, {
        name: 'MC 1',
        orgType: 'management_company',
        contactEmail: 'mc1@example.com',
        contactPhone: '+66812345678',
      });

      await createOrganization(prisma, {
        name: 'Juristic 1',
        orgType: 'juristic_person',
        contactEmail: 'jp@example.com',
        contactPhone: '+66812345678',
      });

      const mcs = await listOrganizations(prisma, {
        orgType: 'management_company',
      });

      expect(mcs).toHaveLength(1);
      expect(mcs[0].orgType).toBe('management_company');
    });
  });

  describe('Claim flow (F-AUTH-4)', () => {
    it('generates a claim link for invited identity', async () => {
      const admin = await createIdentity({ isAdmin: true });
      const invited = await createIdentity({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        status: 'invited',
      });

      const token = await generateClaimLink(prisma, {
        identityId: invited.id,
        ttlMinutes: 60,
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify token was stored
      const storedToken = await prisma.oneTimeToken.findFirst({
        where: { tokenHash: crypto.createHash('sha256').update(token).digest('hex') },
      });
      expect(storedToken).toBeDefined();
      expect(storedToken?.purpose).toBe('account_claim');
    });

    it('rejects generating link for non-invited identity', async () => {
      const user = await createIdentity({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        status: 'active',
      });

      await expect(
        generateClaimLink(prisma, {
          identityId: user.id,
        })
      ).rejects.toThrow('not in invited status');
    });

    it('claims identity with valid token and password', async () => {
      const admin = await createIdentity({ isAdmin: true });
      const invited = await createIdentity({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        status: 'invited',
      });

      const token = await generateClaimLink(prisma, {
        identityId: invited.id,
      });

      const claimed = await claimIdentity(prisma, {
        tokenHash: hashToken(token),
        password: 'SecurePassword123!',
      });

      expect(claimed.status).toBe('active');
      expect(claimed.hashedPassword).toBeDefined();
      expect(claimed.emailVerifiedAt).toBeDefined();

      // Verify token is consumed
      const storedToken = await prisma.oneTimeToken.findUnique({
        where: { tokenHash: hashToken(token) },
      });
      expect(storedToken?.consumedAt).toBeDefined();
    });

    it('rejects claiming with expired token', async () => {
      const invited = await createIdentity({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        status: 'invited',
      });

      const token = await generateClaimLink(prisma, {
        identityId: invited.id,
        ttlMinutes: -60, // Expired 60 minutes ago
      });

      await expect(
        claimIdentity(prisma, {
          tokenHash: hashToken(token),
          password: 'SecurePassword123!',
        })
      ).rejects.toThrow('expired');
    });

    it('rejects claiming with already-consumed token', async () => {
      const invited = await createIdentity({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        status: 'invited',
      });

      const token = await generateClaimLink(prisma, {
        identityId: invited.id,
      });

      // Claim once
      await claimIdentity(prisma, {
        tokenHash: hashToken(token),
        password: 'SecurePassword123!',
      });

      // Try to claim again
      await expect(
        claimIdentity(prisma, {
          tokenHash: hashToken(token),
          password: 'AnotherPassword456!',
        })
      ).rejects.toThrow('already been used');
    });
  });

  describe('Blocked identity loses access (mid-session test)', () => {
    it('blocked identity is marked as blocked in the system', async () => {
      const admin = await createIdentity({ isAdmin: true });
      const user = await createIdentity({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
      });

      // Grant a role
      await grantRole(prisma, {
        identityId: user.id,
        role: 'guest',
        scopeType: 'platform',
        grantedByIdentityId: admin.id,
      });

      // Verify user has active role
      let roles = await getIdentityRoles(prisma, user.id);
      expect(roles).toHaveLength(1);
      expect(roles[0].status).toBe('active');

      // Block the identity
      const blocked = await blockIdentity(prisma, { identityId: user.id });
      expect(blocked.status).toBe('blocked');

      // Verify blocked status persists
      const refetched = await prisma.identity.findUnique({ where: { id: user.id } });
      expect(refetched?.status).toBe('blocked');
    });

    it('can restore blocked identity access by unblocking', async () => {
      const admin = await createIdentity({ isAdmin: true });
      const user = await createIdentity({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
      });

      // Block the identity
      const blocked = await blockIdentity(prisma, { identityId: user.id });
      expect(blocked.status).toBe('blocked');

      // Unblock
      const unblocked = await unblockIdentity(prisma, { identityId: user.id });
      expect(unblocked.status).toBe('active');

      // Verify restoration
      const refetched = await prisma.identity.findUnique({ where: { id: user.id } });
      expect(refetched?.status).toBe('active');
    });
  });
});
