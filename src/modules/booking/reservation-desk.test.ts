import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Reservation Desk canonical model', () => {
  const schema=readFileSync('prisma/schema.prisma','utf8');
  const service=readFileSync('src/modules/booking/reservation-group.service.ts','utf8');
  const manualRoute=readFileSync('src/app/api/ops/reservations/route.ts','utf8');

  it('groups existing canonical Bookings instead of creating a second reservation record', () => {
    expect(schema).toContain('model ReservationGroup {');
    expect(schema).toContain('bookings       Booking[]');
    expect(schema).toContain('reservationGroupId String?');
    expect(schema).toContain('model Booking {');
    expect(schema).not.toContain('model GroupBooking {');
  });

  it('keeps each child booking on its physical unit and canonical booking writer', () => {
    expect(manualRoute).toContain('createBooking(prisma');
    expect(manualRoute).not.toContain('prisma.booking.create(');
    expect(schema).toContain('unitId                     String');
  });

  it('rolls back group creation if concurrent linking makes the set incomplete', () => {
    expect(service).toContain("throw new Error('RESERVATION_GROUP_CONCURRENT_LINK_CONFLICT')");
    expect(service).toContain('if (linked.count !== bookingIds.length)');
  });

  it('requires Operating Space reservation capability for staff manual writes', () => {
    expect(manualRoute).toContain("'manage_reservations'");
    expect(manualRoute).toContain('getOperatingSpaceUnitIds');
  });
});
