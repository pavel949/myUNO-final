import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resetDb } from '@/test/util';
import { prisma } from '@/lib/prisma';
import {
  createService,
  getService,
  listPublicServices,
  approveService,
  rejectService,
} from './service.service';

describe('Service Module - Integration Tests', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(async () => {
    // Cleanup is handled by resetDb in beforeEach
  });

  describe('createService', () => {
    it('should create a draft service', async () => {
      // Create a provider first
      const provider = await prisma.provider.create({
        data: {
          name: 'Test Provider',
          contactEmail: 'provider@test.com',
          contactPhone: '+1234567890',
        },
      });

      const result = await createService(prisma, {
        providerId: provider.id,
        categoryKey: 'cleaning',
        title: 'Cleaning Service',
        description: 'Professional cleaning',
        priceModel: 'fixed',
        basePriceThb: 5000,
      });

      expect(result.id).toBeDefined();

      const service = await prisma.service.findUnique({
        where: { id: result.id },
      });

      expect(service).toBeDefined();
      expect(service?.title).toBe('Cleaning Service');
      expect(service?.status).toBe('draft');
      expect(service?.provider_id).toBe(provider.id);
    });

    it('should create service with available projects', async () => {
      const provider = await prisma.provider.create({
        data: {
          name: 'Test Provider',
          contactEmail: 'provider@test.com',
          contactPhone: '+1234567890',
        },
      });

      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          slug: 'test-project',
        },
      });

      const result = await createService(prisma, {
        providerId: provider.id,
        categoryKey: 'repair',
        title: 'Repair Service',
        priceModel: 'quote',
        availableProjectIds: [project.id],
      });

      const serviceProjects = await prisma.serviceProject.findMany({
        where: { service_id: result.id },
      });

      expect(serviceProjects.length).toBe(1);
      expect(serviceProjects[0].project_id).toBe(project.id);
    });
  });

  describe('approveService', () => {
    it('should transition draft service to active', async () => {
      const provider = await prisma.provider.create({
        data: {
          name: 'Test Provider',
          contactEmail: 'provider@test.com',
          contactPhone: '+1234567890',
        },
      });

      const identity = await prisma.identity.create({
        data: {
          email: 'admin@test.com',
          role: 'admin',
        },
      });

      const result = await createService(prisma, {
        providerId: provider.id,
        categoryKey: 'cleaning',
        title: 'Cleaning Service',
        priceModel: 'fixed',
        basePriceThb: 5000,
      });

      await approveService(prisma, result.id, identity.id);

      const service = await prisma.service.findUnique({
        where: { id: result.id },
      });

      expect(service?.status).toBe('active');
      expect(service?.approved_at).toBeDefined();
      expect(service?.approved_by_identity_id).toBe(identity.id);
    });

    it('should throw error when approving non-draft service', async () => {
      const provider = await prisma.provider.create({
        data: {
          name: 'Test Provider',
          contactEmail: 'provider@test.com',
          contactPhone: '+1234567890',
        },
      });

      const identity = await prisma.identity.create({
        data: {
          email: 'admin@test.com',
          role: 'admin',
        },
      });

      const service = await prisma.service.create({
        data: {
          provider_id: provider.id,
          categoryKey: 'cleaning',
          title: 'Cleaning Service',
          priceModel: 'fixed',
          status: 'active',
        },
      });

      await expect(
        approveService(prisma, service.id, identity.id)
      ).rejects.toThrow('Only draft services can be approved');
    });
  });

  describe('rejectService', () => {
    it('should transition draft service to paused', async () => {
      const provider = await prisma.provider.create({
        data: {
          name: 'Test Provider',
          contactEmail: 'provider@test.com',
          contactPhone: '+1234567890',
        },
      });

      const identity = await prisma.identity.create({
        data: {
          email: 'admin@test.com',
          role: 'admin',
        },
      });

      const result = await createService(prisma, {
        providerId: provider.id,
        categoryKey: 'cleaning',
        title: 'Cleaning Service',
        priceModel: 'fixed',
        basePriceThb: 5000,
      });

      await rejectService(prisma, result.id, identity.id, 'Insufficient details');

      const service = await prisma.service.findUnique({
        where: { id: result.id },
      });

      expect(service?.status).toBe('paused');
      expect(service?.approved_at).toBeNull();
      expect(service?.approved_by_identity_id).toBeNull();
    });

    it('should throw error when rejecting non-draft service', async () => {
      const provider = await prisma.provider.create({
        data: {
          name: 'Test Provider',
          contactEmail: 'provider@test.com',
          contactPhone: '+1234567890',
        },
      });

      const identity = await prisma.identity.create({
        data: {
          email: 'admin@test.com',
          role: 'admin',
        },
      });

      const service = await prisma.service.create({
        data: {
          provider_id: provider.id,
          categoryKey: 'cleaning',
          title: 'Cleaning Service',
          priceModel: 'fixed',
          status: 'paused',
        },
      });

      await expect(
        rejectService(prisma, service.id, identity.id)
      ).rejects.toThrow('Only draft services can be rejected');
    });
  });

  describe('listPublicServices', () => {
    it('should return only active, vetted services', async () => {
      // Create a vetted provider
      const vettedProvider = await prisma.provider.create({
        data: {
          name: 'Vetted Provider',
          contactEmail: 'vetted@test.com',
          contactPhone: '+1234567890',
          status: 'active',
          vetted_at: new Date(),
        },
      });

      // Create an unvetted provider
      const unvettedProvider = await prisma.provider.create({
        data: {
          name: 'Unvetted Provider',
          contactEmail: 'unvetted@test.com',
          contactPhone: '+0987654321',
          status: 'applied',
        },
      });

      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          slug: 'test-project',
        },
      });

      // Create active service from vetted provider
      const activeService = await prisma.service.create({
        data: {
          provider_id: vettedProvider.id,
          categoryKey: 'cleaning',
          title: 'Active Cleaning',
          priceModel: 'fixed',
          status: 'active',
        },
      });

      // Create draft service from vetted provider (should not appear)
      await prisma.service.create({
        data: {
          provider_id: vettedProvider.id,
          categoryKey: 'cleaning',
          title: 'Draft Cleaning',
          priceModel: 'fixed',
          status: 'draft',
        },
      });

      // Create active service from unvetted provider (should not appear)
      await prisma.service.create({
        data: {
          provider_id: unvettedProvider.id,
          categoryKey: 'cleaning',
          title: 'Unvetted Cleaning',
          priceModel: 'fixed',
          status: 'active',
        },
      });

      const services = await listPublicServices(prisma, project.id);

      expect(services.length).toBe(1);
      expect(services[0].id).toBe(activeService.id);
      expect(services[0].isVetted).toBe(true);
    });

    it('should filter by category when provided', async () => {
      const vettedProvider = await prisma.provider.create({
        data: {
          name: 'Vetted Provider',
          contactEmail: 'vetted@test.com',
          contactPhone: '+1234567890',
          status: 'active',
          vetted_at: new Date(),
        },
      });

      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          slug: 'test-project',
        },
      });

      await prisma.service.create({
        data: {
          provider_id: vettedProvider.id,
          categoryKey: 'cleaning',
          title: 'Cleaning Service',
          priceModel: 'fixed',
          status: 'active',
        },
      });

      await prisma.service.create({
        data: {
          provider_id: vettedProvider.id,
          categoryKey: 'repair',
          title: 'Repair Service',
          priceModel: 'fixed',
          status: 'active',
        },
      });

      const services = await listPublicServices(prisma, project.id, {
        categoryKey: 'cleaning',
      });

      expect(services.length).toBe(1);
      expect(services[0].categoryKey).toBe('cleaning');
    });

    it('should respect project availability restrictions', async () => {
      const vettedProvider = await prisma.provider.create({
        data: {
          name: 'Vetted Provider',
          contactEmail: 'vetted@test.com',
          contactPhone: '+1234567890',
          status: 'active',
          vetted_at: new Date(),
        },
      });

      const project1 = await prisma.project.create({
        data: {
          name: 'Project 1',
          slug: 'project-1',
        },
      });

      const project2 = await prisma.project.create({
        data: {
          name: 'Project 2',
          slug: 'project-2',
        },
      });

      // Create service restricted to project1
      const restrictedService = await prisma.service.create({
        data: {
          provider_id: vettedProvider.id,
          categoryKey: 'cleaning',
          title: 'Restricted Service',
          priceModel: 'fixed',
          status: 'active',
        },
      });

      await prisma.serviceProject.create({
        data: {
          service_id: restrictedService.id,
          project_id: project1.id,
        },
      });

      // Create unrestricted service
      const unrestricted = await prisma.service.create({
        data: {
          provider_id: vettedProvider.id,
          categoryKey: 'cleaning',
          title: 'Unrestricted Service',
          priceModel: 'fixed',
          status: 'active',
        },
      });

      // Query for project1 - should see both
      const project1Services = await listPublicServices(prisma, project1.id);
      expect(project1Services.length).toBe(2);

      // Query for project2 - should see only unrestricted
      const project2Services = await listPublicServices(prisma, project2.id);
      expect(project2Services.length).toBe(1);
      expect(project2Services[0].id).toBe(unrestricted.id);
    });
  });
});
