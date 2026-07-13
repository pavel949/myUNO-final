import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { v4 as uuid } from 'uuid';

// Test database client — uses DATABASE_URL_TEST if set, else DATABASE_URL
const testDatabaseUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error('DATABASE_URL or DATABASE_URL_TEST must be set');
}

export const db = new PrismaClient({
  datasources: {
    db: {
      url: testDatabaseUrl,
    },
  },
});

/**
 * Reset database by deleting all tables (in dependency order to respect FKs)
 */
export async function resetDb() {
  // Order matters: delete child tables before parents
  await db.translation.deleteMany();
  await db.contentKey.deleteMany();
  await db.configChange.deleteMany();
  await db.configOverride.deleteMany();
  await db.configParameter.deleteMany();
  await db.auditLog.deleteMany();
  await db.projectMedia.deleteMany();
  await db.unitMedia.deleteMany();
  await db.roleAssignment.deleteMany();
  await db.unitEngagement.deleteMany();
  await db.blockedDate.deleteMany();
  await db.pricingRule.deleteMany();
  await db.unit.deleteMany();
  await db.organization.deleteMany();
  await db.project.deleteMany();
  await db.oneTimeToken.deleteMany();
  await db.authAccount.deleteMany();
  await db.mediaAsset.deleteMany();
  await db.identity.deleteMany();
}

// --- Factories ---

export interface IdentityFactoryOpts {
  firstName?: string;
  lastName?: string;
  email?: string;
  isAdmin?: boolean;
  status?: 'active' | 'invited' | 'blocked' | 'merged';
}

export async function createIdentity(opts: IdentityFactoryOpts = {}) {
  return db.identity.create({
    data: {
      firstName: opts.firstName || 'Test',
      lastName: opts.lastName || 'User',
      email: opts.email || `test-${uuid().slice(0, 8)}@example.com`,
      isAdmin: opts.isAdmin || false,
      status: opts.status || 'active',
      preferredLocale: 'en',
    },
  });
}

export interface ProjectFactoryOpts {
  slug?: string;
  name?: string;
  status?: 'draft' | 'live' | 'archived';
}

export async function createProject(opts: ProjectFactoryOpts = {}) {
  return db.project.create({
    data: {
      slug: opts.slug || `project-${uuid().slice(0, 8)}`,
      name: opts.name || 'Test Project',
      areaLabelKey: 'project.area.default',
      descriptionKey: 'project.description.default',
      handbookKey: 'project.handbook.default',
      latitude: new Decimal('13.7563'),
      longitude: new Decimal('100.5018'),
      address: '123 Test Street, Bangkok',
      timezone: 'Asia/Bangkok',
      status: opts.status || 'draft',
    },
  });
}

export interface UnitFactoryOpts {
  projectId?: string;
  ownerIdentityId?: string;
  name?: string;
  status?: 'draft' | 'mobilizing' | 'live' | 'paused' | 'offboarded';
  baseNightlyThb?: number;
  maxGuests?: number;
  minNights?: number;
  instantBook?: boolean;
}

export async function createUnit(projectIdOrOpts: string | UnitFactoryOpts = {}) {
  // Support both positional and options-based calling
  const opts = typeof projectIdOrOpts === 'string'
    ? { projectId: projectIdOrOpts }
    : projectIdOrOpts;

  if (!opts.projectId) {
    throw new Error('projectId is required');
  }

  return db.unit.create({
    data: {
      projectId: opts.projectId,
      ownerIdentityId: opts.ownerIdentityId,
      name: opts.name || `Unit-${uuid().slice(0, 8)}`,
      unitType: 'villa',
      bedrooms: 2,
      bathrooms: 1,
      maxGuests: opts.maxGuests ?? 4,
      addressSupplement: '101',
      baseNightlyThb: opts.baseNightlyThb ?? 2000,
      minNights: opts.minNights ?? 1,
      instantBook: opts.instantBook ?? true,
      status: opts.status || 'draft',
    },
  });
}

export interface UnitEngagementFactoryOpts {
  unitId: string;
  ownerIdentityId: string;
  type?: 'direct_managed' | 'via_management_company' | 'owner_direct';
  status?: 'draft' | 'active' | 'ended';
}

export async function createUnitEngagement(opts: UnitEngagementFactoryOpts) {
  return db.unitEngagement.create({
    data: {
      unitId: opts.unitId,
      ownerIdentityId: opts.ownerIdentityId,
      engagementType: opts.type || 'direct_managed',
      status: opts.status || 'draft',
    },
  });
}

export interface RoleAssignmentFactoryOpts {
  identityId: string;
  role:
    | 'owner'
    | 'guest'
    | 'resident'
    | 'buyer'
    | 'provider_member'
    | 'mc_member'
    | 'juristic_member'
    | 'staff_ops'
    | 'onsite_host';
  scopeType?: 'platform' | 'project' | 'unit';
  projectId?: string;
  unitId?: string;
  status?: 'active' | 'revoked';
}

export async function createRoleAssignment(opts: RoleAssignmentFactoryOpts) {
  return db.roleAssignment.create({
    data: {
      identityId: opts.identityId,
      role: opts.role,
      scopeType: opts.scopeType || 'platform',
      projectId: opts.projectId,
      unitId: opts.unitId,
      status: opts.status || 'active',
    },
  });
}
