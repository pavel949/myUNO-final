import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, resetDb, createIdentity, createProject } from '@/test/util';
import * as providerService from './provider.service';

describe('provider.service — integration tests', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(async () => {
    await resetDb();
  });

  describe('createProviderApplication', () => {
    it('creates a new provider application with applied status', async () => {
      const result = await providerService.createProviderApplication(db, {
        name: 'Elite Cleaning Services',
        description: 'Professional cleaning for luxury properties',
        contactEmail: 'info@elite-cleaning.com',
        contactPhone: '+66812345678',
        categoryKeys: ['cleaning', 'laundry'],
      });

      expect(result.id).toBeDefined();

      const provider = await db.provider.findUnique({
        where: { id: result.id },
      });

      expect(provider?.name).toBe('Elite Cleaning Services');
      expect(provider?.status).toBe('applied');
      expect(provider?.contactEmail).toBe('info@elite-cleaning.com');
      expect(provider?.categoryKeys).toEqual(['cleaning', 'laundry']);
    });
  });

  describe('getProviderApplications', () => {
    it('retrieves providers filtered by status', async () => {
      // Create multiple providers
      const applied1 = await providerService.createProviderApplication(db, {
        name: 'Provider A',
        description: 'Description A',
        contactEmail: 'a@example.com',
        contactPhone: '+66800000001',
        categoryKeys: ['cleaning'],
      });

      const applied2 = await providerService.createProviderApplication(db, {
        name: 'Provider B',
        description: 'Description B',
        contactEmail: 'b@example.com',
        contactPhone: '+66800000002',
        categoryKeys: ['tours'],
      });

      // Both should be in applied status
      const applications = await providerService.getProviderApplications(db, {
        status: 'applied',
      });

      expect(applications).toHaveLength(2);
      expect(applications[0]?.name).toBe('Provider A');
      expect(applications[1]?.name).toBe('Provider B');
    });

    it('retrieves only active providers when filtering by active status', async () => {
      const admin = await createIdentity();

      // Create and approve a provider
      const providerToApprove = await providerService.createProviderApplication(db, {
        name: 'Approved Provider',
        description: 'Already approved',
        contactEmail: 'approved@example.com',
        contactPhone: '+66800000003',
        categoryKeys: ['cleaning'],
      });

      await providerService.approveProvider(db, providerToApprove.id, admin.id);

      // Create an unapproved provider
      await providerService.createProviderApplication(db, {
        name: 'Unapproved Provider',
        description: 'Still waiting',
        contactEmail: 'unapproved@example.com',
        contactPhone: '+66800000004',
        categoryKeys: ['tours'],
      });

      // Query active only
      const activeProviders = await providerService.getProviderApplications(db, {
        status: 'active',
      });

      expect(activeProviders).toHaveLength(1);
      expect(activeProviders[0]?.name).toBe('Approved Provider');
    });
  });

  describe('approveProvider', () => {
    it('transitions provider from applied to active and sets vetted_at', async () => {
      const admin = await createIdentity();

      const provider = await providerService.createProviderApplication(db, {
        name: 'Pending Provider',
        description: 'Awaiting approval',
        contactEmail: 'pending@example.com',
        contactPhone: '+66800000005',
        categoryKeys: ['cleaning'],
      });

      const beforeApprove = await db.provider.findUnique({
        where: { id: provider.id },
      });
      expect(beforeApprove?.status).toBe('applied');
      expect(beforeApprove?.vetted_at).toBeNull();

      // Approve the provider
      await providerService.approveProvider(db, provider.id, admin.id);

      const afterApprove = await db.provider.findUnique({
        where: { id: provider.id },
      });
      expect(afterApprove?.status).toBe('active');
      expect(afterApprove?.vetted_at).not.toBeNull();
      expect(afterApprove?.vetted_by_identity_id).toBe(admin.id);
    });

    it('creates a provider_member role on approval', async () => {
      const admin = await createIdentity();

      const provider = await providerService.createProviderApplication(db, {
        name: 'Provider With Role',
        description: 'Will get a role',
        contactEmail: 'role@example.com',
        contactPhone: '+66800000006',
        categoryKeys: ['cleaning'],
      });

      await providerService.approveProvider(db, provider.id, admin.id);

      const role = await db.roleAssignment.findFirst({
        where: {
          providerId: provider.id,
          role: 'provider_member',
          status: 'active',
        },
      });

      expect(role).toBeDefined();
      expect(role?.providerId).toBe(provider.id);
    });

    it('sends N-18 notification on approval', async () => {
      const admin = await createIdentity();

      const provider = await providerService.createProviderApplication(db, {
        name: 'Notified Provider',
        description: 'Should receive notification',
        contactEmail: 'notified@example.com',
        contactPhone: '+66800000007',
        categoryKeys: ['cleaning'],
      });

      await providerService.approveProvider(db, provider.id, admin.id);

      const notification = await db.notification.findFirst({
        where: {
          type: 'provider_approved',
          identityId: admin.id,
        },
      });

      expect(notification).toBeDefined();
      expect(notification?.type).toBe('provider_approved');
    });
  });

  describe('rejectProvider', () => {
    it('transitions provider to offboarded status', async () => {
      const admin = await createIdentity();

      const provider = await providerService.createProviderApplication(db, {
        name: 'Rejected Provider',
        description: 'Will be rejected',
        contactEmail: 'rejected@example.com',
        contactPhone: '+66800000008',
        categoryKeys: ['cleaning'],
      });

      await providerService.rejectProvider(db, provider.id, admin.id, 'Does not meet standards');

      const rejected = await db.provider.findUnique({
        where: { id: provider.id },
      });

      expect(rejected?.status).toBe('offboarded');
    });

    it('sends N-19 notification on rejection', async () => {
      const admin = await createIdentity();

      const provider = await providerService.createProviderApplication(db, {
        name: 'Rejected With Notification',
        description: 'Should be notified',
        contactEmail: 'reject-notified@example.com',
        contactPhone: '+66800000009',
        categoryKeys: ['tours'],
      });

      await providerService.rejectProvider(
        db,
        provider.id,
        admin.id,
        'Application incomplete'
      );

      const notification = await db.notification.findFirst({
        where: {
          type: 'provider_rejected',
          identityId: admin.id,
        },
      });

      expect(notification).toBeDefined();
      expect(notification?.type).toBe('provider_rejected');
    });
  });

  describe('getProvider', () => {
    it('retrieves provider with all relationships', async () => {
      const admin = await createIdentity();

      const provider = await providerService.createProviderApplication(db, {
        name: 'Full Provider',
        description: 'Complete data',
        contactEmail: 'full@example.com',
        contactPhone: '+66800000010',
        categoryKeys: ['cleaning', 'laundry'],
      });

      await providerService.approveProvider(db, provider.id, admin.id);

      const retrieved = await providerService.getProvider(db, provider.id);

      expect(retrieved.id).toBe(provider.id);
      expect(retrieved.name).toBe('Full Provider');
      expect(retrieved.status).toBe('active');
      expect(retrieved.isVetted).toBe(true);
      expect(retrieved.vetted_by).toBeDefined();
      expect(retrieved.roleAssignments).toHaveLength(1);
    });

    it('includes isVetted flag based on vetted_at', async () => {
      const admin = await createIdentity();

      // Unapproved provider
      const unapproved = await providerService.createProviderApplication(db, {
        name: 'Unapproved',
        description: 'No vetting',
        contactEmail: 'unvetted@example.com',
        contactPhone: '+66800000011',
        categoryKeys: ['cleaning'],
      });

      const unapprovdRetrieved = await providerService.getProvider(db, unapproved.id);
      expect(unapprovdRetrieved.isVetted).toBe(false);

      // Approved provider
      const approved = await providerService.createProviderApplication(db, {
        name: 'Approved',
        description: 'Vetted',
        contactEmail: 'vetted@example.com',
        contactPhone: '+66800000012',
        categoryKeys: ['cleaning'],
      });

      await providerService.approveProvider(db, approved.id, admin.id);

      const approvedRetrieved = await providerService.getProvider(db, approved.id);
      expect(approvedRetrieved.isVetted).toBe(true);
    });
  });

  describe('e2e — application → vetting → active', () => {
    it('walks through complete provider lifecycle', async () => {
      const founder = await createIdentity();

      // Step 1: Create application
      const application = await providerService.createProviderApplication(db, {
        name: 'Chef Services',
        description: 'Professional culinary for private dinners',
        contactEmail: 'chef@example.com',
        contactPhone: '+66898765432',
        categoryKeys: ['culinary'],
      });

      // Verify applied status
      let provider = await db.provider.findUnique({
        where: { id: application.id },
      });
      expect(provider?.status).toBe('applied');
      expect(provider?.vetted_at).toBeNull();

      // Step 2: Admin retrieves vetting queue
      const queue = await providerService.getProviderApplications(db, {
        status: 'applied',
      });
      expect(queue).toHaveLength(1);
      expect(queue[0]?.id).toBe(application.id);

      // Step 3: Admin approves
      await providerService.approveProvider(db, application.id, founder.id);

      // Step 4: Verify active status and badge (vetted_at set)
      provider = await db.provider.findUnique({
        where: { id: application.id },
      });
      expect(provider?.status).toBe('active');
      expect(provider?.vetted_at).not.toBeNull();

      // Step 5: Verify provider can be retrieved with vetted badge
      const vetted = await providerService.getProvider(db, application.id);
      expect(vetted.isVetted).toBe(true);
    });
  });

  describe('badge rendering — vetted_at as source of truth', () => {
    it('badge should render only when vetted_at is set', async () => {
      const admin = await createIdentity();

      const provider = await providerService.createProviderApplication(db, {
        name: 'Badge Test',
        description: 'Testing badge logic',
        contactEmail: 'badge@example.com',
        contactPhone: '+66800000013',
        categoryKeys: ['cleaning'],
      });

      // Before approval: no badge
      const unapprovedProvider = await db.provider.findUnique({
        where: { id: provider.id },
      });
      const shouldNotShowBadge = unapprovedProvider?.vetted_at === null;
      expect(shouldNotShowBadge).toBe(true);

      // After approval: badge should show
      await providerService.approveProvider(db, provider.id, admin.id);

      const approvedProvider = await db.provider.findUnique({
        where: { id: provider.id },
      });
      const shouldShowBadge = approvedProvider?.vetted_at !== null;
      expect(shouldShowBadge).toBe(true);
    });
  });
});
