import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, setGlobalConfig } from '@/test/util';
import * as providerService from './provider.service';
import * as serviceService from './service.service';
import { seedConfig, getConfig, setConfigOverride } from '@/modules/config';

describe('service.service — integration tests', () => {
  let applicant: Awaited<ReturnType<typeof createIdentity>>;

  beforeEach(async () => {
    await resetDb();
    await seedConfig(db);
    applicant = await createIdentity({ firstName: 'Applicant' });
  });

  afterEach(async () => {
    await resetDb();
  });

  describe('createService', () => {
    it('creates a service in draft status when approval is required', async () => {
      const admin = await createIdentity();
      const project = await createProject();

      // Create and approve a provider
      const providerApp = await providerService.createProviderApplication(db, {
        applicantIdentityId: applicant.id,
        name: 'Test Provider',
        description: 'For testing',
        contactEmail: 'test@provider.com',
        contactPhone: '+66812345678',
        categoryKeys: ['cleaning'],
      });

      await providerService.approveProvider(db, providerApp.id, admin.id);

      // Default approval requirement is true, so no override needed

      // Create service
      const result = await serviceService.createService(db, {
        providerId: providerApp.id,
        categoryKey: 'cleaning',
        title: 'Standard Cleaning',
        description: 'Professional cleaning service',
        titleRu: 'Стандартная уборка',
        descriptionRu: 'Профессиональная служба уборки',
        titleEn: 'Standard Cleaning',
        descriptionEn: 'Professional cleaning service',
        titleTh: 'ทำความสะอาดมาตรฐาน',
        descriptionTh: 'บริการทำความสะอาดแบบมืออาชีพ',
        priceModel: 'fixed',
        basePriceThb: 2000,
        durationMin: 120,
        fulfilmentMode: 'referred',
        advanceNoticeHours: 24,
        availableProjectIds: [project.id],
      });

      expect(result.id).toBeDefined();

      const service = await db.service.findUnique({
        where: { id: result.id },
      });

      expect(service?.status).toBe('draft');
      expect(service?.title).toBe('Standard Cleaning');
      expect(service?.titleRu).toBe('Стандартная уборка');
      expect(service?.basePriceThb).toBe(2000);
    });

    it('creates a service in active status when approval is not required', async () => {
      const admin = await createIdentity();

      // Create and approve a provider
      const providerApp = await providerService.createProviderApplication(db, {
        applicantIdentityId: applicant.id,
        name: 'Quick Provider',
        description: 'No approval needed',
        contactEmail: 'quick@provider.com',
        contactPhone: '+66812345679',
        categoryKeys: ['catering'],
      });

      await providerService.approveProvider(db, providerApp.id, admin.id);

      // Disable approval requirement by updating the parameter default
      await db.configParameter.update({
        where: { key: 'services.require_admin_approval' },
        data: { defaultValue: false },
      });

      // Create service
      const result = await serviceService.createService(db, {
        providerId: providerApp.id,
        categoryKey: 'catering',
        title: 'Dinner Party',
        priceModel: 'per_person',
        basePriceThb: 500,
      });

      const service = await db.service.findUnique({
        where: { id: result.id },
      });

      expect(service?.status).toBe('active');
    });

    it('creates serviceProject join records for available project IDs', async () => {
      const admin = await createIdentity();
      const project1 = await createProject({ name: 'Project 1' });
      const project2 = await createProject({ name: 'Project 2' });

      const provider = await providerService.createProviderApplication(db, {
        applicantIdentityId: applicant.id,
        name: 'Multi-Project Provider',
        description: 'Available in multiple projects',
        contactEmail: 'multi@provider.com',
        contactPhone: '+66812345680',
        categoryKeys: ['tours'],
      });

      await providerService.approveProvider(db, provider.id, admin.id);
      await setGlobalConfig('services.require_admin_approval', false);

      const result = await serviceService.createService(db, {
        providerId: provider.id,
        categoryKey: 'tours',
        title: 'Island Tour',
        priceModel: 'fixed',
        basePriceThb: 3000,
        availableProjectIds: [project1.id, project2.id],
      });

      const serviceProjects = await db.serviceProject.findMany({
        where: { service_id: result.id },
      });

      expect(serviceProjects).toHaveLength(2);
      expect(serviceProjects.map(sp => sp.project_id).sort()).toEqual(
        [project1.id, project2.id].sort()
      );
    });
  });

  describe('getService', () => {
    it('retrieves a service with provider info and available projects', async () => {
      const admin = await createIdentity();
      const project = await createProject();

      const provider = await providerService.createProviderApplication(db, {
        applicantIdentityId: applicant.id,
        name: 'Detail Provider',
        description: 'Test retrieval',
        contactEmail: 'detail@provider.com',
        contactPhone: '+66812345681',
        categoryKeys: ['maintenance'],
      });

      await providerService.approveProvider(db, provider.id, admin.id);
      await setGlobalConfig('services.require_admin_approval', false);

      const serviceResult = await serviceService.createService(db, {
        providerId: provider.id,
        categoryKey: 'maintenance',
        title: 'AC Maintenance',
        priceModel: 'fixed',
        basePriceThb: 1500,
        availableProjectIds: [project.id],
      });

      const retrieved = await serviceService.getService(db, serviceResult.id);

      expect(retrieved.id).toBe(serviceResult.id);
      expect(retrieved.title).toBe('AC Maintenance');
      expect(retrieved.provider.id).toBe(provider.id);
      expect(retrieved.availableProjectIds).toContain(project.id);
    });

    it('throws when service does not exist', async () => {
      await expect(
        serviceService.getService(db, 'nonexistent')
      ).rejects.toThrow('Service nonexistent not found');
    });
  });

  describe('updateService', () => {
    it('allows updating a draft service', async () => {
      const admin = await createIdentity();

      const provider = await providerService.createProviderApplication(db, {
        applicantIdentityId: applicant.id,
        name: 'Draft Provider',
        description: 'Test draft editing',
        contactEmail: 'draft@provider.com',
        contactPhone: '+66812345682',
        categoryKeys: ['cleaning'],
      });

      await providerService.approveProvider(db, provider.id, admin.id);
      await setGlobalConfig('services.require_admin_approval', true);

      const serviceResult = await serviceService.createService(db, {
        providerId: provider.id,
        categoryKey: 'cleaning',
        title: 'Draft Service',
        priceModel: 'fixed',
        basePriceThb: 2000,
      });

      // Edit the draft service
      await serviceService.updateService(db, serviceResult.id, {
        title: 'Updated Title',
        basePriceThb: 2500,
      });

      const updated = await db.service.findUnique({
        where: { id: serviceResult.id },
      });

      expect(updated?.title).toBe('Updated Title');
      expect(updated?.basePriceThb).toBe(2500);
    });

    it('rejects editing a non-draft service', async () => {
      const admin = await createIdentity();

      const provider = await providerService.createProviderApplication(db, {
        applicantIdentityId: applicant.id,
        name: 'Active Provider',
        description: 'Cannot edit active service',
        contactEmail: 'active@provider.com',
        contactPhone: '+66812345683',
        categoryKeys: ['tours'],
      });

      await providerService.approveProvider(db, provider.id, admin.id);
      await setGlobalConfig('services.require_admin_approval', false);

      const serviceResult = await serviceService.createService(db, {
        providerId: provider.id,
        categoryKey: 'tours',
        title: 'Active Service',
        priceModel: 'fixed',
        basePriceThb: 3000,
      });

      // Try to edit active service
      await expect(
        serviceService.updateService(db, serviceResult.id, {
          title: 'Cannot Update',
        })
      ).rejects.toThrow('Cannot edit active or paused services');
    });
  });

  describe('approveService', () => {
    it('transitions service from draft to active', async () => {
      const admin = await createIdentity();

      const provider = await providerService.createProviderApplication(db, {
        applicantIdentityId: applicant.id,
        name: 'Approval Provider',
        description: 'For approval testing',
        contactEmail: 'approval@provider.com',
        contactPhone: '+66812345684',
        categoryKeys: ['catering'],
      });

      await providerService.approveProvider(db, provider.id, admin.id);
      await setGlobalConfig('services.require_admin_approval', true);

      const serviceResult = await serviceService.createService(db, {
        providerId: provider.id,
        categoryKey: 'catering',
        title: 'Pending Service',
        priceModel: 'per_person',
        basePriceThb: 400,
      });

      // Approve the service
      await serviceService.approveService(db, serviceResult.id, admin.id);

      const approved = await db.service.findUnique({
        where: { id: serviceResult.id },
      });

      expect(approved?.status).toBe('active');
    });

    it('rejects approving a non-draft service', async () => {
      const admin = await createIdentity();

      const provider = await providerService.createProviderApplication(db, {
        applicantIdentityId: applicant.id,
        name: 'Already Active',
        description: 'Cannot approve again',
        contactEmail: 'alreadyactive@provider.com',
        contactPhone: '+66812345685',
        categoryKeys: ['maintenance'],
      });

      await providerService.approveProvider(db, provider.id, admin.id);
      await setGlobalConfig('services.require_admin_approval', false);

      const serviceResult = await serviceService.createService(db, {
        providerId: provider.id,
        categoryKey: 'maintenance',
        title: 'Already Active Service',
        priceModel: 'fixed',
        basePriceThb: 1000,
      });

      // Try to approve an already-active service
      await expect(
        serviceService.approveService(db, serviceResult.id, admin.id)
      ).rejects.toThrow('Only draft services can be approved');
    });
  });

  describe('rejectService', () => {
    it('transitions service from draft to paused', async () => {
      const admin = await createIdentity();

      const provider = await providerService.createProviderApplication(db, {
        applicantIdentityId: applicant.id,
        name: 'Rejection Provider',
        description: 'For rejection testing',
        contactEmail: 'rejection@provider.com',
        contactPhone: '+66812345686',
        categoryKeys: ['events'],
      });

      await providerService.approveProvider(db, provider.id, admin.id);
      await setGlobalConfig('services.require_admin_approval', true);

      const serviceResult = await serviceService.createService(db, {
        providerId: provider.id,
        categoryKey: 'events',
        title: 'Rejected Service',
        priceModel: 'per_hour',
        basePriceThb: 800,
      });

      // Reject the service
      await serviceService.rejectService(
        db,
        serviceResult.id,
        admin.id,
        'Does not meet quality standards'
      );

      const rejected = await db.service.findUnique({
        where: { id: serviceResult.id },
      });

      expect(rejected?.status).toBe('paused');
    });
  });

  describe('getServicesByProvider', () => {
    it('retrieves all services by a provider', async () => {
      const admin = await createIdentity();

      const provider = await providerService.createProviderApplication(db, {
        applicantIdentityId: applicant.id,
        name: 'Multi-Service Provider',
        description: 'Offers multiple services',
        contactEmail: 'multi-service@provider.com',
        contactPhone: '+66812345687',
        categoryKeys: ['cleaning', 'laundry'],
      });

      await providerService.approveProvider(db, provider.id, admin.id);
      await setGlobalConfig('services.require_admin_approval', false);

      // Create multiple services
      await serviceService.createService(db, {
        providerId: provider.id,
        categoryKey: 'cleaning',
        title: 'Cleaning',
        priceModel: 'fixed',
        basePriceThb: 2000,
      });

      await serviceService.createService(db, {
        providerId: provider.id,
        categoryKey: 'laundry',
        title: 'Laundry',
        priceModel: 'per_person',
        basePriceThb: 200,
      });

      const services = await serviceService.getServicesByProvider(db, provider.id);

      expect(services).toHaveLength(2);
      expect(services.map(s => s.title).sort()).toEqual(['Cleaning', 'Laundry']);
    });

    it('filters services by status', async () => {
      const admin = await createIdentity();

      const provider = await providerService.createProviderApplication(db, {
        applicantIdentityId: applicant.id,
        name: 'Status Filter Provider',
        description: 'For status filtering',
        contactEmail: 'status-filter@provider.com',
        contactPhone: '+66812345688',
        categoryKeys: ['cleaning'],
      });

      await providerService.approveProvider(db, provider.id, admin.id);
      await setGlobalConfig('services.require_admin_approval', true);

      // Create two services
      const service1 = await serviceService.createService(db, {
        providerId: provider.id,
        categoryKey: 'cleaning',
        title: 'Draft Service',
        priceModel: 'fixed',
        basePriceThb: 2000,
      });

      const service2 = await serviceService.createService(db, {
        providerId: provider.id,
        categoryKey: 'cleaning',
        title: 'Another Draft',
        priceModel: 'fixed',
        basePriceThb: 1500,
      });

      // Approve one
      await serviceService.approveService(db, service1.id, admin.id);

      // Get only active
      const activeServices = await serviceService.getServicesByProvider(db, provider.id, {
        status: 'active',
      });

      expect(activeServices).toHaveLength(1);
      expect(activeServices[0]?.title).toBe('Draft Service');
    });
  });

  describe('listPublicServices', () => {
    it('shows services with no project restrictions in any project', async () => {
      const admin = await createIdentity();
      const project1 = await createProject({ name: 'Project 1' });
      const project2 = await createProject({ name: 'Project 2' });

      const provider = await providerService.createProviderApplication(db, {
        applicantIdentityId: applicant.id,
        name: 'Unrestricted Provider',
        description: 'Available everywhere',
        contactEmail: 'unrestricted@provider.com',
        contactPhone: '+66812345689',
        categoryKeys: ['tours'],
      });

      await providerService.approveProvider(db, provider.id, admin.id);
      await setGlobalConfig('services.require_admin_approval', false);

      // Create service with no project restrictions
      await serviceService.createService(db, {
        providerId: provider.id,
        categoryKey: 'tours',
        title: 'Universal Tour',
        priceModel: 'fixed',
        basePriceThb: 5000,
        availableProjectIds: [], // No restrictions
      });

      // Should appear in both projects
      const inProject1 = await serviceService.listPublicServices(db, project1.id);
      const inProject2 = await serviceService.listPublicServices(db, project2.id);

      expect(inProject1).toHaveLength(1);
      expect(inProject2).toHaveLength(1);
      expect(inProject1[0]?.title).toBe('Universal Tour');
    });

    it('shows services only in their scoped projects', async () => {
      const admin = await createIdentity();
      const project1 = await createProject({ name: 'Project 1' });
      const project2 = await createProject({ name: 'Project 2' });

      const provider = await providerService.createProviderApplication(db, {
        applicantIdentityId: applicant.id,
        name: 'Restricted Provider',
        description: 'Limited to specific projects',
        contactEmail: 'restricted@provider.com',
        contactPhone: '+66812345690',
        categoryKeys: ['cleaning'],
      });

      await providerService.approveProvider(db, provider.id, admin.id);
      await setGlobalConfig('services.require_admin_approval', false);

      // Create service available only in project1
      await serviceService.createService(db, {
        providerId: provider.id,
        categoryKey: 'cleaning',
        title: 'Project1 Cleaning',
        priceModel: 'fixed',
        basePriceThb: 2000,
        availableProjectIds: [project1.id],
      });

      // Query each project
      const inProject1 = await serviceService.listPublicServices(db, project1.id);
      const inProject2 = await serviceService.listPublicServices(db, project2.id);

      expect(inProject1).toHaveLength(1);
      expect(inProject2).toHaveLength(0);
    });

    it('requires provider to be active and vetted', async () => {
      const admin = await createIdentity();
      const project = await createProject();

      // Create an unapproved provider
      const provider = await providerService.createProviderApplication(db, {
        applicantIdentityId: applicant.id,
        name: 'Unvetted Provider',
        description: 'Not approved yet',
        contactEmail: 'unvetted-service@provider.com',
        contactPhone: '+66812345691',
        categoryKeys: ['catering'],
      });

      // Don't approve the provider
      await setGlobalConfig('services.require_admin_approval', false);

      // Create service for unapproved provider
      await serviceService.createService(db, {
        providerId: provider.id,
        categoryKey: 'catering',
        title: 'Unapproved Catering',
        priceModel: 'per_person',
        basePriceThb: 600,
        availableProjectIds: [project.id],
      });

      // Service should not appear (provider not vetted)
      const publicServices = await serviceService.listPublicServices(db, project.id);

      expect(publicServices).toHaveLength(0);

      // Now approve the provider
      await providerService.approveProvider(db, provider.id, admin.id);

      // Service should appear now
      const publicServicesAfter = await serviceService.listPublicServices(db, project.id);

      expect(publicServicesAfter).toHaveLength(1);
      expect(publicServicesAfter[0]?.title).toBe('Unapproved Catering');
    });

    it('filters by category key', async () => {
      const admin = await createIdentity();
      const project = await createProject();

      const provider = await providerService.createProviderApplication(db, {
        applicantIdentityId: applicant.id,
        name: 'Multi-Category Provider',
        description: 'Multiple services',
        contactEmail: 'multi-cat@provider.com',
        contactPhone: '+66812345692',
        categoryKeys: ['cleaning', 'catering', 'tours'],
      });

      await providerService.approveProvider(db, provider.id, admin.id);
      await setGlobalConfig('services.require_admin_approval', false);

      // Create services in different categories
      await serviceService.createService(db, {
        providerId: provider.id,
        categoryKey: 'cleaning',
        title: 'Cleaning Service',
        priceModel: 'fixed',
        basePriceThb: 2000,
      });

      await serviceService.createService(db, {
        providerId: provider.id,
        categoryKey: 'catering',
        title: 'Catering Service',
        priceModel: 'per_person',
        basePriceThb: 500,
      });

      // Filter by category
      const cleaningServices = await serviceService.listPublicServices(db, project.id, {
        categoryKey: 'cleaning',
      });

      const cateringServices = await serviceService.listPublicServices(db, project.id, {
        categoryKey: 'catering',
      });

      expect(cleaningServices).toHaveLength(1);
      expect(cleaningServices[0]?.title).toBe('Cleaning Service');
      expect(cateringServices).toHaveLength(1);
      expect(cateringServices[0]?.title).toBe('Catering Service');
    });

    it('only shows active services', async () => {
      const admin = await createIdentity();
      const project = await createProject();

      const provider = await providerService.createProviderApplication(db, {
        applicantIdentityId: applicant.id,
        name: 'Draft/Active Provider',
        description: 'Mixed statuses',
        contactEmail: 'mixed-status@provider.com',
        contactPhone: '+66812345693',
        categoryKeys: ['tours'],
      });

      await providerService.approveProvider(db, provider.id, admin.id);
      await setGlobalConfig('services.require_admin_approval', true);

      // Create two services
      const draftService = await serviceService.createService(db, {
        providerId: provider.id,
        categoryKey: 'tours',
        title: 'Draft Tour',
        priceModel: 'fixed',
        basePriceThb: 3000,
      });

      const activeService = await serviceService.createService(db, {
        providerId: provider.id,
        categoryKey: 'tours',
        title: 'Active Tour',
        priceModel: 'fixed',
        basePriceThb: 4000,
      });

      // Approve one
      await serviceService.approveService(db, activeService.id, admin.id);

      // List public
      const publicServices = await serviceService.listPublicServices(db, project.id);

      expect(publicServices).toHaveLength(1);
      expect(publicServices[0]?.title).toBe('Active Tour');
    });
  });

  describe('getServiceAverageRating', () => {
    it('returns average rating and review count (S6)', async () => {
      const admin = await createIdentity();
      const orderer1 = await createIdentity();
      const orderer2 = await createIdentity();
      const project = await createProject();

      const provider = await providerService.createProviderApplication(db, {
        applicantIdentityId: applicant.id,
        name: 'Rated Provider',
        description: 'Gets rated',
        contactEmail: 'rated@provider.com',
        contactPhone: '+66812345694',
        categoryKeys: ['cleaning'],
      });

      await providerService.approveProvider(db, provider.id, admin.id);
      await setGlobalConfig('services.require_admin_approval', false);

      const serviceResult = await serviceService.createService(db, {
        providerId: provider.id,
        categoryKey: 'cleaning',
        title: 'Rated Service',
        priceModel: 'fixed',
        basePriceThb: 2000,
      });

      // Create orders
      const order1 = await db.serviceOrder.create({
        data: {
          service_id: serviceResult.id,
          provider_id: provider.id,
          project_id: project.id,
          orderer_identity_id: orderer1.id,
          orderer_role: 'owner',
          status: 'fulfilled',
          scheduled_start: new Date('2026-08-01'),
          scheduled_end: new Date('2026-08-02'),
          quantity: 1,
          total_thb: 2000,
          take_rate_pct_snapshot: 15,
        },
      });

      const order2 = await db.serviceOrder.create({
        data: {
          service_id: serviceResult.id,
          provider_id: provider.id,
          project_id: project.id,
          orderer_identity_id: orderer2.id,
          orderer_role: 'owner',
          status: 'fulfilled',
          scheduled_start: new Date('2026-08-03'),
          scheduled_end: new Date('2026-08-04'),
          quantity: 1,
          total_thb: 2000,
          take_rate_pct_snapshot: 15,
        },
      });

      // Create reviews
      await db.review.create({
        data: {
          target_type: 'service_order',
          target_id: order1.id,
          author_identity_id: orderer1.id,
          rating: 5,
          comment: 'Excellent',
          status: 'published',
        },
      });

      await db.review.create({
        data: {
          target_type: 'service_order',
          target_id: order2.id,
          author_identity_id: orderer2.id,
          rating: 4,
          comment: 'Good',
          status: 'published',
        },
      });

      const result = await serviceService.getServiceAverageRating(db, serviceResult.id);

      expect(result).not.toBeNull();
      expect(result!.averageRating).toBe(4.5);
      expect(result!.reviewCount).toBe(2);
    });

    it('returns null when service has no reviews (S6)', async () => {
      const admin = await createIdentity();
      const project = await createProject();

      const provider = await providerService.createProviderApplication(db, {
        applicantIdentityId: applicant.id,
        name: 'Unrated Provider',
        description: 'No reviews',
        contactEmail: 'unrated@provider.com',
        contactPhone: '+66812345695',
        categoryKeys: ['catering'],
      });

      await providerService.approveProvider(db, provider.id, admin.id);
      await setGlobalConfig('services.require_admin_approval', false);

      const serviceResult = await serviceService.createService(db, {
        providerId: provider.id,
        categoryKey: 'catering',
        title: 'Unrated Service',
        priceModel: 'per_person',
        basePriceThb: 500,
      });

      const result = await serviceService.getServiceAverageRating(db, serviceResult.id);

      expect(result).toBeNull();
    });

    it('ignores hidden reviews in average calculation (S6)', async () => {
      const admin = await createIdentity();
      const orderer1 = await createIdentity();
      const orderer2 = await createIdentity();
      const project = await createProject();

      const provider = await providerService.createProviderApplication(db, {
        applicantIdentityId: applicant.id,
        name: 'Hidden Review Provider',
        description: 'Test hidden reviews',
        contactEmail: 'hidden@provider.com',
        contactPhone: '+66812345696',
        categoryKeys: ['tours'],
      });

      await providerService.approveProvider(db, provider.id, admin.id);
      await setGlobalConfig('services.require_admin_approval', false);

      const serviceResult = await serviceService.createService(db, {
        providerId: provider.id,
        categoryKey: 'tours',
        title: 'Tour Service',
        priceModel: 'fixed',
        basePriceThb: 5000,
      });

      const order1 = await db.serviceOrder.create({
        data: {
          service_id: serviceResult.id,
          provider_id: provider.id,
          project_id: project.id,
          orderer_identity_id: orderer1.id,
          orderer_role: 'owner',
          status: 'fulfilled',
          scheduled_start: new Date('2026-08-01'),
          scheduled_end: new Date('2026-08-02'),
          quantity: 1,
          total_thb: 5000,
          take_rate_pct_snapshot: 15,
        },
      });

      const order2 = await db.serviceOrder.create({
        data: {
          service_id: serviceResult.id,
          provider_id: provider.id,
          project_id: project.id,
          orderer_identity_id: orderer2.id,
          orderer_role: 'owner',
          status: 'fulfilled',
          scheduled_start: new Date('2026-08-03'),
          scheduled_end: new Date('2026-08-04'),
          quantity: 1,
          total_thb: 5000,
          take_rate_pct_snapshot: 15,
        },
      });

      // Create one published and one hidden review
      await db.review.create({
        data: {
          target_type: 'service_order',
          target_id: order1.id,
          author_identity_id: orderer1.id,
          rating: 5,
          status: 'published',
        },
      });

      await db.review.create({
        data: {
          target_type: 'service_order',
          target_id: order2.id,
          author_identity_id: orderer2.id,
          rating: 1,
          status: 'hidden', // Should be excluded
        },
      });

      const result = await serviceService.getServiceAverageRating(db, serviceResult.id);

      expect(result).not.toBeNull();
      expect(result!.averageRating).toBe(5); // Only the 5-star review counts
      expect(result!.reviewCount).toBe(1);
    });
  });

  describe('e2e — service creation → approval → visibility', () => {
    it('walks through complete service lifecycle and visibility', async () => {
      const admin = await createIdentity();
      const project = await createProject({ name: 'Tropical Resort' });

      // Step 1: Create provider
      const providerApp = await providerService.createProviderApplication(db, {
        applicantIdentityId: applicant.id,
        name: 'Luxury Spa Co',
        description: 'Premium spa services',
        contactEmail: 'spa@luxury.com',
        contactPhone: '+66898765432',
        categoryKeys: ['wellness'],
      });

      // Step 2: Approve provider
      await providerService.approveProvider(db, providerApp.id, admin.id);

      // Step 3: Create service (approval required)
      await setGlobalConfig('services.require_admin_approval', true);

      const serviceApp = await serviceService.createService(db, {
        providerId: providerApp.id,
        categoryKey: 'wellness',
        title: 'Signature Massage',
        titleRu: 'Фирменный массаж',
        description: 'Relaxing full-body treatment',
        priceModel: 'per_hour',
        basePriceThb: 2500,
        durationMin: 60,
        availableProjectIds: [project.id],
      });

      // Service should not be visible yet (draft)
      let publicList = await serviceService.listPublicServices(db, project.id);
      expect(publicList).toHaveLength(0);

      // Step 4: Admin approves service
      await serviceService.approveService(db, serviceApp.id, admin.id);

      // Now service should be visible
      publicList = await serviceService.listPublicServices(db, project.id);
      expect(publicList).toHaveLength(1);
      expect(publicList[0]?.title).toBe('Signature Massage');
      expect(publicList[0]?.isVetted).toBe(true);
    });
  });
});
