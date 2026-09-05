import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit, createBooking } from '@/test/util';
import { seedConfig, setConfigOverride, clearConfigCache } from '@/modules/config';
import {
  fileDepositClaim,
  approveClaim,
  rejectClaim,
  getStaysOpenToClaim,
  getClaimsAwaitingResolution,
  scheduleDepositPreauth,
  disputeDepositClaim,
  getActiveDepositClaimForGuest,
} from './deposits.service';

/**
 * Damage claims existed as three tested functions with no caller: a deposit
 * could be pre-authorized and a claim against it could never be raised or
 * resolved, so the hold simply expired at the provider whatever the unit looked
 * like. These cover the parts that decide whether a guest's money moves.
 */
describe('a damage claim', () => {
  let bookingId: string;
  let projectId: string;
  let staffId: string;

  const HOUR = 60 * 60 * 1000;

  beforeEach(async () => {
    await resetDb();
    clearConfigCache();
    await seedConfig(db);

    const project = await createProject();
    projectId = project.id;
    const unit = await createUnit(projectId);
    const guest = await createIdentity();
    const staff = await createIdentity();
    staffId = staff.id;

    const booking = await createBooking({
      unitId: unit.id,
      projectId,
      guestIdentityId: guest.id,
      status: 'checked_out',
      checkedOutAt: new Date(Date.now() - 2 * HOUR),
    });
    bookingId = booking.id;
    await scheduleDepositPreauth(db, bookingId, 500_000);
  });

  const file = () =>
    fileDepositClaim(db, {
      bookingId,
      claimantIdentityId: staffId,
      description: 'Broken lamp in the living room',
      claimedAmountThb: 120_000,
    });

  it('can be filed inside the window and shows up for adjudication', async () => {
    const claim = await file();
    expect(claim.status).toBe('filed');

    const notifications = await db.notification.findMany({
      where: { type: 'stay_damage_claim' },
    });
    expect(notifications).toHaveLength(1);

    const awaiting = await getClaimsAwaitingResolution(db);
    expect(awaiting).toHaveLength(1);
    // Whoever decides needs to see what is actually held before deciding how
    // much of it to take.
    expect(awaiting[0].booking.depositPreauth?.amountThb).toBe(500_000);
    expect(awaiting[0].booking.unit?.name).toBeTruthy();
  });

  it('cannot be filed for a stay that has not checked out', async () => {
    await db.booking.update({ where: { id: bookingId }, data: { checkedOutAt: null } });
    await expect(file()).rejects.toThrow(/not checked out/i);
  });

  it('cannot be filed once the window has closed', async () => {
    await db.booking.update({
      where: { id: bookingId },
      data: { checkedOutAt: new Date(Date.now() - 72 * HOUR) },
    });
    await expect(file()).rejects.toMatchObject({ code: 'WINDOW_CLOSED' });
  });

  it('takes its window from configuration, not from a number in the code', async () => {
    // A project that wants a tighter window must be able to have one without a
    // deployment (doc 04).
    await setConfigOverride(db, 'booking.deposit.claim_window_hours', 1, {
      scopeType: 'project',
      scopeId: projectId,
      changedByIdentityId: staffId,
    });
    clearConfigCache();

    // Checked out two hours ago: inside the default 48, outside the new 1.
    await expect(file()).rejects.toMatchObject({ code: 'WINDOW_CLOSED' });
  });

  it('refuses a zero or negative amount', async () => {
    await expect(
      fileDepositClaim(db, {
        bookingId,
        claimantIdentityId: staffId,
        description: 'Nothing really',
        claimedAmountThb: 0,
      })
    ).rejects.toThrow(/positive amount/i);
  });
});

