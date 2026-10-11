import { PrismaClient } from '@prisma/client';
import { seedContent } from '/home/user/myUNO-final/src/modules/content/seed';
import { EXPENSE_SAFETY_KEYS } from '/home/user/myUNO-final/src/modules/content/expense-safety.seed';
import { createSessionToken } from '/home/user/myUNO-final/src/modules/auth/session';
import { createProject, createUnit, createIdentity, createBooking, createRoleAssignment, setGlobalConfig, db } from '/home/user/myUNO-final/src/test/util';
import { writeFileSync } from 'fs';
async function main() {
  await seedContent(db as PrismaClient);
  const sys = await db.identity.findFirstOrThrow({ where: { email: 'system@myuno.internal' } });
  for (const k of EXPENSE_SAFETY_KEYS) {
    const ck = await db.contentKey.upsert({ where: { key: k.key }, update: {}, create: { key: k.key, namespace: k.namespace, description: k.description } });
    for (const loc of ['en','ru','th'] as const) await db.translation.upsert({ where: { contentKeyId_locale: { contentKeyId: ck.id, locale: loc } }, update: { value: k[loc] }, create: { contentKeyId: ck.id, locale: loc, value: k[loc], status: 'ok', updatedByIdentityId: sys.id } });
  }
  await setGlobalConfig('finance.statement.service_fee_pct', 10);
  const project = await createProject({ status: 'live' });
  const admin = await createIdentity({ isAdmin: true, firstName: 'Admin' });
  const staff = await createIdentity({ firstName: 'Staff' });
  const owner = await createIdentity({ firstName: 'Owner' });
  const other = await createIdentity({ firstName: 'OtherOwner' });
  await createRoleAssignment({ identityId: staff.id, role: 'staff_ops', scopeType: 'project', projectId: project.id });
  const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id, name: 'Villa E2E' });
  await db.unitEngagement.create({ data: { unitId: unit.id, ownerIdentityId: owner.id, engagementType: 'direct_managed', status: 'active', noiCapAnnualThb: 50_000_000 } });
  await createRoleAssignment({ identityId: owner.id, role: 'owner', scopeType: 'unit', unitId: unit.id });
  await createRoleAssignment({ identityId: other.id, role: 'owner', scopeType: 'project', projectId: project.id });
  await createBooking({ unitId: unit.id, projectId: project.id, guestIdentityId: other.id, startDate: new Date('2026-07-05'), endDate: new Date('2026-07-10'), totalThb: 900_000 });
  const t = (i: {id:string}) => createSessionToken(i.id);
  writeFileSync(process.argv[2], JSON.stringify({ unitId: unit.id, tokens: { admin: t(admin), staff: t(staff), owner: t(owner), other: t(other) } }));
  console.log('seeded');
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
