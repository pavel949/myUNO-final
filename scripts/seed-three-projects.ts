/**
 * Seed Three Premium Projects
 *
 * Creates:
 * 1. The Title Legendary - luxury villas
 * 2. Layantara Villa Resort - mid-range villas & condos
 * 3. The Title Heritage - boutique collection
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function seedThreeProjects() {
  console.log('🌱 Seeding three premium projects...\n');

  try {
    // ====== 1. Create Area ======
    const area = await prisma.area.upsert({
      where: { slug: 'phuket-bang-tao' },
      update: {},
      create: {
        slug: 'phuket-bang-tao',
        nameKey: 'area.phuket_bang_tao',
        descriptionKey: 'area.phuket_bang_tao_desc',
        status: 'live',
        sort: 1,
      },
    });
    console.log(`✓ Area: ${area.slug}`);

    // ====== 2. Create Staff Identity ======
    const staffIdentity = await prisma.identity.upsert({
      where: { email: 'operations@myuno.io' },
      update: {},
      create: {
        firstName: 'MyUNO',
        lastName: 'Operations',
        email: 'operations@myuno.io',
        status: 'active',
        isAdmin: true,
        preferredLocale: 'en',
      },
    });
    console.log(`✓ Staff: ${staffIdentity.email}`);

    // ====== 3. Create Owner Identity ======
    const ownerIdentity = await prisma.identity.upsert({
      where: { email: 'pavel@ignatevestate.com' },
      update: {},
      create: {
        firstName: 'Pavel',
        lastName: 'Ignatev',
        email: 'pavel@ignatevestate.com',
        status: 'active',
        isAdmin: true,
        preferredLocale: 'en',
      },
    });
    console.log(`✓ Owner: ${ownerIdentity.email}\n`);

    // ====== PROJECT 1: THE TITLE LEGENDARY ======
    console.log('📍 Creating Project 1: The Title Legendary');
    const project1 = await prisma.project.upsert({
      where: { slug: 'the-title-legendary' },
      update: { status: 'live', areaId: area.id },
      create: {
        slug: 'the-title-legendary',
        name: 'The Title Legendary',
        areaLabelKey: 'project.title_legendary_location',
        areaId: area.id,
        descriptionKey: 'project.title_legendary_desc',
        latitude: new Prisma.Decimal('8.6800'),
        longitude: new Prisma.Decimal('98.2950'),
        address: 'Bang Tao, Phuket 83110, Thailand',
        timezone: 'Asia/Bangkok',
        handbookKey: 'project.title_legendary_handbook',
        status: 'live',
        defaultCurrency: 'THB',
        amenityKeys: [
          'pool',
          'wifi',
          'parking',
          'gym',
          'concierge',
          'security_24_7',
          'housekeeping',
          'spa',
          'restaurant',
        ],
      },
    });

    const project1Units = [
      {
        name: 'Legendary Penthouse',
        unitType: 'villa' as const,
        bedrooms: 6,
        bathrooms: 6,
        maxGuests: 14,
        sizeSqm: 1200,
        floor: 'Top',
        baseNightlyThb: 75000,
      },
      {
        name: 'Legendary Ocean Villa',
        unitType: 'villa' as const,
        bedrooms: 5,
        bathrooms: 5,
        maxGuests: 12,
        sizeSqm: 950,
        floor: 'Ground',
        baseNightlyThb: 55000,
      },
      {
        name: 'Legendary Garden Suite',
        unitType: 'villa' as const,
        bedrooms: 4,
        bathrooms: 4,
        maxGuests: 10,
        sizeSqm: 750,
        floor: 'Ground',
        baseNightlyThb: 40000,
      },
    ];

    for (const unit of project1Units) {
      await prisma.unit.upsert({
        where: { projectId_name: { projectId: project1.id, name: unit.name } },
        update: { status: 'live' },
        create: {
          projectId: project1.id,
          ownerIdentityId: ownerIdentity.id,
          name: unit.name,
          unitType: unit.unitType,
          bedrooms: unit.bedrooms,
          bathrooms: unit.bathrooms,
          maxGuests: unit.maxGuests,
          sizeSqm: unit.sizeSqm,
          floor: unit.floor,
          addressSupplement: `${unit.name}, The Title Legendary, Bang Tao`,
          baseNightlyThb: unit.baseNightlyThb,
          minNights: 2,
          instantBook: true,
          cancellationPolicyKey: 'policy.moderate',
          status: 'live',
          petsAllowed: true,
          maxPets: 2,
          amenityKeys: [
            'wifi',
            'aircon',
            'kitchen',
            'washer',
            'tv',
            'parking',
            'outdoor_space',
            'pool_access',
          ],
          permittedUseConfirmedAt: new Date(),
        },
      });
      console.log(`  ✓ ${unit.name}`);
    }

    // ====== PROJECT 2: LAYANTARA VILLA RESORT ======
    console.log('\n📍 Creating Project 2: Layantara Villa Resort');
    const project2 = await prisma.project.upsert({
      where: { slug: 'layantara-villa-resort' },
      update: { status: 'live', areaId: area.id },
      create: {
        slug: 'layantara-villa-resort',
        name: 'Layantara Villa Resort',
        areaLabelKey: 'project.layantara_location',
        areaId: area.id,
        descriptionKey: 'project.layantara_desc',
        latitude: new Prisma.Decimal('8.6750'),
        longitude: new Prisma.Decimal('98.2920'),
        address: 'Laguna, Phuket 83110, Thailand',
        timezone: 'Asia/Bangkok',
        handbookKey: 'project.layantara_handbook',
        status: 'live',
        defaultCurrency: 'THB',
        amenityKeys: [
          'pool',
          'wifi',
          'parking',
          'gym',
          'concierge',
          'security_24_7',
          'housekeeping',
        ],
      },
    });

    const project2Units = [
      {
        name: 'Layantara Premium Villa',
        unitType: 'villa' as const,
        bedrooms: 4,
        bathrooms: 4,
        maxGuests: 10,
        sizeSqm: 700,
        floor: 'Ground',
        baseNightlyThb: 35000,
      },
      {
        name: 'Layantara Deluxe Villa',
        unitType: 'villa' as const,
        bedrooms: 3,
        bathrooms: 3,
        maxGuests: 8,
        sizeSqm: 550,
        floor: 'Ground',
        baseNightlyThb: 25000,
      },
      {
        name: 'Layantara Condo Suite 201',
        unitType: 'condo' as const,
        bedrooms: 3,
        bathrooms: 2,
        maxGuests: 8,
        sizeSqm: 320,
        floor: '2nd',
        baseNightlyThb: 12500,
      },
      {
        name: 'Layantara Condo Suite 102',
        unitType: 'condo' as const,
        bedrooms: 2,
        bathrooms: 2,
        maxGuests: 6,
        sizeSqm: 220,
        floor: '1st',
        baseNightlyThb: 8500,
      },
    ];

    for (const unit of project2Units) {
      await prisma.unit.upsert({
        where: { projectId_name: { projectId: project2.id, name: unit.name } },
        update: { status: 'live' },
        create: {
          projectId: project2.id,
          ownerIdentityId: ownerIdentity.id,
          name: unit.name,
          unitType: unit.unitType,
          bedrooms: unit.bedrooms,
          bathrooms: unit.bathrooms,
          maxGuests: unit.maxGuests,
          sizeSqm: unit.sizeSqm,
          floor: unit.floor,
          addressSupplement: `${unit.name}, Layantara Villa Resort, Laguna`,
          baseNightlyThb: unit.baseNightlyThb,
          minNights: 1,
          instantBook: true,
          cancellationPolicyKey: 'policy.flexible',
          status: 'live',
          petsAllowed: false,
          maxPets: 0,
          amenityKeys: [
            'wifi',
            'aircon',
            'kitchen',
            'washer',
            'tv',
            'parking',
            'outdoor_space',
          ],
          permittedUseConfirmedAt: new Date(),
        },
      });
      console.log(`  ✓ ${unit.name}`);
    }

    // ====== PROJECT 3: THE TITLE HERITAGE ======
    console.log('\n📍 Creating Project 3: The Title Heritage');
    const project3 = await prisma.project.upsert({
      where: { slug: 'the-title-heritage' },
      update: { status: 'live', areaId: area.id },
      create: {
        slug: 'the-title-heritage',
        name: 'The Title Heritage',
        areaLabelKey: 'project.title_heritage_location',
        areaId: area.id,
        descriptionKey: 'project.title_heritage_desc',
        latitude: new Prisma.Decimal('8.6700'),
        longitude: new Prisma.Decimal('98.2980'),
        address: 'Cherng Talay, Phuket 83110, Thailand',
        timezone: 'Asia/Bangkok',
        handbookKey: 'project.title_heritage_handbook',
        status: 'live',
        defaultCurrency: 'THB',
        amenityKeys: [
          'pool',
          'wifi',
          'parking',
          'gym',
          'concierge',
          'security_24_7',
          'housekeeping',
          'boutique',
        ],
      },
    });

    const project3Units = [
      {
        name: 'Heritage Signature Suite',
        unitType: 'villa' as const,
        bedrooms: 3,
        bathrooms: 3,
        maxGuests: 8,
        sizeSqm: 620,
        floor: 'Ground',
        baseNightlyThb: 28000,
      },
      {
        name: 'Heritage Deluxe Room',
        unitType: 'condo' as const,
        bedrooms: 2,
        bathrooms: 2,
        maxGuests: 5,
        sizeSqm: 180,
        floor: '1st',
        baseNightlyThb: 9000,
      },
      {
        name: 'Heritage Classic Room',
        unitType: 'condo' as const,
        bedrooms: 1,
        bathrooms: 1,
        maxGuests: 3,
        sizeSqm: 120,
        floor: '2nd',
        baseNightlyThb: 6000,
      },
    ];

    for (const unit of project3Units) {
      await prisma.unit.upsert({
        where: { projectId_name: { projectId: project3.id, name: unit.name } },
        update: { status: 'live' },
        create: {
          projectId: project3.id,
          ownerIdentityId: ownerIdentity.id,
          name: unit.name,
          unitType: unit.unitType,
          bedrooms: unit.bedrooms,
          bathrooms: unit.bathrooms,
          maxGuests: unit.maxGuests,
          sizeSqm: unit.sizeSqm,
          floor: unit.floor,
          addressSupplement: `${unit.name}, The Title Heritage, Cherng Talay`,
          baseNightlyThb: unit.baseNightlyThb,
          minNights: 1,
          instantBook: true,
          cancellationPolicyKey: 'policy.strict',
          status: 'live',
          petsAllowed: false,
          maxPets: 0,
          amenityKeys: ['wifi', 'aircon', 'kitchen', 'washer', 'tv', 'parking'],
          permittedUseConfirmedAt: new Date(),
        },
      });
      console.log(`  ✓ ${unit.name}`);
    }

    // ====== Create Role Assignments ======
    console.log('\n🔐 Creating role assignments...');

    const allProjects = [project1, project2, project3];
    for (const project of allProjects) {
      const units = await prisma.unit.findMany({ where: { projectId: project.id } });

      for (const unit of units) {
        await prisma.roleAssignment.upsert({
          where: {
            identityId_roleType_projectId_unitId: {
              identityId: ownerIdentity.id,
              roleType: 'owner',
              projectId: project.id,
              unitId: unit.id,
            },
          },
          update: { status: 'active' },
          create: {
            identityId: ownerIdentity.id,
            roleType: 'owner',
            scopeType: 'unit',
            projectId: project.id,
            unitId: unit.id,
            status: 'active',
            grantedByIdentityId: staffIdentity.id,
            grantedAt: new Date(),
          },
        });
      }
    }

    console.log(`  ✓ Owner role assigned to all units`);

    // ====== Create Unit Engagements ======
    console.log('\n📋 Creating unit engagements...');
    const allUnits = await prisma.unit.findMany({
      where: { projectId: { in: [project1.id, project2.id, project3.id] } },
    });

    for (const unit of allUnits) {
      await prisma.unitEngagement.upsert({
        where: {
          unitId_ownerIdentityId: {
            unitId: unit.id,
            ownerIdentityId: ownerIdentity.id,
          },
        },
        update: { status: 'active' },
        create: {
          unitId: unit.id,
          ownerIdentityId: ownerIdentity.id,
          engagementType: 'direct_managed',
          status: 'active',
          startDate: new Date('2025-01-01'),
          managementFeePercentageNoi: 15,
        },
      });
    }
    console.log(`  ✓ Engagements created for ${allUnits.length} units`);

    // ====== Summary ======
    console.log('\n✨ Three Premium Projects Seeded Successfully!\n');
    console.log('📊 Summary:');
    console.log('   Project 1: The Title Legendary (3 luxury villas)');
    console.log('   Project 2: Layantara Villa Resort (2 villas + 2 condos)');
    console.log('   Project 3: The Title Heritage (1 villa + 2 rooms)');
    console.log(`\n   Total: 8 units across 3 properties`);
    console.log('   Location: Phuket, Bang Tao / Laguna / Cherng Talay');
    console.log('\n🚀 Next steps:');
    console.log('   1. Visit /projects to see the three projects');
    console.log('   2. Click each project to view units');
    console.log('   3. Upload cover photos in admin panel');
    console.log('   4. Test bookings and the rental flow\n');
  } catch (error) {
    console.error('❌ Seed error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedThreeProjects();
