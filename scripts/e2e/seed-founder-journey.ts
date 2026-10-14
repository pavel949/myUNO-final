import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const localRequire = createRequire(resolve('scripts/e2e/seed-founder-journey.ts'));
localRequire('./isolation.cjs').assertIsolation();

async function main() {
  // Dynamic imports keep the safety check before any Prisma client is made.
  const { db, createIdentity, createProject, createUnit, createRegulatoryEvidence } = await import('@/test/util');
  const { seedConfig } = await import('@/modules/config/seed');
  const { seedContent } = await import('@/modules/content/seed');
  const { hash } = await import('bcryptjs');
  const { createRegulatoryCredential } = await import('@/modules/compliance');
  const { getPropertyReadiness } = await import('@/modules/projects/property-readiness');
  const { MOBILIZATION_STEPS } = await import('@/modules/core');
  try {
    const name = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    if (name[0]?.name !== 'myuno_browser_test') throw new Error('Wrong connected database');
    if (await db.identity.findUnique({ where: { email: 'founder@browser.example.test' } })) {
      throw new Error('Fixture already exists. Start with a fresh disposable database; this runner never resets data.');
    }
    await seedConfig(db);
    const founder = await createIdentity({ email: 'founder@browser.example.test', firstName: 'Synthetic', lastName: 'Founder', isAdmin: true });
    const owner = await createIdentity({ email: 'owner@browser.example.test', firstName: 'Synthetic', lastName: 'Owner' });
    const guest = await createIdentity({ email: 'guest@browser.example.test', firstName: 'Synthetic', lastName: 'Guest' });
    const staff = await createIdentity({ email: 'staff@browser.example.test', firstName: 'Synthetic', lastName: 'Staff' });
    const password = 'SyntheticBrowserOnly!47';
    const hashedPassword = await hash(password, 10);
    await db.identity.updateMany({ where: { id: { in: [founder.id, guest.id, staff.id] } }, data: { hashedPassword, emailVerifiedAt: new Date() } });
    await seedContent(db, founder.id);
    const area = await db.area.create({ data: { slug: 'synthetic-browser-area', nameKey: 'browser.area', status: 'live' } });
    const project = await createProject({ slug: 'synthetic-browser-estate', name: 'Synthetic Browser Estate', status: 'live', areaId: area.id, latitude: '8.01', longitude: '98.30' });
    await db.project.update({ where: { id: project.id }, data: { projectType: 'villa_estate' } });
    const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id,
      name: 'Synthetic Browser Villa', status: 'draft', categoryKey: 'synthetic_browser_1br',
      bedrooms: 1, maxGuests: 2, baseNightlyThb: 200000, minNights: 1, instantBook: true });
    // Existing operational context only. The browser must create the reservation.
    const organization = await db.organization.create({ data: {
      name: 'Synthetic Browser Operations', orgType: 'management_company',
      projectId: project.id, contactEmail: 'operations@browser.example.test',
      contactPhone: '', status: 'active',
    } });
    // Synthetic existing operator authority; membership/attachment alone grants no operating mandate.
    await db.projectOrganizationRole.create({ data: {
      projectId: project.id, organizationId: organization.id,
      roleKey: 'operator', provenance: 'verified', effectiveFrom: new Date(),
    } });
    const operatingSpace = await db.operatingSpace.create({ data: {
      key: 'synthetic-browser-operations', name: 'Synthetic Browser Operations',
      organizationId: organization.id, status: 'active', timezone: 'Asia/Bangkok',
      units: { create: { unitId: unit.id, active: true, startsOn: new Date() } },
    } });
    // Scoped synthetic employee only. The browser creates and completes the task.
    await db.roleAssignment.create({ data: {
      identityId: staff.id, role: 'staff_ops', scopeType: 'project',
      projectId: project.id, status: 'active', grantedByIdentityId: founder.id,
    } });
    await db.projectStaffPermission.create({ data: {
      projectId: project.id, identityId: staff.id,
      departments: ['housekeeping', 'maintenance'],
    } });
    await db.operatingSpaceMember.create({ data: {
      operatingSpaceId: operatingSpace.id, identityId: staff.id, active: true,
      capabilities: ['manage_tasks', 'assign_tasks', 'manage_housekeeping', 'manage_maintenance', 'view_calendar'],
    } });
    const descriptionKey = 'browser_acceptance.villa.description';
    const content = await db.contentKey.create({ data: { key: descriptionKey, namespace: 'browser_acceptance', description: 'Synthetic browser fixture only' } });
    await db.translation.create({ data: { contentKeyId: content.id, locale: 'en', value: 'Original synthetic description.', status: 'ok', updatedByIdentityId: founder.id } });
    const evidence = await createRegulatoryEvidence(founder.id);
    await createRegulatoryCredential(db, { credentialType: 'hotel_business_license', scopeLevel: 'unit', unitId: unit.id, evidenceMediaId: evidence.id, verifiedByIdentityId: founder.id, notes: 'Synthetic fixture only; no real legal attestation.' });
    await db.unit.update({ where: { id: unit.id }, data: { descriptionKey, permittedUseConfirmedAt: new Date() } });
    await db.complianceRecord.create({ data: { unitId: unit.id, recordType: 'permitted_use', status: 'confirmed', label: 'Synthetic fixture only' } });
    await db.unitEngagement.create({ data: { unitId: unit.id, ownerIdentityId: owner.id, engagementType: 'owner_direct', status: 'active', mandateMediaId: evidence.id } });
    await db.mobilizationChecklistItem.createMany({ data: MOBILIZATION_STEPS.map(step => ({ unitId: unit.id, step, status: 'done' as const, completedByIdentityId: founder.id, completedAt: new Date(), notes: 'Pre-onboarded synthetic fixture; this is not wizard acceptance.' })) });
    await db.sleepingSpace.create({ data: { unitId: unit.id, name: 'Synthetic bedroom', beds: { create: { bedType: 'king', count: 1 } } } });
    await db.commercialOffering.create({ data: { projectId: project.id, unitId: unit.id, offeringType: 'short_term_stay', status: 'active' } });

    // Real local PNG bytes, no hosted media, no Blob credentials or HTTP mocks.
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');
    await mkdir('public/browser-acceptance', { recursive: true });
    for (const scope of ['project', 'category', 'unit'] as const) {
      const ids: string[] = [];
      for (let i = 0; i < 3; i++) {
        const path = `/browser-acceptance/${scope}-${i}.png`;
        await writeFile(`public${path}`, png);
        const asset = await db.mediaAsset.create({ data: { storageKey: path, kind: 'photo', mimeType: 'image/png', encrypted: false, sizeBytes: png.length, uploadedByIdentityId: founder.id } });
        ids.push(asset.id);
        if (scope === 'project') await db.projectMedia.create({ data: { projectId: project.id, mediaId: asset.id, sort: i } });
        if (scope === 'category') await db.inventoryCategoryMedia.create({ data: { categoryId: unit.inventoryCategoryId!, mediaId: asset.id, sort: i } });
        if (scope === 'unit') await db.unitMedia.create({ data: { unitId: unit.id, mediaId: asset.id, sort: i } });
      }
      if (scope === 'project') await db.project.update({ where: { id: project.id }, data: { coverMediaId: ids[0] } });
      if (scope === 'category') await db.inventoryCategory.update({ where: { id: unit.inventoryCategoryId! }, data: { coverMediaId: ids[0] } });
      if (scope === 'unit') await db.unit.update({ where: { id: unit.id }, data: { coverMediaId: ids[0] } });
    }
    // Separate canonical category/home keeps the original 1234/3702 regression
    // unchanged while the browser exercises a bounded seasonal override.
    const tariffUnit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id,
      name: 'Synthetic Seasonal Villa', status: 'draft', categoryKey: 'synthetic_seasonal_1br',
      bedrooms: 1, maxGuests: 2, baseNightlyThb: 200000, minNights: 1, instantBook: true });
    const tariffDescriptionKey = 'browser_acceptance.seasonal.description';
    const tariffContent = await db.contentKey.create({ data: { key: tariffDescriptionKey, namespace: 'browser_acceptance', description: 'Synthetic seasonal browser fixture only' } });
    await db.translation.create({ data: { contentKeyId: tariffContent.id, locale: 'en', value: 'Synthetic villa for saved base and holiday pricing acceptance.', status: 'ok', updatedByIdentityId: founder.id } });
    await createRegulatoryCredential(db, { credentialType: 'hotel_business_license', scopeLevel: 'unit', unitId: tariffUnit.id, evidenceMediaId: evidence.id, verifiedByIdentityId: founder.id, notes: 'Synthetic fixture only; no real legal attestation.' });
    await db.unit.update({ where: { id: tariffUnit.id }, data: { descriptionKey: tariffDescriptionKey, permittedUseConfirmedAt: new Date() } });
    await db.complianceRecord.create({ data: { unitId: tariffUnit.id, recordType: 'permitted_use', status: 'confirmed', label: 'Synthetic fixture only' } });
    await db.unitEngagement.create({ data: { unitId: tariffUnit.id, ownerIdentityId: owner.id, engagementType: 'owner_direct', status: 'active', mandateMediaId: evidence.id } });
    await db.mobilizationChecklistItem.createMany({ data: MOBILIZATION_STEPS.map(step => ({ unitId: tariffUnit.id, step, status: 'done' as const, completedByIdentityId: founder.id, completedAt: new Date(), notes: 'Pre-onboarded synthetic fixture; not wizard acceptance.' })) });
    await db.sleepingSpace.create({ data: { unitId: tariffUnit.id, name: 'Synthetic seasonal bedroom', beds: { create: { bedType: 'king', count: 1 } } } });
    await db.commercialOffering.create({ data: { projectId: project.id, unitId: tariffUnit.id, offeringType: 'short_term_stay', status: 'active' } });
    const localMedia = await db.unitMedia.findMany({ where: { unitId: unit.id }, orderBy: { sort: 'asc' } });
    for (const media of localMedia) {
      await db.unitMedia.create({ data: { unitId: tariffUnit.id, mediaId: media.mediaId, sort: media.sort } });
      await db.inventoryCategoryMedia.create({ data: { categoryId: tariffUnit.inventoryCategoryId!, mediaId: media.mediaId, sort: media.sort } });
    }
    await db.unit.update({ where: { id: tariffUnit.id }, data: { coverMediaId: localMedia[0].mediaId } });
    await db.inventoryCategory.update({ where: { id: tariffUnit.inventoryCategoryId! }, data: { coverMediaId: localMedia[0].mediaId } });
    await db.operatingSpace.update({ where: { id: operatingSpace.id }, data: { units: { create: { unitId: tariffUnit.id, active: true, startsOn: new Date() } } } });

    const readiness = await getPropertyReadiness(db, project.id);
    if (!readiness || readiness.blockers.length) throw new Error(`Fixture prerequisites incomplete: ${JSON.stringify(readiness?.blockers)}`);
    const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
    await mkdir('browser-results', { recursive: true });
    const thisYear = new Date().getUTCFullYear();
    const seasonalYear = Date.parse(`${thisYear}-12-19T00:00:00Z`) > Date.now() + 2 * 86400000 ? thisYear : thisYear + 1;
    await writeFile('browser-results/fixture.json', JSON.stringify({ unitId: unit.id, unitName: unit.name, projectId: project.id, guestId: guest.id, contentId: content.id, descriptionKey, founderEmail: founder.email, guestEmail: guest.email, password, startDate: day(45), endDate: day(48), operatingSpaceId: operatingSpace.id, manualStartDate: day(52), manualEndDate: day(55), staffId: staff.id, staffEmail: staff.email, taskDueAt: `${day(2)}T12:00`, taskExpectedDueAt: `${day(2)}T05:00:00.000Z`, taskTimeZone: operatingSpace.timezone, tariffUnitId: tariffUnit.id, tariffUnitName: tariffUnit.name, tariffStartDate: `${seasonalYear}-12-19`, tariffEndDate: `${seasonalYear}-12-22` }, null, 2));
    console.log('Synthetic canonical draft fixture ready; no unit published or booking created by setup.');
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

