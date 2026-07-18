import { PrismaClient, Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';

/**
 * Seed demo data: founder, staff, units, guests, providers — full walkthrough environment.
 * Call after config/content seeds (depends on ConfigParameter rows for defaults).
 */
export async function seedDemoData(db: PrismaClient) {
  // 1. Create the demo project: Ignatev Estate showcase
  const project = await db.project.upsert({
    where: { slug: 'ignatev-showcase' },
    create: {
      slug: 'ignatev-showcase',
      name: 'Ignatev Estate',
      areaLabelKey: 'project.ignatev.location',
      descriptionKey: 'project.ignatev.description',
      latitude: new Prisma.Decimal('8.6883'),
      longitude: new Prisma.Decimal('98.3997'),
      address: '99/1 Moo 1, Tambol Layan, Phuket 83100',
      timezone: 'Asia/Bangkok',
      amenityKeys: ['wifi', 'pool', 'gym', 'concierge', 'housekeeping'],
      handbookKey: 'project.ignatev.handbook',
      status: 'live',
    },
    update: {},
  });

  // 2. Create demo identities for each role
  await db.identity.upsert({
    where: { email: 'admin@ignatev.test' },
    create: {
      email: 'admin@ignatev.test',
      emailVerifiedAt: new Date(),
      firstName: 'Founder',
      lastName: 'Admin',
      preferredLocale: 'en',
      hashedPassword: await hash('password123', 12),
      isAdmin: true,
      status: 'active',
    },
    update: {},
  });

  const staffOpsIdentity = await db.identity.upsert({
    where: { email: 'ops@ignatev.test' },
    create: {
      email: 'ops@ignatev.test',
      emailVerifiedAt: new Date(),
      firstName: 'Operations',
      lastName: 'Staff',
      preferredLocale: 'en',
      hashedPassword: await hash('password123', 12),
      status: 'active',
    },
    update: {},
  });

  const onsiteHostIdentity = await db.identity.upsert({
    where: { email: 'host@ignatev.test' },
    create: {
      email: 'host@ignatev.test',
      emailVerifiedAt: new Date(),
      firstName: 'Concierge',
      lastName: 'Host',
      preferredLocale: 'en',
      hashedPassword: await hash('password123', 12),
      status: 'active',
    },
    update: {},
  });

  const ownerIdentity = await db.identity.upsert({
    where: { email: 'owner@ignatev.test' },
    create: {
      email: 'owner@ignatev.test',
      emailVerifiedAt: new Date(),
      firstName: 'Property',
      lastName: 'Owner',
      preferredLocale: 'en',
      hashedPassword: await hash('password123', 12),
      status: 'active',
    },
    update: {},
  });

  const guestIdentity = await db.identity.upsert({
    where: { email: 'guest@ignatev.test' },
    create: {
      email: 'guest@ignatev.test',
      emailVerifiedAt: new Date(),
      firstName: 'Guest',
      lastName: 'Visitor',
      preferredLocale: 'en',
      hashedPassword: await hash('password123', 12),
      status: 'active',
    },
    update: {},
  });

  const residentIdentity = await db.identity.upsert({
    where: { email: 'resident@ignatev.test' },
    create: {
      email: 'resident@ignatev.test',
      emailVerifiedAt: new Date(),
      firstName: 'Long',
      lastName: 'Term',
      preferredLocale: 'en',
      hashedPassword: await hash('password123', 12),
      status: 'active',
    },
    update: {},
  });

  await db.identity.upsert({
    where: { email: 'buyer@ignatev.test' },
    create: {
      email: 'buyer@ignatev.test',
      emailVerifiedAt: new Date(),
      firstName: 'Prospective',
      lastName: 'Buyer',
      preferredLocale: 'en',
      hashedPassword: await hash('password123', 12),
      status: 'active',
    },
    update: {},
  });

  const providerIdentity = await db.identity.upsert({
    where: { email: 'provider@ignatev.test' },
    create: {
      email: 'provider@ignatev.test',
      emailVerifiedAt: new Date(),
      firstName: 'Service',
      lastName: 'Provider',
      preferredLocale: 'en',
      hashedPassword: await hash('password123', 12),
      status: 'active',
    },
    update: {},
  });

  const mcMemberIdentity = await db.identity.upsert({
    where: { email: 'mc@ignatev.test' },
    create: {
      email: 'mc@ignatev.test',
      emailVerifiedAt: new Date(),
      firstName: 'MC',
      lastName: 'Manager',
      preferredLocale: 'en',
      hashedPassword: await hash('password123', 12),
      status: 'active',
    },
    update: {},
  });

  const juristicIdentity = await db.identity.upsert({
    where: { email: 'juristic@ignatev.test' },
    create: {
      email: 'juristic@ignatev.test',
      emailVerifiedAt: new Date(),
      firstName: 'Legal',
      lastName: 'Entity',
      preferredLocale: 'en',
      hashedPassword: await hash('password123', 12),
      status: 'active',
    },
    update: {},
  });

  // 3. Create role assignments for staff in the project
  let staffOpsRole = await db.roleAssignment.findFirst({
    where: {
      identityId: staffOpsIdentity.id,
      role: 'staff_ops',
      scopeType: 'project',
      projectId: project.id,
      unitId: null,
    },
  });
  if (!staffOpsRole) {
    staffOpsRole = await db.roleAssignment.create({
      data: {
        identityId: staffOpsIdentity.id,
        role: 'staff_ops',
        scopeType: 'project',
        projectId: project.id,
      },
    });
  }

  let onsiteHostRole = await db.roleAssignment.findFirst({
    where: {
      identityId: onsiteHostIdentity.id,
      role: 'onsite_host',
      scopeType: 'project',
      projectId: project.id,
      unitId: null,
    },
  });
  if (!onsiteHostRole) {
    onsiteHostRole = await db.roleAssignment.create({
      data: {
        identityId: onsiteHostIdentity.id,
        role: 'onsite_host',
        scopeType: 'project',
        projectId: project.id,
      },
    });
  }

  // 4. Create MC and juristic organizations
  const managementCo = await db.organization.upsert({
    where: { id: project.id + '-mc-demo' },
    create: {
      id: project.id + '-mc-demo',
      name: 'Demo Management Company',
      orgType: 'management_company',
      contactEmail: 'mc@ignatev.test',
      contactPhone: '+66812345678',
    },
    update: {},
  });

  const juristicCo = await db.organization.upsert({
    where: { id: project.id + '-jur-demo' },
    create: {
      id: project.id + '-jur-demo',
      name: 'Ignatev Estate LLC',
      orgType: 'juristic_person',
      contactEmail: 'legal@ignatev.test',
      contactPhone: '+66987654321',
    },
    update: {},
  });

  // MC and juristic member roles
  let mcRole = await db.roleAssignment.findFirst({
    where: {
      identityId: mcMemberIdentity.id,
      role: 'mc_member',
      scopeType: 'project',
      projectId: project.id,
      unitId: null,
    },
  });
  if (!mcRole) {
    mcRole = await db.roleAssignment.create({
      data: {
        identityId: mcMemberIdentity.id,
        role: 'mc_member',
        scopeType: 'project',
        projectId: project.id,
        organizationId: managementCo.id,
      },
    });
  } else {
    await db.roleAssignment.update({
      where: { id: mcRole.id },
      data: { organizationId: managementCo.id },
    });
  }

  let juristicRole = await db.roleAssignment.findFirst({
    where: {
      identityId: juristicIdentity.id,
      role: 'juristic_member',
      scopeType: 'project',
      projectId: project.id,
      unitId: null,
    },
  });
  if (!juristicRole) {
    juristicRole = await db.roleAssignment.create({
      data: {
        identityId: juristicIdentity.id,
        role: 'juristic_member',
        scopeType: 'project',
        projectId: project.id,
        organizationId: juristicCo.id,
      },
    });
  } else {
    await db.roleAssignment.update({
      where: { id: juristicRole.id },
      data: { organizationId: juristicCo.id },
    });
  }

  // 5. Create demo units across engagement types
  const unitDirect = await db.unit.upsert({
    where: { projectId_name: { projectId: project.id, name: 'Villa A' } },
    create: {
      projectId: project.id,
      ownerIdentityId: ownerIdentity.id,
      name: 'Villa A',
      unitType: 'villa',
      bedrooms: 3,
      bathrooms: 2,
      maxGuests: 6,
      sizeSqm: 250,
      addressSupplement: 'Villa Wing A',
      descriptionKey: 'unit.demo.villa',
      amenityKeys: ['wifi', 'pool', 'kitchen'],
      baseNightlyThb: 500000,
      minNights: 1,
      instantBook: true,
      status: 'live',
      permittedUseConfirmedAt: new Date(),
    },
    update: { ownerIdentityId: ownerIdentity.id },
  });

  const unitMC = await db.unit.upsert({
    where: { projectId_name: { projectId: project.id, name: 'Condo B-101' } },
    create: {
      projectId: project.id,
      ownerIdentityId: ownerIdentity.id,
      name: 'Condo B-101',
      unitType: 'condo',
      bedrooms: 2,
      bathrooms: 1,
      maxGuests: 4,
      sizeSqm: 120,
      floor: '1',
      addressSupplement: 'Building B, Unit 101',
      descriptionKey: 'unit.demo.condo',
      amenityKeys: ['wifi', 'gym'],
      baseNightlyThb: 300000,
      minNights: 2,
      instantBook: false,
      status: 'live',
      permittedUseConfirmedAt: new Date(),
    },
    update: { ownerIdentityId: ownerIdentity.id },
  });

  const unitOwnerDirect = await db.unit.upsert({
    where: { projectId_name: { projectId: project.id, name: 'Townhouse C' } },
    create: {
      projectId: project.id,
      ownerIdentityId: ownerIdentity.id,
      name: 'Townhouse C',
      unitType: 'townhouse',
      bedrooms: 2,
      bathrooms: 2,
      maxGuests: 4,
      sizeSqm: 180,
      addressSupplement: 'Townhouse Row C',
      descriptionKey: 'unit.demo.townhouse',
      amenityKeys: ['wifi', 'pool', 'parking'],
      baseNightlyThb: 350000,
      minNights: 3,
      instantBook: true,
      status: 'live',
      permittedUseConfirmedAt: new Date(),
    },
    update: { ownerIdentityId: ownerIdentity.id },
  });

  // 5b. Demo unit photos (cover + gallery rows)
  const demoPhotos: Array<{ unit: { id: string }; path: string }> = [
    { unit: unitDirect, path: '/demo/villa-a.svg' },
    { unit: unitMC, path: '/demo/condo-b.svg' },
    { unit: unitOwnerDirect, path: '/demo/townhouse-c.svg' },
  ];
  for (const photo of demoPhotos) {
    const asset = await db.mediaAsset.upsert({
      where: { storageKey: photo.path },
      create: {
        storageKey: photo.path,
        kind: 'photo',
        mimeType: 'image/svg+xml',
        sizeBytes: 2048,
        uploadedByIdentityId: ownerIdentity.id,
      },
      update: {},
    });
    await db.unitMedia.upsert({
      where: { unitId_mediaId: { unitId: photo.unit.id, mediaId: asset.id } },
      create: { unitId: photo.unit.id, mediaId: asset.id, sort: 0 },
      update: {},
    });
    await db.unit.update({
      where: { id: photo.unit.id },
      data: { coverMediaId: asset.id },
    });
  }

  // 6. Create unit engagements (three types)
  await db.unitEngagement.upsert({
    where: { id: unitDirect.id + '-direct' },
    create: {
      id: unitDirect.id + '-direct',
      unitId: unitDirect.id,
      engagementType: 'direct_managed',
      ownerIdentityId: ownerIdentity.id,
      noiCapAnnualThb: 15000000,
      status: 'active',
    },
    update: { status: 'active' },
  });

  await db.unitEngagement.upsert({
    where: { id: unitMC.id + '-mc' },
    create: {
      id: unitMC.id + '-mc',
      unitId: unitMC.id,
      engagementType: 'via_management_company',
      ownerIdentityId: ownerIdentity.id,
      managementOrgId: managementCo.id,
      status: 'active',
    },
    update: { status: 'active', managementOrgId: managementCo.id },
  });

  await db.unitEngagement.upsert({
    where: { id: unitOwnerDirect.id + '-owner' },
    create: {
      id: unitOwnerDirect.id + '-owner',
      unitId: unitOwnerDirect.id,
      engagementType: 'owner_direct',
      ownerIdentityId: ownerIdentity.id,
      status: 'active',
    },
    update: { status: 'active' },
  });

  // 7. Create owner role assignments
  for (const unit of [unitDirect, unitMC, unitOwnerDirect]) {
    let ownerRole = await db.roleAssignment.findFirst({
      where: {
        identityId: ownerIdentity.id,
        role: 'owner',
        scopeType: 'unit',
        unitId: unit.id,
      },
    });
    if (!ownerRole) {
      await db.roleAssignment.create({
        data: {
          identityId: ownerIdentity.id,
          role: 'owner',
          scopeType: 'unit',
          unitId: unit.id,
        },
      });
    }
  }

  // 8. Create guest and resident roles
  let guestRole = await db.roleAssignment.findFirst({
    where: {
      identityId: guestIdentity.id,
      role: 'guest',
      scopeType: 'project',
      projectId: project.id,
      unitId: null,
    },
  });
  if (!guestRole) {
    await db.roleAssignment.create({
      data: {
        identityId: guestIdentity.id,
        role: 'guest',
        scopeType: 'project',
        projectId: project.id,
      },
    });
  }

  let residentRole = await db.roleAssignment.findFirst({
    where: {
      identityId: residentIdentity.id,
      role: 'resident',
      scopeType: 'project',
      projectId: project.id,
      unitId: null,
    },
  });
  if (!residentRole) {
    await db.roleAssignment.create({
      data: {
        identityId: residentIdentity.id,
        role: 'resident',
        scopeType: 'project',
        projectId: project.id,
      },
    });
  }

  // 9. Create a demo provider
  const provider = await db.provider.upsert({
    where: { id: 'demo-provider-1' },
    create: {
      id: 'demo-provider-1',
      name: 'Demo Cleaning Service',
      description: 'Professional cleaning and housekeeping services',
      contactEmail: providerIdentity.email!,
      contactPhone: '+66812345678',
      // 'active' + vetted so the demo service is actually visible in the
      // marketplace — GET /api/services filters provider.status='active'.
      status: 'active',
      vetted_at: new Date(),
    },
    update: { status: 'active', vetted_at: new Date() },
  });

  let providerRole = await db.roleAssignment.findFirst({
    where: {
      identityId: providerIdentity.id,
      role: 'provider_member',
      scopeType: 'platform',
      providerId: provider.id,
    },
  });
  if (!providerRole) {
    providerRole = await db.roleAssignment.create({
      data: {
        identityId: providerIdentity.id,
        role: 'provider_member',
        scopeType: 'platform',
        providerId: provider.id,
      },
    });
  } else {
    await db.roleAssignment.update({
      where: { id: providerRole.id },
      data: { providerId: provider.id },
    });
  }

  // 10. Create demo service
  const service = await db.service.upsert({
    where: { id: 'demo-service-cleaning' },
    create: {
      id: 'demo-service-cleaning',
      provider_id: provider.id,
      categoryKey: 'cleaning',
      title: 'Cleaning Service',
      description: 'Professional unit cleaning',
      priceModel: 'fixed',
      basePriceThb: 50000,
      durationMin: 120,
      status: 'active',
    },
    update: { status: 'active' },
  });

  // 11. Create integration accounts for iCal
  let icalAccount = await db.integrationAccount.findFirst({
    where: {
      integrationKey: 'ical_airbnb',
      scopeType: 'unit',
      unitId: unitDirect.id,
    },
  });
  if (!icalAccount) {
    icalAccount = await db.integrationAccount.create({
      data: {
        integrationKey: 'ical_airbnb',
        scopeType: 'unit',
        unitId: unitDirect.id,
        config: { url: 'https://www.airbnb.com/calendar/export.ics?id=12345' },
        status: 'active',
        lastSyncAt: new Date(),
      },
    });
  } else {
    await db.integrationAccount.update({
      where: { id: icalAccount.id },
      data: { status: 'active', lastSyncAt: new Date() },
    });
  }

  // 12. Create demo pricing rules and blocked dates
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  await db.pricingRule.upsert({
    where: { id: 'pricing-rule-1' },
    create: {
      id: 'pricing-rule-1',
      unitId: unitDirect.id,
      startDate: tomorrow,
      endDate: nextWeek,
      nightlyThb: 600000,
      label: 'Weekend Rate',
    },
    update: {},
  });

  await db.blockedDate.upsert({
    where: { id: 'blocked-date-1' },
    create: {
      id: 'blocked-date-1',
      unitId: unitDirect.id,
      startDate: new Date(today.getFullYear(), today.getMonth(), 25),
      endDate: new Date(today.getFullYear(), today.getMonth(), 28),
      reason: 'maintenance',
    },
    update: {},
  });

  console.log('✓ Demo data seeded:');
  console.log(`  - Project: ${project.name}`);
  console.log(`  - Units: ${unitDirect.name}, ${unitMC.name}, ${unitOwnerDirect.name}`);
  console.log(`  - Demo identities: 10 roles`);
  console.log(`  - Provider: ${provider.name} with service: ${service.title}`);
  console.log('\n  Demo accounts (all password: password123):');
  console.log('  - admin@ignatev.test (admin)');
  console.log('  - ops@ignatev.test (staff_ops)');
  console.log('  - host@ignatev.test (onsite_host)');
  console.log('  - owner@ignatev.test (owner)');
  console.log('  - guest@ignatev.test (guest)');
  console.log('  - resident@ignatev.test (resident)');
  console.log('  - buyer@ignatev.test (buyer)');
  console.log('  - provider@ignatev.test (provider_member)');
  console.log('  - mc@ignatev.test (mc_member)');
  console.log('  - juristic@ignatev.test (juristic_member)');
}
