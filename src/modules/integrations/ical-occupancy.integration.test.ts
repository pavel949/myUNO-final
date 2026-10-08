import { beforeEach, describe, expect, it } from 'vitest';
import type { BookingStatus, PaymentMethod } from '@prisma/client';
import { NextRequest } from 'next/server';
import { createBooking, createIdentity, createProject, createUnit, db, resetDb } from '@/test/util';
import { GET as exportCalendar } from '@/app/api/units/[unitId]/ical/export/route';
import { icalFeedToken } from './ical-token';
import { importICalEvents } from './ical-import';
import { registerIntegrationAccount } from './integrations';
import { getProjectIcalConflictAlerts, getUnitIcalConflictAlerts } from './unit-ical-conflicts';

const cases: Array<{ label: string; status: BookingStatus; blocks: boolean; expiryMs?: number; method?: PaymentMethod }> = [
  { label: 'unapproved request', status: 'requested', blocks: false },
  { label: 'declined request', status: 'declined', blocks: false },
  { label: 'expired reservation', status: 'expired', blocks: false },
  { label: 'cancelled reservation', status: 'cancelled', blocks: false },
  { label: 'checked-out stay', status: 'checked_out', blocks: false },
  { label: 'completed stay', status: 'completed', blocks: false },
  { label: 'elapsed card hold', status: 'pending_payment', method: 'card_provider', expiryMs: -60_000, blocks: false },
  { label: 'active card hold', status: 'pending_payment', method: 'card_provider', expiryMs: 3_600_000, blocks: true },
  { label: 'untimed cash reservation', status: 'pending_payment', method: 'cash', blocks: true },
  { label: 'untimed transfer reservation', status: 'pending_payment', method: 'bank_transfer', blocks: true },
  { label: 'confirmed stay', status: 'confirmed', blocks: true },
  { label: 'checked-in stay', status: 'checked_in', blocks: true },
];

describe('iCal shares canonical booking occupancy', () => {
  beforeEach(resetDb);
  async function fixture(item: typeof cases[number]) {
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, status: 'live' });
    const guest = await createIdentity();
    const booking = await createBooking({ unitId: unit.id, projectId: project.id, guestIdentityId: guest.id,
      startDate: new Date('2027-05-10'), endDate: new Date('2027-05-14'), status: item.status,
      holdExpiresAt: item.expiryMs === undefined ? null : new Date(Date.now() + item.expiryMs) });
    if (item.method) await db.booking.update({ where: { id: booking.id }, data: { paymentMethod: item.method } });
    return { project, unit, guest, booking };
  }

  it.each(cases)('exports occupancy correctly for $label', async (item) => {
    const { unit } = await fixture(item);
    const response = await exportCalendar(new NextRequest(
      `http://localhost/api/units/${unit.id}/ical/export?token=${icalFeedToken(unit.id)}`,
    ), { params: { unitId: unit.id } });
    expect(response.status).toBe(200);
    expect((await response.text()).includes('DTSTART;VALUE=DATE:20270510')).toBe(item.blocks);
  });

  it.each(cases)('recognizes import conflicts correctly for $label', async (item) => {
    const { unit, booking } = await fixture(item);
    const integration = await registerIntegrationAccount(db, 'ical_airbnb', 'unit',
      { ical_url: 'https://example.invalid/synthetic-test.ics' }, unit.id);
    // Already parsed synthetic event: no URL fetch, scheduler or provider call.
    const result = await importICalEvents(db, integration.id, unit.id, [{ uid: 'synthetic-event',
      summary: 'Synthetic occupancy', dtStart: new Date('2027-05-11'), dtEnd: new Date('2027-05-13') }]);
    expect(result.errors).toEqual([]);
    expect(result.conflicts.map(conflict => conflict.conflictingBooking.id)).toEqual(item.blocks ? [booking.id] : []);
    expect(await db.blockedDate.count({ where: { unitId: unit.id } })).toBe(item.blocks ? 0 : 1);
  });

  it.each(cases)('shows current unit and portfolio alerts correctly for $label', async (item) => {
    const { project, unit, guest, booking } = await fixture(item);
    await db.notification.create({ data: { identityId: guest.id, type: 'ops_ical_conflict',
      titleKey: 'notify.ops.ical_conflict.title', bodyKey: 'notify.ops.ical_conflict.body',
      params: { booking_id: booking.id, start_date: '2027-05-11', end_date: '2027-05-13' } } });
    const expected = item.blocks ? [booking.id] : [];
    expect((await getUnitIcalConflictAlerts(db, unit.id)).map(alert => alert.bookingId)).toEqual(expected);
    expect((await getProjectIcalConflictAlerts(db, { projectIds: [project.id], unitIds: [unit.id] }))
      .map(alert => alert.bookingId)).toEqual(expected);
    expect(await getProjectIcalConflictAlerts(db, { projectIds: [] })).toEqual([]);
  });
});
