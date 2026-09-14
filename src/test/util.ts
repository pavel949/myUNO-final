import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { v4 as uuid } from 'uuid';
import { clearConfigCache } from '@/modules/config';
import { clearTranslationCache } from '@/modules/content';
import { resolveDatabaseUrl } from '@/lib/resolveDatabaseUrl';

// Test database client — requires DATABASE_URL_TEST to protect production database
const rawTestDatabaseUrl = process.env.DATABASE_URL_TEST;
if (!rawTestDatabaseUrl) {
  throw new Error(
    'DATABASE_URL_TEST must be set to run tests. It protects the live database from accidental deletion. ' +
    'Set it to a separate test database connection string in .env.'
  );
}

const testDatabaseUrl = resolveDatabaseUrl(rawTestDatabaseUrl) ?? rawTestDatabaseUrl;

/**
 * One client for the whole run, cached on `globalThis` — the same trick
 * `src/lib/prisma.ts` uses for the application singleton, and for the same
 * reason.
 */
const globalForTestDb = globalThis as unknown as { __myunoTestDb?: PrismaClient };

export const db =
  globalForTestDb.__myunoTestDb ??
  new PrismaClient({
    datasources: {
      db: {
        url: testDatabaseUrl,
      },
    },
  });

globalForTestDb.__myunoTestDb = db;

const RESET_DEADLOCK_RETRIES = 5;

function isDeadlock(error: unknown): boolean {
  const text = `${(error as Error)?.message ?? ''}${(error as { code?: string })?.code ?? ''}`;
  return text.includes('40P01') || text.includes('deadlock');
}

