/**
 * Seed Real Project & Unit Data
 *
 * Creates a complete project setup with:
 * - Real geographic area (Phuket Bang Tao)
 * - Project (Ignatev Estate)
 * - Units (villas & condos)
 * - Owner identity
 * - Staff roles
 * - Unit engagements
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedRealData() {
  console.log('🌱 Starting real project & unit data seed...\n');

  try {
    // ====== 1. Create Area (Geographic Location) ======
    console.log('📍 Creating geographic area...');
    const area = await prisma.area.upsert({
      where: { slug: 'bang-tao-coast' },
      update: {},
      create: {
        slug: 'bang-tao-coast',
        nameKey: 'area.bang_tao_coast',
        descriptionKey: 'area.bang_tao_coast_desc',
        status: 'live',
        sort: 1,
      },
    });
    console.log(`  ✓ Area: ${area.slug}`);

    // ====== 2. Create Admin/Staff Identity ======
    console.log('👤 Creating staff identity...');
    const staffIdentity = await prisma.identity.upsert({
      where: { email: 'ops@ignatevestate.com' },
      update: {},
      create: {
        firstName: 'Operations',
        lastName: 'Team',
        email: 'ops@ignatevestate.com',
        status: 'active',
        isAdmin: true,
        preferredLocale: 'en',
      },
    });
    console.log(`  ✓ Staff: ${staffIdentity.email}`);

    // ====== 3. Create Project ======
    console.log('🏗️  Creating project...');
    const project = await prisma.project.upsert({
      where: { slug: 'ignatev-estate' },
      update: {
        status: 'live',
        areaId: area.id,
      },
      create: {
        slug: 'ignatev-estate',
        name: 'Ignatev Estate',
        areaLabelKey: 'project.ignatev_estate_location',
        areaId: area.id,
        descriptionKey: 'project.ignatev_estate_description',
        latitude: new Prisma.Decimal('8.6753'),
        longitude: new Prisma.Decimal('98.2948'),
        address: 'Bang Tao, Phuket 83110, Thailand',
        timezone: 'Asia/Bangkok',
        handbookKey: 'project.ignatev_handbook',
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
    console.log(`  ✓ Project: ${project.name} (${project.slug})`);

    // ====== 4. Create Owner Identity ======
    console.log('👔 Creating owner identity...');
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
    console.log(`  ✓ Owner: ${ownerIdentity.email}`);

    // ====== 5. Create Units ======
    console.log('🏠 Creating units...\n');

    const units = [
      {
        name: 'Beachfront Villa A',
        unitType: 'villa' as const,
        categoryKey: 'unit.luxury_villa',
        bedrooms: 5,
        bathrooms: 5,
        maxGuests: 12,
        sizeSqm: 850,
        floor: 'Ground',
        baseNightlyThb: 45000, // ~$1400
        minNights: 2,
        petsAllowed: true,
        maxPets: 2,
      },
      {
        name: 'Garden Villa B',
        unitType: 'villa' as const,
        categoryKey: 'unit.villa',
        bedrooms: 4,
        bathrooms: 4,
        maxGuests: 10,
        sizeSqm: 650,
        floor: 'Ground',
        baseNightlyThb: 35000, // ~$1090
        minNights: 2,
        petsAllowed: true,
        maxPets: 1,
      },
      {
        name: 'Prime Condo 101',
        unitType: 'condo' as const,
        categoryKey: 'unit.luxury_condo',
        bedrooms: 3,
        bathrooms: 3,
        maxGuests: 8,
        sizeSqm: 320,
        floor: '1st',
        baseNightlyThb: 12000, // ~$370
        minNights: 1,
        petsAllowed: false,
        maxPets: 0,
      },
      {
        name: 'Ocean View Condo 201',
        unitType: 'condo' as const,
        categoryKey: 'unit.condo',
        bedrooms: 2,
        bathrooms: 2,
        maxGuests: 6,
        sizeSqm: 220,
        floor: '2nd',
        baseNightlyThb: 8500, // ~$265
        minNights: 1,
        petsAllowed: false,
        maxPets: 0,
      },
      {
        name: 'Sunset Townhouse 01',
        unitType: 'townhouse' as const,
        categoryKey: 'unit.townhouse',
        bedrooms: 3,
        bathrooms: 2,
        maxGuests: 8,
        sizeSqm: 280,
        floor: '1st-2nd',
        baseNightlyThb: 9500, // ~$295
        minNights: 1,
        petsAllowed: false,
        maxPets: 0,
      },
    ];

    const createdUnits = [];
    for (const unitData of units) {
      const unit = await prisma.unit.upsert({
        where: { projectId_name: { projectId: project.id, name: unitData.name } },
        update: { status: 'live' },
        create: {
          projectId: project.id,
          ownerIdentityId: ownerIdentity.id,
          name: unitData.name,
          unitType: unitData.unitType,
          categoryKey: unitData.categoryKey,
          bedrooms: unitData.bedrooms,
          bathrooms: unitData.bathrooms,
          maxGuests: unitData.maxGuests,
          sizeSqm: unitData.sizeSqm,
          floor: unitData.floor,
          addressSupplement: `${unitData.name}, Ignatev Estate, Bang Tao`,
          baseNightlyThb: unitData.baseNightlyThb,
          minNights: unitData.minNights,
          instantBook: true,
          cancellationPolicyKey: 'policy.moderate',
          status: 'live',
          petsAllowed: unitData.petsAllowed,
          maxPets: unitData.maxPets,
          amenityKeys: [
            'wifi',
            'aircon',
            'kitchen',
            'washer',
            'tv',
            'parking',
            'outdoor_space',
          ],
          descriptionKey: `unit.${unitData.name.toLowerCase().replace(/\s+/g, '_')}_desc`,
          permittedUseConfirmedAt: new Date(),
        },
      });
      createdUnits.push(unit);
      console.log(`    ✓ ${unit.name} (${unit.unitType})`);
    }

    // ====== 6. Create Unit Engagements (how units are managed) ======
    console.log('\n📋 Creating unit engagements...');
    for (const unit of createdUnits) {
      const engagement = await prisma.unitEngagement.upsert({
        where: { unitId_ownerIdentityId: { unitId: unit.id, ownerIdentityId: ownerIdentity.id } },
        update: { status: 'active' },
        create: {
          unitId: unit.id,
          ownerIdentityId: ownerIdentity.id,
          engagementType: 'direct_managed',
          status: 'active',
          startDate: new Date('2025-01-01'),
          managementFeePercentageNoi: 15, // 15% of NOI
        },
      });
      console.log(`    ✓ ${unit.name}: direct management`);
    }

    // ====== 7. Create Role Assignments ======
    console.log('\n🔐 Creating role assignments...');

    // Owner roles (one per unit)
    for (const unit of createdUnits) {
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
    console.log(`    ✓ Owner role assigned to all units`);

    // Staff (ops) role at project level
    await prisma.roleAssignment.upsert({
      where: {
        identityId_roleType_projectId_unitId: {
          identityId: staffIdentity.id,
          roleType: 'staff_ops',
          projectId: project.id,
          unitId: null,
        },
      },
      update: { status: 'active' },
      create: {
        identityId: staffIdentity.id,
        roleType: 'staff_ops',
        scopeType: 'project',
        projectId: project.id,
        status: 'active',
        grantedByIdentityId: staffIdentity.id,
        grantedAt: new Date(),
      },
    });
    console.log(`    ✓ Operations role assigned to staff`);

    // ====== 8. Create basic pricing rules (seasonal) ======
    console.log('\n💰 Creating seasonal pricing rules...');
    const today = new Date();
    const peakStart = new Date(today.getFullYear(), 11, 1); // December 1
    const peakEnd = new Date(today.getFullYear() + 1, 2, 31); // March 31

    for (const unit of createdUnits) {
      // High season markup (Dec-Mar)
      await prisma.pricingRule.upsert({
        where: {
          unitId_startDate_endDate: {
            unitId: unit.id,
            startDate: peakStart,
            endDate: peakEnd,
          },
        },
        update: {},
        create: {
          unitId: unit.id,
          startDate: peakStart,
          endDate: peakEnd,
          nightlyThb: Math.round(unit.baseNightlyThb * 1.3), // 30% premium
          label: 'High Season (Dec-Mar)',
        },
      });
    }
    console.log(`    ✓ High season (Dec-Mar) pricing rules created`);

    // ====== Summary ======
    console.log('\n✨ Real project & unit data seed complete!\n');
    console.log('📊 Summary:');
    console.log(`   • Area: ${area.slug}`);
    console.log(`   • Project: ${project.name}`);
    console.log(`   • Units: ${createdUnits.length}`);
    console.log(`   • Owner: ${ownerIdentity.email}`);
    console.log(`   • Staff: ${staffIdentity.email}`);
    console.log('\n🚀 Next steps:');
    console.log('   1. Log in to the admin panel (/app/admin) with ops@ignatevestate.com');
    console.log('   2. Add unit media/photos in the admin UI');
    console.log('   3. Configure content keys (descriptions, amenity labels)');
    console.log('   4. Test bookings and the rental flow');
    console.log('   5. View owner statements at /app/owner/statements\n');
  } catch (error) {
    console.error('❌ Seed error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Import Prisma.Decimal
import { Prisma } from '@prisma/client';

seedRealData();
