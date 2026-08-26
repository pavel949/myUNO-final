import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  db,
  resetDb,
  createIdentity,
  createProject,
  createUnit,
  createUnitEngagement,
  createBooking,
} from '@/test/util';
import { raiseDispute, decideDispute, getOpenDisputes, getDisputeDetail } from './dispute.service';

describe('dispute.service — integration tests', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(async () => {
    await resetDb();
  });

  async function makeBooking(
    opts: { withPayment?: boolean; paymentMethod?: 'cash' | 'card_provider' } = {}
  ) {
    const guest = await createIdentity();
    const owner = await createIdentity();
    const project = await createProject();
    const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
    const booking = await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      status: 'confirmed',
    });

    let payment = null;
    if (opts.withPayment) {
      payment = await db.payment.create({
        data: {
          purpose: 'stay',
          bookingId: booking.id,
          payerIdentityId: guest.id,
          method: opts.paymentMethod ?? 'cash',
          provider: opts.paymentMethod === 'card_provider' ? 'opn' : 'cash',
          amountThb: booking.totalThb,
          status: 'succeeded',
        },
      });
    }

    return { guest, owner, project, unit, booking, payment };
  }

  describe('raiseDispute', () => {
    it('creates a dispute over a booking, backed by a complaint ticket', async () => {
      const { guest, booking } = await makeBooking();

      const dispute = await raiseDispute(db, {
        subjectType: 'booking',
        subjectId: booking.id,
        raisedByIdentityId: guest.id,
        raisedByRole: 'guest',
        title: 'Overcharged for extra guest',
        description: 'We were charged for a fifth guest who never stayed.',
      });

      expect(dispute.id).toBeDefined();
      expect(dispute.subjectType).toBe('booking');
      expect(dispute.subjectId).toBe(booking.id);
      expect(dispute.decidedAt).toBeNull();

      const ticket = await db.ticket.findUnique({ where: { id: dispute.ticketId } });
      expect(ticket).not.toBeNull();
      expect(ticket?.title).toBe('Overcharged for extra guest');
    });

    it('refuses a dispute raised over someone else’s booking', async () => {
      const { booking } = await makeBooking();
      const stranger = await createIdentity();

      await expect(
        raiseDispute(db, {
          subjectType: 'booking',
          subjectId: booking.id,
          raisedByIdentityId: stranger.id,
          raisedByRole: 'guest',
          title: 'Not my booking',
          description: 'Should be refused',
        })
      ).rejects.toThrow(/your own/);
    });

    it('refuses a second dispute over the same record', async () => {
      const { guest, booking } = await makeBooking();

      await raiseDispute(db, {
        subjectType: 'booking',
        subjectId: booking.id,
        raisedByIdentityId: guest.id,
        raisedByRole: 'guest',
        title: 'First dispute',
        description: 'Initial complaint',
      });

      await expect(
        raiseDispute(db, {
          subjectType: 'booking',
          subjectId: booking.id,
          raisedByIdentityId: guest.id,
          raisedByRole: 'guest',
          title: 'Second dispute',
          description: 'Trying again',
        })
      ).rejects.toThrow(/already been raised/);
    });
  });

  describe('decideDispute', () => {
    it('resolves a cash-paid booking dispute with a cash refund', async () => {
      const { guest, booking } = await makeBooking({ withPayment: true, paymentMethod: 'cash' });
      const admin = await createIdentity({ isAdmin: true });

      const dispute = await raiseDispute(db, {
        subjectType: 'booking',
        subjectId: booking.id,
        raisedByIdentityId: guest.id,
        raisedByRole: 'guest',
        title: 'Wrong amount charged',
        description: 'Please review the charge',
      });

      const decided = await decideDispute(db, {
        disputeId: dispute.id,
        decidedByIdentityId: admin.id,
        resolutionAmountThb: 500,
        decisionNote: 'Goodwill refund for the billing error.',
      });

      expect(decided.decidedAt).not.toBeNull();
      expect(decided.resolutionAmountThb).toBe(500);
      expect(decided.refundId).not.toBeNull();
      expect(decided.ledgerEntryId).toBeNull();

      const refundRecord = await db.refund.findUnique({ where: { id: decided.refundId! } });
      expect(refundRecord?.amountThb).toBe(500);
      expect(refundRecord?.reason).toBe('dispute_resolution');
      expect(refundRecord?.method).toBe('cash');

      const ticket = await db.ticket.findUnique({ where: { id: dispute.ticketId } });
      expect(ticket?.status).toBe('resolved');
    });

    it('resolves a card-paid booking dispute through the provider refund seam', async () => {
      const { guest, booking } = await makeBooking({ withPayment: true, paymentMethod: 'card_provider' });
      const admin = await createIdentity({ isAdmin: true });

      const dispute = await raiseDispute(db, {
        subjectType: 'booking',
        subjectId: booking.id,
        raisedByIdentityId: guest.id,
        raisedByRole: 'guest',
        title: 'Card charge dispute',
        description: 'Overcharged',
      });

      const decided = await decideDispute(db, {
        disputeId: dispute.id,
        decidedByIdentityId: admin.id,
        resolutionAmountThb: 1000,
        decisionNote: 'Full refund of the disputed line item.',
      });

      expect(decided.refundId).not.toBeNull();
      const refundRecord = await db.refund.findUnique({ where: { id: decided.refundId! } });
      expect(refundRecord?.method).toBe('card_provider');
    });

    it('resolves a statement dispute with a ledger adjustment, not a refund', async () => {
      const owner = await createIdentity();
      const project = await createProject();
      const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
      const engagement = await createUnitEngagement({ unitId: unit.id, ownerIdentityId: owner.id, status: 'active' });
      const admin = await createIdentity({ isAdmin: true });

      const statement = await db.ownerStatement.create({
        data: {
          unitId: unit.id,
          ownerIdentityId: owner.id,
          engagementId: engagement.id,
          periodStart: new Date('2026-06-01'),
          periodEnd: new Date('2026-06-30'),
          grossRevenueTh: 50_000,
          totalCostsTh: 10_000,
          noiTh: 40_000,
          ownerShareTh: 35_000,
          estateShareTh: 5_000,
          status: 'published',
        },
      });

      const dispute = await raiseDispute(db, {
        subjectType: 'statement',
        subjectId: statement.id,
        raisedByIdentityId: owner.id,
        raisedByRole: 'owner',
        title: 'Expense line looks wrong',
        description: 'This maintenance cost was never approved.',
      });

      const decided = await decideDispute(db, {
        disputeId: dispute.id,
        decidedByIdentityId: admin.id,
        resolutionAmountThb: 2000,
        decisionNote: 'Reversing the disputed maintenance line item.',
      });

      expect(decided.refundId).toBeNull();
      expect(decided.ledgerEntryId).not.toBeNull();

      const entry = await db.ledgerEntry.findUnique({ where: { id: decided.ledgerEntryId! } });
      expect(entry?.entryType).toBe('adjustment');
      expect(entry?.amountThb).toBe(-2000);
      expect(entry?.unitId).toBe(unit.id);
    });

    it('records a decision with no money owed when the amount is omitted', async () => {
      const { guest, booking } = await makeBooking();
      const admin = await createIdentity({ isAdmin: true });

      const dispute = await raiseDispute(db, {
        subjectType: 'booking',
        subjectId: booking.id,
        raisedByIdentityId: guest.id,
        raisedByRole: 'guest',
        title: 'Just a clarification',
        description: 'No money involved, just wanted an answer.',
      });

      const decided = await decideDispute(db, {
        disputeId: dispute.id,
        decidedByIdentityId: admin.id,
        decisionNote: 'Explained the charge; no adjustment needed.',
      });

      expect(decided.resolutionAmountThb).toBeNull();
      expect(decided.refundId).toBeNull();
      expect(decided.ledgerEntryId).toBeNull();
      expect(decided.decidedAt).not.toBeNull();
    });

    it('refuses to decide an already-decided dispute', async () => {
      const { guest, booking } = await makeBooking();
      const admin = await createIdentity({ isAdmin: true });

      const dispute = await raiseDispute(db, {
        subjectType: 'booking',
        subjectId: booking.id,
        raisedByIdentityId: guest.id,
        raisedByRole: 'guest',
        title: 'First',
        description: 'Complaint',
      });

      await decideDispute(db, {
        disputeId: dispute.id,
        decidedByIdentityId: admin.id,
        decisionNote: 'Resolved.',
      });

      await expect(
        decideDispute(db, {
          disputeId: dispute.id,
          decidedByIdentityId: admin.id,
          decisionNote: 'Trying again.',
        })
      ).rejects.toThrow(/already been decided/);
    });

    it('refuses a negative resolution amount', async () => {
      const { guest, booking } = await makeBooking();
      const admin = await createIdentity({ isAdmin: true });

      const dispute = await raiseDispute(db, {
        subjectType: 'booking',
        subjectId: booking.id,
        raisedByIdentityId: guest.id,
        raisedByRole: 'guest',
        title: 'First',
        description: 'Complaint',
      });

      await expect(
        decideDispute(db, {
          disputeId: dispute.id,
          decidedByIdentityId: admin.id,
          resolutionAmountThb: -100,
          decisionNote: 'Invalid.',
        })
      ).rejects.toThrow(/not be negative/);
    });
  });

  describe('getOpenDisputes', () => {
    it('lists only undecided disputes, newest first', async () => {
      const { guest: guest1, booking: booking1 } = await makeBooking();
      const { guest: guest2, booking: booking2 } = await makeBooking();
      const admin = await createIdentity({ isAdmin: true });

      const older = await raiseDispute(db, {
        subjectType: 'booking',
        subjectId: booking1.id,
        raisedByIdentityId: guest1.id,
        raisedByRole: 'guest',
        title: 'Older dispute',
        description: 'First one raised',
      });
      const newer = await raiseDispute(db, {
        subjectType: 'booking',
        subjectId: booking2.id,
        raisedByIdentityId: guest2.id,
        raisedByRole: 'guest',
        title: 'Newer dispute',
        description: 'Second one raised',
      });
      await decideDispute(db, {
        disputeId: older.id,
        decidedByIdentityId: admin.id,
        decisionNote: 'Already handled — should not show up as open.',
      });

      const open = await getOpenDisputes(db);
      expect(open.map((d) => d.id)).toEqual([newer.id]);
      expect(open[0].ticket.title).toBe('Newer dispute');
    });
  });

  describe('getDisputeDetail', () => {
    it('returns full detail including the decision once made', async () => {
      const { guest, booking } = await makeBooking();
      const admin = await createIdentity({ isAdmin: true });

      const dispute = await raiseDispute(db, {
        subjectType: 'booking',
        subjectId: booking.id,
        raisedByIdentityId: guest.id,
        raisedByRole: 'guest',
        title: 'Detail check',
        description: 'Body text',
      });
      await decideDispute(db, {
        disputeId: dispute.id,
        decidedByIdentityId: admin.id,
        decisionNote: 'Resolved with no payout.',
      });

      const detail = await getDisputeDetail(db, dispute.id);
      expect(detail?.ticket.status).toBe('resolved');
      expect(detail?.decidedBy?.firstName).toBeDefined();
    });
  });
});
