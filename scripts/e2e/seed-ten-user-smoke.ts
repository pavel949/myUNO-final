import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
createRequire(resolve('scripts/e2e/seed-ten-user-smoke.ts'))('./isolation.cjs').assertIsolation();

async function main() {
  const { db, createIdentity, createProject, createUnit, createRegulatoryEvidence } = await import('@/test/util');
  const { hash } = await import('bcryptjs');
  try {
    const database = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    assert.equal(database[0]?.name, 'myuno_browser_test');
    const fixture = JSON.parse(await readFile('browser-results/fixture.json', 'utf8'));
    const baseline = JSON.parse(await readFile('browser-results/result.json', 'utf8'));
    assert.equal(baseline.steps.length, 22);
    assert.ok(baseline.steps.every((step: { status: string }) => step.status === 'passed'));
    const founder = await db.identity.findUniqueOrThrow({ where: { email: fixture.founderEmail } });
    assert.equal(founder.email, 'founder@browser.example.test'); assert.equal(founder.isAdmin, true);
    const target = await db.unit.findUniqueOrThrow({ where: { id: fixture.unitId } });
    assert.equal(target.projectId, fixture.projectId); assert.equal(target.instantBook, true);
    assert.ok(target.ownerIdentityId);
    const managerEmail = 'limited-manager@browser.example.test';
    assert.equal(await db.identity.count({ where: { email: managerEmail } }), 0, 'Never reset or reuse an existing fixture');
    const manager = await createIdentity({ email: managerEmail, firstName: 'Synthetic', lastName: 'Limited Manager', isAdmin: false });
    const guests = [];
    for (let i = 1; i <= 8; i++) {
      const email = `concurrent-guest-${i}@browser.example.test`;
      assert.equal(await db.identity.count({ where: { email } }), 0);
      guests.push(await createIdentity({ email, firstName: 'Synthetic Concurrent', lastName: String(i), isAdmin: false }));
    }
    await db.identity.updateMany({ where: { id: { in: [manager.id, ...guests.map(guest => guest.id)] } },
      data: { hashedPassword: await hash(fixture.password, 10), emailVerifiedAt: new Date() } });
    const organization = await db.organization.create({ data: { name: 'Synthetic Limited Management',
      orgType: 'management_company', projectId: fixture.projectId, contactEmail: 'limited-mc@browser.example.test', contactPhone: '', status: 'active' } });
    await db.roleAssignment.create({ data: { identityId: manager.id, role: 'mc_member', scopeType: 'project',
      projectId: fixture.projectId, organizationId: organization.id, status: 'active', grantedByIdentityId: founder.id } });
    // A is covered by the manager's own evidenced mandate; original villa B is
    // in the same project but has no such mandate. C belongs to another project.
    // These access-only draft assets are never exposed as guest-ready inventory.
    const managedUnit = await createUnit({ projectId: fixture.projectId, ownerIdentityId: target.ownerIdentityId,
      name: 'Synthetic Limited Manager Home', status: 'draft', categoryKey: 'synthetic_manager_scope', instantBook: true });
    const foreignProject = await createProject({ slug: 'synthetic-foreign-manager-scope', name: 'Synthetic Foreign Scope', status: 'live' });
    const foreignUnit = await createUnit({ projectId: foreignProject.id, ownerIdentityId: target.ownerIdentityId,
      name: 'Synthetic Foreign Home', status: 'draft', categoryKey: 'synthetic_foreign_scope', instantBook: true });
    const evidence = await createRegulatoryEvidence(founder.id);
    const startsOn = new Date(Date.now() - 86_400_000);
    await db.unitEngagement.create({ data: { unitId: managedUnit.id, ownerIdentityId: target.ownerIdentityId,
      engagementType: 'via_management_company', managementOrgId: organization.id, mandateMediaId: evidence.id, startsOn, status: 'active' } });
    const space = await db.operatingSpace.create({ data: { key: 'synthetic-limited-manager-smoke', name: 'Synthetic Limited Manager Space',
      organizationId: organization.id, status: 'active', timezone: 'Asia/Bangkok',
      units: { create: [managedUnit.id, target.id].map(unitId => ({ unitId, startsOn, active: true })) } } });
    await db.operatingSpaceMember.create({ data: { operatingSpaceId: space.id, identityId: manager.id, active: true,
      capabilities: ['manage_tasks', 'manage_housekeeping', 'manage_maintenance'] } });
    // No manage_reservations/view_calendar capability, admin flag, broad staff
    // role, or existing identity/mandate mutation is used for this MC test.
    await writeFile('browser-results/ten-user-fixture.json', JSON.stringify({
      synthetic: true, managerId: manager.id, managerEmail, organizationId: organization.id,
      managedUnitId: managedUnit.id, managedUnitName: managedUnit.name,
      deniedUnitId: target.id, deniedUnitName: target.name, foreignUnitId: foreignUnit.id, foreignUnitName: foreignUnit.name,
      operatingSpaceId: space.id, guests: guests.map(guest => ({ id: guest.id, email: guest.email })),
    }, null, 2));
    console.log('Synthetic ten-user identities and bounded manager mandate prepared; no booking created by setup.');
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
