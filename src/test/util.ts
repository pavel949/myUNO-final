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
  await db.bookingChange.deleteMany();
  await db.bookingGuest.deleteMany();
  await db.booking.deleteMany();
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

export interface ProviderFactoryOpts {
  name?: string;
  description?: string;
  status?: 'applied' | 'vetting' | 'active' | 'suspended' | 'offboarded';
  categoryKeys?: string[];
}

export async function createProvider(opts: ProviderFactoryOpts = {}) {
  return db.provider.create({
    data: {
      name: opts.name || `Provider-${uuid().slice(0, 8)}`,
      description: opts.description || 'Test Provider',
      contactEmail: `provider-${uuid().slice(0, 8)}@example.com`,
      contactPhone: '+66800000000',
      categoryKeys: opts.categoryKeys || ['cleaning'],
      status: opts.status || 'applied',
    },
  });
}

export interface ServiceFactoryOpts {
  providerId: string;
  categoryKey?: string;
  title?: string;
  status?: 'draft' | 'active' | 'paused';
  priceModel?: 'fixed' | 'per_hour' | 'per_person' | 'quote';
  basePriceThb?: number;
}

export async function createService(opts: ServiceFactoryOpts) {
  return db.service.create({
    data: {
      provider_id: opts.providerId,
      categoryKey: opts.categoryKey || 'cleaning',
      title: opts.title || `Service-${uuid().slice(0, 8)}`,
      status: opts.status || 'draft',
      priceModel: opts.priceModel || 'fixed',
      basePriceThb: opts.basePriceThb || 1000,
    },
  });
}

export interface BookingFactoryOpts {
  unitId: string;
  projectId: string;
  guestIdentityId: string;
  startDate?: Date;
  endDate?: Date;
  status?: 'pending_payment' | 'confirmed' | 'checked_in' | 'checked_out' | 'completed' | 'cancelled';
}

export async function createBooking(opts: BookingFactoryOpts) {
  const startDate = opts.startDate || new Date('2026-07-15');
  const endDate = opts.endDate || new Date('2026-07-17');

  return db.booking.create({
    data: {
      unitId: opts.unitId,
      projectId: opts.projectId,
      guestIdentityId: opts.guestIdentityId,
      bookingType: 'guest_stay',
      channel: 'direct',
      startDate,
      endDate,
      adults: 2,
      children: 0,
      totalThb: 4000,
      status: opts.status || 'confirmed',
    },
  });
}

export interface BookingGuestFactoryOpts {
  bookingId: string;
  fullName: string;
  nationality: string;
  passportNumber: string;
  dateOfBirth?: Date;
  isLead?: boolean;
}

export async function createBookingGuest(opts: BookingGuestFactoryOpts) {
  return db.bookingGuest.create({
    data: {
      bookingId: opts.bookingId,
      fullName: opts.fullName,
      nationality: opts.nationality,
      passportNumber: opts.passportNumber,
      dateOfBirth: opts.dateOfBirth,
      isLead: opts.isLead || true,
    },
  });
}
