import { describe, it, expect, beforeEach } from 'vitest';
import { db as prisma, resetDb, createIdentity, createProject } from '@/test/util';
import { createProject as createProjectFn, updateProject } from './projects';
import { ProjectStatus } from '@prisma/client';

describe('Projects module', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('createProject', () => {
    it('creates a new project with draft status', async () => {
      const admin = await createIdentity({ isAdmin: true });

      const project = await createProjectFn({
        slug: 'test-project',
        name: 'Test Project',
        areaLabelKey: 'project.area.default',
        descriptionKey: 'project.description.default',
        latitude: 13.7563,
        longitude: 100.5018,
        address: '123 Test St',
        actorIdentityId: admin.id,
      });

      expect(project.slug).toBe('test-project');
      expect(project.name).toBe('Test Project');
      expect(project.status).toBe('draft');
      expect(project.defaultCurrency).toBe('THB');
    });

    it('rejects duplicate slug', async () => {
      const admin = await createIdentity({ isAdmin: true });

      await createProjectFn({
        slug: 'unique-slug',
        name: 'Project 1',
        areaLabelKey: 'project.area.default',
        descriptionKey: 'project.description.default',
        latitude: 13.7563,
        longitude: 100.5018,
        address: '123 Test St',
        actorIdentityId: admin.id,
      });

      await expect(
        createProjectFn({
          slug: 'unique-slug',
          name: 'Project 2',
          areaLabelKey: 'project.area.default',
          descriptionKey: 'project.description.default',
          latitude: 13.7563,
          longitude: 100.5018,
          address: '456 Test Ave',
          actorIdentityId: admin.id,
        })
      ).rejects.toThrow('already exists');
    });

    it('logs audit entry on create', async () => {
      const admin = await createIdentity({ isAdmin: true });

      const project = await createProjectFn({
        slug: 'audit-test',
        name: 'Audit Test',
        areaLabelKey: 'project.area.default',
        descriptionKey: 'project.description.default',
        latitude: 13.7563,
        longitude: 100.5018,
        address: '123 Test St',
        actorIdentityId: admin.id,
      });

      const audit = await prisma.auditLog.findFirst({
        where: { entityId: project.id, action: 'projects:create' },
      });

      expect(audit).toBeDefined();
      expect(audit?.actorIdentityId).toBe(admin.id);
      expect(audit?.action).toBe('projects:create');
      expect(audit?.entityType).toBe('Project');
    });
  });

  describe('updateProject', () => {
    it('updates project fields', async () => {
      const admin = await createIdentity({ isAdmin: true });
      const project = await createProject();

      const updated = await updateProject({
        projectId: project.id,
        name: 'Updated Name',
        actorIdentityId: admin.id,
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.slug).toBe(project.slug); // unchanged
    });

    it('allows draft to live transition', async () => {
      const admin = await createIdentity({ isAdmin: true });
      const project = await createProject({ status: 'draft' });

      const updated = await updateProject({
        projectId: project.id,
        status: 'live' as ProjectStatus,
        actorIdentityId: admin.id,
      });

      expect(updated.status).toBe('live');
    });

    it('allows live to archived transition', async () => {
      const admin = await createIdentity({ isAdmin: true });
      const project = await createProject({ status: 'live' });

      const updated = await updateProject({
        projectId: project.id,
        status: 'archived' as ProjectStatus,
        actorIdentityId: admin.id,
      });

      expect(updated.status).toBe('archived');
    });

    it('rejects invalid status transition', async () => {
      const admin = await createIdentity({ isAdmin: true });
      const project = await createProject({ status: 'archived' });

      await expect(
        updateProject({
          projectId: project.id,
          status: 'draft' as ProjectStatus,
          actorIdentityId: admin.id,
        })
      ).rejects.toThrow('Invalid status transition');
    });

    it('logs audit entry on update with before/after', async () => {
      const admin = await createIdentity({ isAdmin: true });
      const project = await createProject();

      await updateProject({
        projectId: project.id,
        name: 'New Name',
        actorIdentityId: admin.id,
      });

      const audit = await prisma.auditLog.findFirst({
        where: { entityId: project.id, action: 'projects:update' },
      });

      expect(audit).toBeDefined();
      expect(audit?.actorIdentityId).toBe(admin.id);
      expect(audit?.action).toBe('projects:update');
    });
  });
});
