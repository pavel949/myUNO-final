import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import {
  deleteExpiredMediaAssets,
  anonymizeDeletedIdentities,
  expireOldTokens,
  exportIdentityData,
  requestIdentityDeletion,
  runRetentionJobs,
} from './retention.service';

describe('Retention & Privacy', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('deleteExpiredMediaAssets', () => {
    it('deletes media past delete_after date', async () => {
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day from now

      // Create one expired and one active media
      await db.mediaAsset.create({
        data: {
          storageKey: 'passport-1',
          kind: 'passport',
          mimeType: 'image/jpeg',
          sizeBytes: 1024,
          uploadedByIdentityId: 'system',
          deleteAfter: past,
        },
      });

      await db.mediaAsset.create({
        data: {
          storageKey: 'passport-2',
          kind: 'passport',
          mimeType: 'image/jpeg',
          sizeBytes: 1024,
          uploadedByIdentityId: 'system',
          deleteAfter: future,
        },
      });

      const result = await deleteExpiredMediaAssets(db);

      expect(result.deleted).toBe(1);

      // Verify the expired one was deleted
      const remaining = await db.mediaAsset.count();
      expect(remaining).toBe(1);
    });

    it('does not delete media without delete_after', async () => {
      await db.mediaAsset.create({
        data: {
          storageKey: 'permanent-doc',
          kind: 'document',
          mimeType: 'application/pdf',
          sizeBytes: 2048,
          uploadedByIdentityId: 'system',
        },
      });

      const result = await deleteExpiredMediaAssets(db);

      expect(result.deleted).toBe(0);

      const count = await db.mediaAsset.count();
      expect(count).toBe(1);
    });
  });

  describe('expireOldTokens', () => {
    it('deletes tokens past expiration', async () => {
      const identity = await createIdentity();
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Create one expired and one active token
      await db.oneTimeToken.create({
        data: {
          identityId: identity.id,
          type: 'email_verification',
          tokenHash: 'hash-expired',
          expiresAt: past,
        },
      });

      await db.oneTimeToken.create({
        data: {
          identityId: identity.id,
          type: 'email_verification',
          tokenHash: 'hash-active',
          expiresAt: future,
        },
      });

      const result = await expireOldTokens(db);

      expect(result.deleted).toBe(1);

      const remaining = await db.oneTimeToken.count();
      expect(remaining).toBe(1);
    });
  });

  describe('exportIdentityData', () => {
    it('exports identity data without PII of others', async () => {
      const identity = await createIdentity();
      const otherIdentity = await createIdentity();
      const project = await createProject();
      const unit = await createUnit(project.id);

      // Create a booking by this identity
      await db.booking.create({
        data: {
          unitId: unit.id,
          guestIdentityId: identity.id,
          startDate: new Date('2026-07-15'),
          endDate: new Date('2026-07-20'),
          totalPrice: 5000,
          guestCount: 2,
          status: 'confirmed',
        },
      });

      const exported = await exportIdentityData(db, identity.id);

      expect(exported.identity.id).toBe(identity.id);
      expect(exported.identity.firstName).toBe(identity.firstName);
      expect(exported.bookings).toHaveLength(1);
      expect(exported.bookings[0].unitId).toBe(unit.id);

      // Verify no plaintext password is included
      expect((exported.identity as any).hashedPassword).toBeUndefined();
    });

    it('throws when identity not found', async () => {
      await expect(exportIdentityData(db, 'nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('requestIdentityDeletion', () => {
    it('marks identity for deletion and logs request', async () => {
      const identity = await createIdentity();

      await requestIdentityDeletion(db, identity.id);

      const updated = await db.identity.findUnique({
        where: { id: identity.id },
      });

      expect(updated!.status).toBe('deleted');

      // Verify audit log entry
      const auditEntries = await db.auditLog.findMany({
        where: {
          action: 'identity_deletion_requested',
          entityId: identity.id,
        },
      });

      expect(auditEntries).toHaveLength(1);
    });
  });

  describe('anonymizeDeletedIdentities', () => {
    it('anonymizes identities past grace period', async () => {
      const identity = await createIdentity();

      // Mark for deletion
      const past = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // 40 days ago
      await db.identity.update({
        where: { id: identity.id },
        data: {
          status: 'deleted',
          updatedAt: past, // Simulate old deletion request
        },
      });

      const result = await anonymizeDeletedIdentities(db, 30);

      expect(result.anonymized).toBeGreaterThanOrEqual(1);
      expect(result.auditedCount).toBeGreaterThanOrEqual(1);

      // Verify anonymization
      const anonymized = await db.identity.findUnique({
        where: { id: identity.id },
      });

      expect(anonymized!.firstName).toBe('Deleted');
      expect(anonymized!.lastName).toBe('User');
      expect(anonymized!.email).toBeNull();
      expect(anonymized!.phone).toBeNull();
    });

    it('does not anonymize identities within grace period', async () => {
      const identity = await createIdentity();
      const originalName = identity.firstName;

      // Mark for deletion but recent
      await db.identity.update({
        where: { id: identity.id },
        data: {
          status: 'deleted',
        },
      });

      const result = await anonymizeDeletedIdentities(db, 30);

      expect(result.anonymized).toBe(0);

      // Verify name unchanged
      const unchanged = await db.identity.findUnique({
        where: { id: identity.id },
      });

      expect(unchanged!.firstName).toBe(originalName);
    });
  });

  describe('runRetentionJobs', () => {
    it('runs all retention jobs and returns aggregate stats', async () => {
      const identity = await createIdentity();
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Create expired media
      await db.mediaAsset.create({
        data: {
          storageKey: 'expired-passport',
          kind: 'passport',
          mimeType: 'image/jpeg',
          sizeBytes: 1024,
          uploadedByIdentityId: 'system',
          deleteAfter: past,
        },
      });

      // Create expired token
      await db.oneTimeToken.create({
        data: {
          identityId: identity.id,
          type: 'email_verification',
          tokenHash: 'old-hash',
          expiresAt: past,
        },
      });

      const result = await runRetentionJobs(db);

      expect(result.deletedMedia).toBe(1);
      expect(result.expiredTokens).toBe(1);
      expect(result.anonymizedIdentities).toBe(0); // No old deletion requests
    });
  });
});
