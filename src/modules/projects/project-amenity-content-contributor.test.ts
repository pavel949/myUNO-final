import { describe, expect, it, vi } from 'vitest';
import { createProjectAmenityReservation } from './project-amenity-reservations.service';

function fixture(role = 'content_contributor', unitId: string | null = null, roleProjectId = 'project-a', ownBooking = false) {
  const roles = [{role, unitId, projectId: roleProjectId}];
  const db: any = {
    projectAmenity: {findUnique: vi.fn().mockResolvedValue({id: 'amenity', projectId: 'project-a', published: true, bookingRequired: true, bookingMode: 'time_slot', reservationConfig: {}, capacity: 10})},
    booking: {findFirst: vi.fn().mockResolvedValue(ownBooking ? {id: 'own-booking', unitId: 'unit-b'} : null)},
    roleAssignment: {findFirst: vi.fn(async ({where}: any) => roles.find(row => row.projectId === 'project-a' && row.role !== where.role?.not) ?? null)},
    projectAmenityReservation: {findMany: vi.fn().mockResolvedValue([]), create: vi.fn(async ({data}: any) => ({id: 'reservation', ...data}))},
    $transaction: async (run: any) => run(db),
  };
  const input = {amenityId: 'amenity', identityId: 'person', startAt: new Date('2099-01-02T12:00:00Z'), endAt: new Date('2099-01-02T13:00:00Z'), partySize: 1, now: new Date('2099-01-01T00:00:00Z')};
  return {db, input, roles};
}
describe('content contributor does not confer project amenity occupancy', () => {
  it.each([null, 'unit-a'])('denies a contributor-only %s scope', async unitId => {
    const h = fixture('content_contributor', unitId);
    await expect(createProjectAmenityReservation(h.db, h.input)).rejects.toThrow('Amenity access requires');
    expect(h.db.roleAssignment.findFirst).toHaveBeenCalledWith(expect.objectContaining({where: expect.objectContaining({role: {not: 'content_contributor'}})}));
    expect(h.db.projectAmenityReservation.create).not.toHaveBeenCalled();
  });
  it('denies an unrelated project role', async () => {
    const h = fixture('content_contributor', 'unit-c', 'project-c');
    await expect(createProjectAmenityReservation(h.db, h.input)).rejects.toThrow('Amenity access requires');
    expect(h.db.projectAmenityReservation.create).not.toHaveBeenCalled();
  });
  it('preserves the same identity’s independent eligible stay', async () => {
    const h = fixture('content_contributor', 'unit-a', 'project-a', true);
    expect(await createProjectAmenityReservation(h.db, h.input)).toMatchObject({status: 'confirmed', bookingId: 'own-booking', unitId: 'unit-b'});
    expect(h.db.roleAssignment.findFirst).not.toHaveBeenCalled();
  });
  it('preserves a separate legitimate owner role', async () => {
    const h = fixture(); h.roles.push({role: 'owner', unitId: 'unit-b', projectId: 'project-a'});
    expect(await createProjectAmenityReservation(h.db, h.input)).toMatchObject({status: 'confirmed', unitId: 'unit-b'});
  });
});
