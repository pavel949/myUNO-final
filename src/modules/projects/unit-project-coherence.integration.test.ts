import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import { ManagementFeeBasis } from '@prisma/client';

/**
 * A unit's project is the only authority on which project a row belongs to.
 *
 * The services already derived it correctly; the database did not care. Any
 * writer that bypassed them — a script, a seed, a future route — could file a
 * booking, a management contract or a role assignment against a project that
 * does not contain the unit. These tests are against the triggers and the
 * check constraint in migration 20260907001000, not against any service, so
 * they fail if the migration is ever dropped or relaxed again.
 */
describe('the database refuses a project that is not the unit\'s project', () => {
  let homeProjectId: string;
  let otherProjectId: string;
  let unitId: string;
  let identityId: string;

  beforeEach(async () => {
    await resetDb();

    const home = await createProject({ slug: 'coherence-home', status: 'live' });
    const other = await createProject({ slug: 'coherence-other', status: 'live' });
    homeProjectId = home.id;
    otherProjectId = other.id;

    const identity = await createIdentity();
    identityId = identity.id;

    const unit = await createUnit({ projectId: homeProjectId, name: 'Villa A' });
    unitId = unit.id;
  });

  it('refuses a booking filed under another project', async () => {
    await expect(
      db.booking.create({
        data: {
          unitId,
          projectId: otherProjectId,
          guestIdentityId: identityId,
          bookingType: 'guest_stay',
          channel: 'direct',
          startDate: new Date('2027-01-10'),
          endDate: new Date('2027-01-14'),
          adults: 2,
          children: 0,
          totalThb: 100_000,
        },
      })
    ).rejects.toThrow(/only authority/);
  });

  it('refuses moving an existing booking to another project', async () => {
    const booking = await db.booking.create({
      data: {
        unitId,
        projectId: homeProjectId,
        guestIdentityId: identityId,
        bookingType: 'guest_stay',
        channel: 'direct',
        startDate: new Date('2027-02-10'),
        endDate: new Date('2027-02-14'),
        adults: 2,
        children: 0,
        totalThb: 100_000,
      },
    });

    await expect(
      db.booking.update({
        where: { id: booking.id },
        data: { projectId: otherProjectId },
      })
    ).rejects.toThrow(/only authority/);
  });

  it('refuses a management contract filed under another project', async () => {
    await expect(
      db.managementContract.create({
        data: {
          unitId,
          projectId: otherProjectId,
          ownerIdentityId: identityId,
          managementFeeBasis: ManagementFeeBasis.percentage_noi,
          managementFeeRate: 0.15,
          contractStartDate: new Date('2027-01-01'),
        },
      })
    ).rejects.toThrow(/only authority/);
  });

  it('refuses a unit-scoped role assignment naming another project', async () => {
    await expect(
      db.roleAssignment.create({
        data: {
          identityId,
          role: 'owner',
          scopeType: 'unit',
          projectId: otherProjectId,
          unitId,
        },
      })
    ).rejects.toThrow(/only authority/);
  });

  /**
   * Migration 20260904062200 dropped this requirement to accommodate fixtures
   * that no longer violate it. It was never harmless:
   * `getIdentityRoles(identity, { projectId })` filters on `project_id`, so a
   * unit-scoped role written without one is invisible to every project-scoped
   * permission read — the holder silently loses the access they were granted.
   */
  it('refuses a unit-scoped role assignment with no project at all', async () => {
    await expect(
      db.roleAssignment.create({
        data: {
          identityId,
          role: 'owner',
          scopeType: 'unit',
          unitId,
        },
      })
    ).rejects.toThrow(/only authority/);
  });

  it('has the scope shape constraint back, and validated against existing rows', async () => {
    // `NOT VALID` means Postgres enforces the rule going forward but has never
    // checked what is already stored — which is how 20260904062200 left it. A
    // constraint nobody validated is a claim, not a guarantee, so assert the
    // flag rather than trusting the migration ran.
    const [constraint] = await db.$queryRaw<Array<{ convalidated: boolean }>>`
      SELECT convalidated FROM pg_constraint
       WHERE conname = 'role_assignment_scope_shape_check'
    `;

    expect(constraint).toBeDefined();
    expect(constraint.convalidated).toBe(true);
  });

  it('accepts the coherent rows all three tables are meant to hold', async () => {
    const booking = await db.booking.create({
      data: {
        unitId,
        projectId: homeProjectId,
        guestIdentityId: identityId,
        bookingType: 'guest_stay',
        channel: 'direct',
        startDate: new Date('2027-03-10'),
        endDate: new Date('2027-03-14'),
        adults: 2,
        children: 0,
        totalThb: 100_000,
      },
    });
    expect(booking.projectId).toBe(homeProjectId);

    const role = await db.roleAssignment.create({
      data: {
        identityId,
        role: 'owner',
        scopeType: 'unit',
        projectId: homeProjectId,
        unitId,
      },
    });
    expect(role.projectId).toBe(homeProjectId);

    // A row that names only a project is not this constraint's business.
    const platformRole = await db.roleAssignment.create({
      data: { identityId, role: 'guest', scopeType: 'project', projectId: otherProjectId },
    });
    expect(platformRole.unitId).toBeNull();
  });
});
