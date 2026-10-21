/** Disposable synthetic fixture only. Refuses every non-local/non-browser-test database. */
import { writeFileSync } from 'node:fs';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import { seedConfig } from '@/modules/config/seed';
import { setWorkspaceAdministrator } from '@/modules/core/administration.service';

async function main() {
  const target = new URL(process.env.DATABASE_URL_TEST || 'invalid:');
  if (target.hostname !== '127.0.0.1' || target.port !== '55439' || target.pathname !== '/myuno_security_browser_test' ||
    process.env.DATABASE_URL !== process.env.DATABASE_URL_TEST) throw new Error('Only the isolated local browser-test database is permitted');
  await resetDb(); await seedConfig(db);
  const password = crypto.randomBytes(24).toString('base64url');
  const hashedPassword = await bcrypt.hash(password, 10);
  const base = await createIdentity({ email: 'owner@browser.example.test', firstName: 'Synthetic', lastName: 'Owner', isAdmin: true });
  const root = await db.identity.update({ where: { id: base.id }, data: { isSuperAdmin: true, hashedPassword, emailVerifiedAt: new Date() } });
  const managerBase = await createIdentity({ email: 'manager@browser.example.test', firstName: 'Synthetic', lastName: 'Manager' });
  const manager = await db.identity.update({ where: { id: managerBase.id }, data: { hashedPassword, emailVerifiedAt: new Date() } });
  const employee = await createIdentity({ email: 'employee@browser.example.test', firstName: 'Synthetic', lastName: 'Employee' });
  await db.identity.update({ where: { id: employee.id }, data: { hashedPassword } });
  const project = await createProject({ name: 'Browser review property' });
  const unit = await createUnit({ projectId: project.id, name: 'Isolated review villa' });
  const otherUnit = await createUnit({ projectId: project.id, name: 'Other workspace villa' });
  const org = await db.organization.create({ data: { name: 'Synthetic browser operator', orgType: 'management_company',
    contactEmail: 'operator@browser.example.test', contactPhone: '+66000000000' } });
  await db.projectOrganizationRole.create({ data: { projectId: project.id, organizationId: org.id, roleKey: 'operator', provenance: 'verified' } });
  const space = await db.operatingSpace.create({ data: { key: 'browser-local-a', name: 'Local review workspace', organizationId: org.id } });
  const other = await db.operatingSpace.create({ data: { key: 'browser-local-b', name: 'Other review workspace', organizationId: org.id } });
  await db.operatingSpaceUnit.create({ data: { operatingSpaceId: space.id, unitId: unit.id, startsOn: new Date(0) } });
  await db.operatingSpaceUnit.create({ data: { operatingSpaceId: other.id, unitId: otherUnit.id, startsOn: new Date(0) } });
  await db.operatingSpaceMember.create({ data: { operatingSpaceId: space.id, identityId: employee.id } });
  await db.operatingSpaceMember.create({ data: { operatingSpaceId: other.id, identityId: employee.id } });
  await setWorkspaceAdministrator(db, root.id, space.id, manager.id, { enabled: true, expectedUpdatedAt: null });
  writeFileSync('/tmp/myuno-review-browser-fixture.json', JSON.stringify({ rootId: root.id, managerId: manager.id,
    employeeId: employee.id, spaceId: space.id, otherSpaceId: other.id, unitId: unit.id,
    rootEmail: root.email, managerEmail: manager.email, employeeEmail: employee.email, password }), { mode: 0o600 });
  console.log('Synthetic browser fixture prepared; credentials kept in a private temporary file.');
}
main().finally(() => db.$disconnect());