describe('resolving a claim', () => {
  let claimId: string;
  let bookingId: string;
  let staffId: string;

  const HOUR = 60 * 60 * 1000;

  beforeEach(async () => {
    await resetDb();
    clearConfigCache();
    await seedConfig(db);

    const project = await createProject();
    const unit = await createUnit(project.id);
    const guest = await createIdentity();
    const staff = await createIdentity();
    staffId = staff.id;

    const booking = await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'checked_out',
      checkedOutAt: new Date(Date.now() - HOUR),
    });
    bookingId = booking.id;
    await scheduleDepositPreauth(db, bookingId, 500_000);

    const claim = await fileDepositClaim(db, {
      bookingId,
      claimantIdentityId: staffId,
      description: 'Broken lamp',
      claimedAmountThb: 120_000,
    });
    claimId = claim.id;
  });

  it('approving captures the pre-authorization', async () => {
    const approved = await approveClaim(db, claimId, 'Photographed at check-out');
    expect(approved.status).toBe('approved');
    expect(approved.resolutionNote).toBe('Photographed at check-out');

    const preauth = await db.depositPreauth.findUnique({ where: { bookingId } });
    expect(preauth!.status).toBe('captured');
  });

  it('rejecting releases the pre-authorization', async () => {
    const rejected = await rejectClaim(db, claimId, 'Wear and tear');
    expect(rejected.status).toBe('rejected');

    const preauth = await db.depositPreauth.findUnique({ where: { bookingId } });
    expect(preauth!.status).toBe('voided');
  });

  it('cannot be resolved twice', async () => {
    await rejectClaim(db, claimId);
    await expect(approveClaim(db, claimId, 'Changed my mind')).rejects.toMatchObject({
      code: 'ALREADY_RESOLVED',
    });
  });

  describe('once the approval window has passed', () => {
    beforeEach(async () => {
      await db.depositClaim.update({
        where: { id: claimId },
        data: { filedAt: new Date(Date.now() - 72 * HOUR) },
      });
    });

    it('refuses to approve, so money is not taken late', async () => {
      await expect(approveClaim(db, claimId, 'Late')).rejects.toMatchObject({
        code: 'WINDOW_CLOSED',
      });
    });

    it('still allows rejection, because releasing money must always be possible', async () => {
      // If rejection expired too, a claim nobody got to would leave the guest's
      // pre-authorization stranded — neither captured nor released. Holding a
      // guest's money because an admin was away is fund-holding by neglect.
      const rejected = await rejectClaim(db, claimId, 'Nobody got to it in time');
      expect(rejected.status).toBe('rejected');

      const preauth = await db.depositPreauth.findUnique({ where: { bookingId } });
      expect(preauth!.status).toBe('voided');
    });
  });
});

describe('which stays a staff member can still claim against', () => {
  const HOUR = 60 * 60 * 1000;

  beforeEach(async () => {
    await resetDb();
    clearConfigCache();
    await seedConfig(db);
  });

  it('lists a recent check-out with the hours it has left, and omits an old one', async () => {
    const project = await createProject();
    const unit = await createUnit(project.id);
    const guest = await createIdentity();

    const recent = await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'checked_out',
      checkedOutAt: new Date(Date.now() - 6 * HOUR),
    });
    await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-03'),
      status: 'checked_out',
      checkedOutAt: new Date(Date.now() - 100 * HOUR),
    });

    const open = await getStaysOpenToClaim(db);

    expect(open.map((s) => s.bookingId)).toEqual([recent.id]);
    expect(open[0].hoursLeft).toBeGreaterThan(40);
    expect(open[0].hoursLeft).toBeLessThanOrEqual(42);
  });

  it('omits a stay that has not checked out at all', async () => {
    const project = await createProject();
    const unit = await createUnit(project.id);
    const guest = await createIdentity();
    await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'checked_in',
    });

    expect(await getStaysOpenToClaim(db)).toEqual([]);
  });
});

describe('a guest disputing a damage claim', () => {
  const HOUR = 60 * 60 * 1000;

  it('marks the claim disputed and opens a dispute ticket', async () => {
    await resetDb();
    clearConfigCache();
    await seedConfig(db);

    const project = await createProject();
    const unit = await createUnit(project.id);
    const guest = await createIdentity();
    const staff = await createIdentity();

    const booking = await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'checked_out',
      checkedOutAt: new Date(Date.now() - HOUR),
    });
    await scheduleDepositPreauth(db, booking.id, 500_000);

    const claim = await fileDepositClaim(db, {
      bookingId: booking.id,
      claimantIdentityId: staff.id,
      description: 'Broken lamp',
      claimedAmountThb: 120_000,
    });

    const guestView = await getActiveDepositClaimForGuest(db, booking.id);
    expect(guestView?.canDispute).toBe(true);

    const disputed = await disputeDepositClaim(db, {
      claimId: claim.id,
      guestIdentityId: guest.id,
      raisedByRole: 'guest',
      title: 'I disagree with this claim',
      description: 'The lamp was already broken when I arrived.',
    });
    expect(disputed.status).toBe('disputed');

    const after = await getActiveDepositClaimForGuest(db, booking.id);
    expect(after?.canDispute).toBe(false);

    const dispute = await db.dispute.findFirst({
      where: { subjectType: 'booking', subjectId: booking.id },
    });
    expect(dispute).toBeTruthy();
  });
});
