import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resetDb, db, createIdentity, createProject, createUnit, createUnitEngagement, createRoleAssignment } from '@/test/util';

describe('T-002 · Database bootstrap · spine chain', () => {
  beforeAll(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('creates a project → unit → identity → role chain and verifies relationships', async () => {
    // Step 1: Create an identity (owner)
    const owner = await createIdentity({
      firstName: 'John',
      lastName: 'Owner',
      email: 'owner@example.com',
    });
    expect(owner).toBeDefined();
    expect(owner.id).toBeDefined();
    expect(owner.firstName).toBe('John');

    // Step 2: Create a project
    const project = await createProject({
      slug: 'test-project',
      name: 'Test Development',
    });
    expect(project).toBeDefined();
    expect(project.id).toBeDefined();
    expect(project.slug).toBe('test-project');

    // Step 3: Create a unit within the project owned by the identity
    const unit = await createUnit({
      projectId: project.id,
      ownerIdentityId: owner.id,
      name: 'Villa A-101',
      status: 'draft',
    });
    expect(unit).toBeDefined();
    expect(unit.id).toBeDefined();
    expect(unit.projectId).toBe(project.id);
    expect(unit.ownerIdentityId).toBe(owner.id);

    // Step 4: Create a unit engagement (how the unit is on the platform)
    const engagement = await createUnitEngagement({
      unitId: unit.id,
      ownerIdentityId: owner.id,
      type: 'direct_managed',
      status: 'draft',
    });
    expect(engagement).toBeDefined();
    expect(engagement.unitId).toBe(unit.id);
    expect(engagement.ownerIdentityId).toBe(owner.id);
    expect(engagement.engagementType).toBe('direct_managed');

    // Step 5: Create a role assignment (owner role scoped to the unit)
    const roleAssignment = await createRoleAssignment({
      identityId: owner.id,
      role: 'owner',
      scopeType: 'unit',
      projectId: project.id,
      unitId: unit.id,
    });
    expect(roleAssignment).toBeDefined();
    expect(roleAssignment.identityId).toBe(owner.id);
    expect(roleAssignment.role).toBe('owner');
    expect(roleAssignment.scopeType).toBe('unit');
    expect(roleAssignment.unitId).toBe(unit.id);

    // Verify the complete chain by reloading and checking relationships
    const loadedIdentity = await db.identity.findUnique({
      where: { id: owner.id },
      include: {
        ownedUnits: true,
        roleAssignments: true,
      },
    });
    expect(loadedIdentity).toBeDefined();
    expect(loadedIdentity?.ownedUnits).toHaveLength(1);
    expect(loadedIdentity?.ownedUnits[0].id).toBe(unit.id);
    expect(loadedIdentity?.roleAssignments).toHaveLength(1);
    expect(loadedIdentity?.roleAssignments[0].id).toBe(roleAssignment.id);

    const loadedUnit = await db.unit.findUnique({
      where: { id: unit.id },
      include: {
        project: true,
        owner: true,
        engagements: true,
        roleAssignments: true,
      },
    });
    expect(loadedUnit).toBeDefined();
    expect(loadedUnit?.project.id).toBe(project.id);
    expect(loadedUnit?.owner?.id).toBe(owner.id);
    expect(loadedUnit?.engagements).toHaveLength(1);
    expect(loadedUnit?.engagements[0].id).toBe(engagement.id);
    expect(loadedUnit?.roleAssignments).toHaveLength(1);
    expect(loadedUnit?.roleAssignments[0].id).toBe(roleAssignment.id);

    const loadedProject = await db.project.findUnique({
      where: { id: project.id },
      include: {
        units: true,
      },
    });
    expect(loadedProject).toBeDefined();
    expect(loadedProject?.units).toHaveLength(1);
    expect(loadedProject?.units[0].id).toBe(unit.id);

    // Verify the engagement
    const loadedEngagement = await db.unitEngagement.findUnique({
      where: { id: engagement.id },
      include: {
        unit: true,
        owner: true,
      },
    });
    expect(loadedEngagement).toBeDefined();
    expect(loadedEngagement?.unit.id).toBe(unit.id);
    expect(loadedEngagement?.owner.id).toBe(owner.id);
  });

  it('enforces foreign key constraints on cascading deletes', async () => {
    // Create an identity with dependent roles
    const identity = await createIdentity({
      email: `cascade-${Date.now()}@example.com`,
    });
    const project = await createProject();
    const unit = await createUnit({
      projectId: project.id,
      ownerIdentityId: identity.id,
    });

    const role1 = await createRoleAssignment({
      identityId: identity.id,
      role: 'owner',
      scopeType: 'unit',
      projectId: project.id,
      unitId: unit.id,
    });

    // Verify role exists
    let existing = await db.roleAssignment.findUnique({ where: { id: role1.id } });
    expect(existing).toBeDefined();

    // Delete the identity
    await db.identity.delete({ where: { id: identity.id } });

    // Verify the role was also deleted (cascade)
    existing = await db.roleAssignment.findUnique({ where: { id: role1.id } });
    expect(existing).toBeNull();
  });
});
