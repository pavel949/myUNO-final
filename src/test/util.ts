import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { v4 as uuid } from 'uuid';
import { clearConfigCache } from '@/modules/config';
import { clearTranslationCache } from '@/modules/content';

// Test database client — requires DATABASE_URL_TEST to protect production database
const testDatabaseUrl = process.env.DATABASE_URL_TEST;
if (!testDatabaseUrl) {
  throw new Error(
    'DATABASE_URL_TEST must be set to run tests. It protects the live database from accidental deletion. ' +
    'Set it to a separate test database connection string in .env.'
  );
}

export const db = new PrismaClient({
  datasources: {
    db: {
      url: testDatabaseUrl,
    },
  },
});

/**
 * Reset the database between tests. Enumerates every table from pg_tables so it
 * stays correct as the schema grows (the old hand-maintained delete list silently
 * missed newer tables and failed on FK constraints).
 *
 * Uses DELETE with FK triggers disabled (session_replication_role = replica)
 * rather than TRUNCATE: TRUNCATE takes an ACCESS EXCLUSIVE lock that deadlocks
 * against the best-effort background notification/email queries that can still
 * be in flight from a just-finished test. DELETE takes row-level locks and
 * doesn't conflict, so resets are deadlock-free.
 */
export async function resetDb() {
  const tables = await db.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;
  await db.$transaction([
    db.$executeRawUnsafe(`SET session_replication_role = 'replica'`),
    ...tables.map((t) => db.$executeRawUnsafe(`DELETE FROM "${t.tablename}"`)),
    db.$executeRawUnsafe(`SET session_replication_role = 'origin'`),
  ]);
  // Module-level in-memory caches survive a DB wipe — clear them so a test
  // never reads a value cached from a prior test's data.
  clearConfigCache();
  clearTranslationCache();
}

/**
 * Set a global config value in tests (writes a global-scoped override, which
 * getConfig resolves ahead of the seeded default). Keeps tests independent of
 * the full config seed.
 */
export async function setGlobalConfig(key: string, value: unknown) {
  await db.configOverride.upsert({
    where: {
      parameterKey_scopeType_scopeId: {
        parameterKey: key,
        scopeType: 'global',
        scopeId: 'global',
      },
    },
    create: {
      parameterKey: key,
      scopeType: 'global',
      scopeId: 'global',
      value: value as any,
      updatedByIdentityId: 'test',
    },
    update: { value: value as any },
  });
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
  status?: 'requested' | 'pending_payment' | 'confirmed' | 'checked_in' | 'checked_out' | 'completed' | 'cancelled' | 'declined' | 'expired';
  verificationStatus?: 'not_required' | 'pending' | 'passports_received' | 'failed';
  totalThb?: number;
  adults?: number;
  children?: number;
  holdExpiresAt?: Date | null;
  cancellationPolicySnapshot?: Record<string, unknown>;
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
      adults: opts.adults ?? 2,
      children: opts.children ?? 0,
      totalThb: opts.totalThb ?? 4000,
      status: opts.status || 'confirmed',
      verificationStatus: opts.verificationStatus || 'not_required',
      ...(opts.holdExpiresAt !== undefined && { holdExpiresAt: opts.holdExpiresAt }),
      ...(opts.cancellationPolicySnapshot && {
        cancellationPolicySnapshot: opts.cancellationPolicySnapshot as any,
      }),
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
