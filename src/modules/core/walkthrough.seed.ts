import { PrismaClient } from '@prisma/client';

/**
 * Live state for the founder's walkthrough environment (T-041).
 *
 * `seedDemoData` builds the cast and the stage — identities in every role,
 * three units across the three engagement types, a vetted provider, config,
 * content. What it does not build is a story already in progress, and several
 * doc 07 flows have nothing to show without one: the in-stay home space needs
 * a guest who has checked in, the TM30 queue needs an arrival, an owner
 * statement needs a stay that finished and cost something.
 *
 * So this adds three stays at three points in the lifecycle, plus a ticket and
 * a service order. Booking from scratch stays fully walkable — nothing here
 * blocks the search-to-pay path a founder will want to try themselves; these
 * are simply the other flows' starting positions.
 *
 * Every write is keyed on a stable id so re-seeding is idempotent.
 */
export async function seedWalkthroughState(db: PrismaClient): Promise<void> {
  const project = await db.project.findUnique({ where: { slug: 'ignatev-showcase' } });
  if (!project) {
    console.log('  (walkthrough state skipped — demo project not found)');
    return;
  }

  const [unitDirect, unitMC] = await Promise.all([
    db.unit.findUnique({
      where: { projectId_name: { projectId: project.id, name: 'Villa A' } },
    }),
    db.unit.findUnique({
      where: { projectId_name: { projectId: project.id, name: 'Condo B-101' } },
    }),
  ]);

  const [guest, owner, ops] = await Promise.all([
    db.identity.findUnique({ where: { email: 'guest@ignatev.test' } }),
    db.identity.findUnique({ where: { email: 'owner@ignatev.test' } }),
    db.identity.findUnique({ where: { email: 'ops@ignatev.test' } }),
  ]);

  if (!unitDirect || !guest || !owner || !ops) {
    console.log('  (walkthrough state skipped — demo cast not found)');
    return;
  }

  // Anchor everything to today so the walkthrough reads the same whenever it
  // is seeded — a fixed date would drift into the past and empty the boards.
  const day = 24 * 60 * 60 * 1000;
  const midday = (offsetDays: number) => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return new Date(d.getTime() + offsetDays * day);
  };

  // ── 1. A stay that finished last month ──────────────────────────────────
  // Gives the owner statement something to total, the review prompt something
  // to attach to, and the buyer-signal detectors a completed stay to count.
  const pastStay = await db.booking.upsert({
    where: { id: 'demo-booking-past' },
    create: {
      id: 'demo-booking-past',
      unitId: unitDirect.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      bookingType: 'guest_stay',
      channel: 'direct',
      startDate: midday(-40),
      endDate: midday(-33),
      adults: 2,
      children: 0,
      totalThb: 42000,
      status: 'completed',
      checkedInAt: midday(-40),
      checkedOutAt: midday(-33),
      verificationStatus: 'passports_received',
    },
    update: {},
  });

  // The stay's money, so the ledger and any statement drawn from it are not
  // empty (doc 10 — every statement line traces to source rows).
  await db.ledgerEntry.upsert({
    where: { id: 'demo-ledger-past-revenue' },
    create: {
      id: 'demo-ledger-past-revenue',
      entryType: 'rental_revenue',
      amountThb: 42000,
      unitId: unitDirect.id,
      projectId: project.id,
      bookingId: pastStay.id,
      occurredOn: midday(-33),
      description: 'Stay revenue · Villa A',
    },
    update: {},
  });

  await db.ledgerEntry.upsert({
    where: { id: 'demo-ledger-past-cost' },
    create: {
      id: 'demo-ledger-past-cost',
      entryType: 'cleaning_cost',
      amountThb: 3500,
      unitId: unitDirect.id,
      projectId: project.id,
      bookingId: pastStay.id,
      occurredOn: midday(-33),
      description: 'Turnover clean · Villa A',
    },
    update: {},
  });

  // ── 2. A stay under way right now ───────────────────────────────────────
  // The in-stay home space (S6), the extension flow, and the TM30 queue all
  // need a guest who is actually in the building.
  const currentStay = await db.booking.upsert({
    where: { id: 'demo-booking-in-stay' },
    create: {
      id: 'demo-booking-in-stay',
      unitId: unitDirect.id,
      projectId: project.id,
      guestIdentityId: guest.id,
      bookingType: 'guest_stay',
      channel: 'direct',
      startDate: midday(-2),
      endDate: midday(4),
      adults: 2,
      children: 1,
      totalThb: 36000,
      status: 'checked_in',
      checkedInAt: midday(-2),
      verificationStatus: 'passports_received',
    },
    update: {},
  });

  // ── 3. An arrival still to come ─────────────────────────────────────────
  // Fills the ops arrivals board and gives cancellation and date-change
  // something upcoming to act on.
  if (unitMC) {
    await db.booking.upsert({
      where: { id: 'demo-booking-upcoming' },
      create: {
        id: 'demo-booking-upcoming',
        unitId: unitMC.id,
        projectId: project.id,
        guestIdentityId: guest.id,
        bookingType: 'guest_stay',
        channel: 'direct',
        startDate: midday(9),
        endDate: midday(14),
        adults: 2,
        children: 0,
        totalThb: 30000,
        status: 'confirmed',
        verificationStatus: 'pending',
      },
      update: {},
    });
  }

  // ── 4. An open ticket ───────────────────────────────────────────────────
  // The reporter sees the same timeline staff see (doc 09), which needs a
  // ticket that is actually open and inside its SLA.
  await db.ticket.upsert({
    where: { id: 'demo-ticket-open' },
    create: {
      id: 'demo-ticket-open',
      projectId: project.id,
      unitId: unitDirect.id,
      raisedByIdentityId: guest.id,
      raisedByRole: 'guest',
      assigneeIdentityId: ops.id,
      categoryKey: 'maintenance',
      title: 'Air conditioning in the main bedroom is noisy',
      description: 'It rattles at night. Not urgent, but hard to sleep through.',
      priority: 'normal',
      status: 'open',
      slaDueAt: midday(1),
    },
    update: {},
  });

  // ── 5. A service order against the current stay ─────────────────────────
  // Puts something in the guest's orders list and in the provider's queue.
  const service = await db.service.findUnique({ where: { id: 'demo-service-cleaning' } });
  if (service) {
    await db.serviceOrder.upsert({
      where: { id: 'demo-service-order' },
      create: {
        id: 'demo-service-order',
        service_id: service.id,
        provider_id: service.provider_id,
        project_id: project.id,
        unit_id: unitDirect.id,
        booking_id: currentStay.id,
        orderer_identity_id: guest.id,
        orderer_role: 'guest',
        scheduled_start: midday(2),
        scheduled_end: midday(2),
        quantity: 1,
        price_breakdown: { base: 50000, quantity: 1 },
        total_thb: 50000,
        take_rate_pct_snapshot: 15,
        status: 'accepted',
      },
      update: {},
    });
  }

  console.log('✓ Walkthrough state seeded:');
  console.log('  - A completed stay last month (statements, reviews, signals)');
  console.log('  - A stay in progress (home space, extension, TM30)');
  console.log('  - An arrival in nine days (ops board, cancellation, date change)');
  console.log('  - An open ticket inside its SLA');
  console.log('  - An accepted service order on the current stay');
}