export async function resetDb() {
  const tables = await db.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;

  for (let attempt = 0; ; attempt += 1) {
    try {
      await db.$transaction([
        db.$executeRawUnsafe(`SET session_replication_role = 'replica'`),
        ...tables.map((t) => db.$executeRawUnsafe(`DELETE FROM "${t.tablename}"`)),
        db.$executeRawUnsafe(`SET session_replication_role = 'origin'`),
      ]);
      break;
    } catch (error) {
      if (attempt < RESET_DEADLOCK_RETRIES && isDeadlock(error)) {
        await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }
  clearConfigCache();
  clearTranslationCache();
}

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
  areaId?: string;
  latitude?: string;
  longitude?: string;
}

export async function createProject(opts: ProjectFactoryOpts = {}) {
  return db.project.create({
    data: {
      slug: opts.slug || `project-${uuid().slice(0, 8)}`,
      name: opts.name || 'Test Project',
      areaLabelKey: 'project.area.default',
      descriptionKey: 'project.description.default',
      handbookKey: 'project.handbook.default',
      latitude: new Decimal(opts.latitude ?? '13.7563'),
      longitude: new Decimal(opts.longitude ?? '100.5018'),
      address: '123 Test Street, Bangkok',
      timezone: 'Asia/Bangkok',
      /*
       * Live by default. The canonical pricing service refuses to quote a unit
       * whose project is not live, so a draft default meant the ordinary
       * fixture — a project with a bookable villa — could not be booked. Every
       * test that is actually about project status passes one explicitly.
       */
      status: opts.status || 'live',
      ...(opts.areaId ? { areaId: opts.areaId } : {}),
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
  categoryKey?: string;
  bedrooms?: number;
  /**
   * Attach this unit to an InventoryCategory that already exists. Leave unset
   * and the factory makes one when the guard below requires it.
   */
  inventoryCategoryId?: string;
}

export interface InventoryCategoryFactoryOpts {
  projectId: string;
  categoryKey?: string;
  name?: string;
  bedrooms?: number;
  bathrooms?: number;
  maxGuests?: number;
  baseNightlyThb?: number;
  minNights?: number;
}

/**
 * An InventoryCategory — the canonical owner of a unit's commercial terms.
 *
 * `[projectId, categoryKey]` is unique, so this upserts: several units given
 * the same key in one project deliberately share one category, which is what
 * the category-level search and pricing tests are asserting about.
 */
export async function createInventoryCategory(opts: InventoryCategoryFactoryOpts) {
  const categoryKey = opts.categoryKey || `cat-${uuid().slice(0, 8)}`;

  return db.inventoryCategory.upsert({
    where: { projectId_categoryKey: { projectId: opts.projectId, categoryKey } },
    update: {},
    create: {
      projectId: opts.projectId,
      categoryKey,
      name: opts.name || `Category-${categoryKey}`,
      bedrooms: opts.bedrooms ?? 2,
      bathrooms: opts.bathrooms ?? 1,
      maxGuests: opts.maxGuests ?? 4,
      baseNightlyThb: opts.baseNightlyThb ?? 2000,
      minNights: opts.minNights ?? 1,
    },
  });
}

export async function createUnit(projectIdOrOpts: string | UnitFactoryOpts = {}) {
  const opts = typeof projectIdOrOpts === 'string'
    ? { projectId: projectIdOrOpts }
    : projectIdOrOpts;

  if (!opts.projectId) {
    throw new Error('projectId is required');
  }

  const status = opts.status || 'draft';
  const bedrooms = opts.bedrooms ?? 2;
  const maxGuests = opts.maxGuests ?? 4;
  const baseNightlyThb = opts.baseNightlyThb ?? 2000;
  const minNights = opts.minNights ?? 1;

  /*
   * The canonical guard (migration 20260913210000) refuses to insert a live
   * unit with no InventoryCategory, so one is made here rather than in every
   * test that wants a bookable villa.
   *
   * Two details the same trigger imposes, both easy to get wrong:
   *
   *   - It overwrites `category_key` from the category it points at. So the
   *     category is created carrying the key the caller asked for; inventing
   *     a different one would silently rewrite what the test asserts.
   *   - The category, not the unit, now owns the commercial terms that search
   *     and pricing read. The category therefore mirrors this unit's own
   *     terms, so a test that prices three villas differently still gets
   *     three different prices.
   *
   * Hence the default key is unique per unit: units only share a category
   * when a test names the same `categoryKey` on purpose. A non-live unit is
   * left without one, which the trigger permits and which keeps the previous
   * behaviour for tests that assert a null `categoryKey`.
   */
  let inventoryCategoryId = opts.inventoryCategoryId ?? null;
  if (!inventoryCategoryId && status === 'live') {
    const category = await createInventoryCategory({
      projectId: opts.projectId,
      categoryKey: opts.categoryKey,
      bedrooms,
      maxGuests,
      baseNightlyThb,
      minNights,
    });
    inventoryCategoryId = category.id;
  }

  return db.unit.create({
    data: {
      projectId: opts.projectId,
      ownerIdentityId: opts.ownerIdentityId,
      name: opts.name || `Unit-${uuid().slice(0, 8)}`,
      unitType: 'villa',
      categoryKey: opts.categoryKey ?? null,
      inventoryCategoryId,
      bedrooms,
      bathrooms: 1,
      maxGuests,
      addressSupplement: '101',
      baseNightlyThb,
      minNights,
      instantBook: opts.instantBook ?? true,
      status,
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
  providerId?: string;
  status?: 'active' | 'revoked';
}

export async function createRoleAssignment(opts: RoleAssignmentFactoryOpts) {
  const scopeType = opts.scopeType || 'platform';
  let projectId = opts.projectId;
  if (scopeType === 'unit' && opts.unitId && !projectId) {
    const unit = await db.unit.findUnique({
      where: { id: opts.unitId },
      select: { projectId: true },
    });
    projectId = unit?.projectId;
  }
  return db.roleAssignment.create({
    data: {
      identityId: opts.identityId,
      role: opts.role,
      scopeType,
      projectId,
      unitId: opts.unitId,
      providerId: opts.providerId,
      status: opts.status || 'active',
    },
  });
}

export async function createOrganization(
  name = `Org-${uuid().slice(0, 8)}`,
  projectId?: string,
  orgType: 'management_company' | 'juristic_person' | 'developer' = 'management_company'
) {
  return db.organization.create({
    data: {
      name,
      orgType,
      projectId,
      contactEmail: `org-${uuid().slice(0, 8)}@example.com`,
      contactPhone: '+66800000000',
      status: 'active',
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
  checkedOutAt?: Date | null;
  cancellationPolicySnapshot?: Record<string, unknown>;
}

export async function createBooking(opts: BookingFactoryOpts) {
  const startDate = opts.startDate || new Date('2026-07-15');
  const endDate =
    opts.endDate ||
    (opts.startDate
      ? new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000)
      : new Date('2026-07-17'));

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
      ...(opts.checkedOutAt !== undefined && { checkedOutAt: opts.checkedOutAt }),
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
  dateOfBirth?: string;
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
