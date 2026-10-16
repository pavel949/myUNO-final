import { describe, expect, it, vi } from 'vitest';
import { createProjectAmenityReservation } from './project-amenity-reservations.service';

function fixture(role = 'content_contributor', unitId: string | null = null, roleProjectId = 'project-a', ownBooking = false, projectStatus = 'live') {
  const roles = [{role, unitId, projectId: roleProjectId}];
  const db: any = {
    projectAmenity: {findUnique: vi.fn().mockResolvedValue({id: 'amenity', projectId: 'project-a', published: true, project: { status: projectStatus }, bookingRequired: true, bookingMode: 'time_slot', reservationConfig: {}, capacity: 10})},
    booking: {findFirst: vi.fn().mockResolvedValue(ownBooking ? {id: 'own-booking', unitId: 'unit-b'} : null)},
    roleAssignment: {findFirst: vi.fn(async ({where}: any) => roles.find(row => row.projectId === 'project-a' && !where.role?.notIn?.includes(row.role)) ?? null)},
    projectAmenityReservation: {findMany: vi.fn().mockResolvedValue([]), create: vi.fn(async ({data}: any) => ({id: 'reservation', ...data}))},
    $transaction: async (run: any) => run(db),
  };
  const input = {amenityId: 'amenity', identityId: 'person', startAt: new Date('2099-01-02T12:00:00Z'), endAt: new Date('2099-01-02T13:00:00Z'), partySize: 1, now: new Date('2099-01-01T00:00:00Z')};
  return {db, input, roles};
}
describe.each(['content_contributor', 'pricing_editor', 'booking_mode_editor'])('%s does not confer project amenity occupancy', restrictedRole => {
  it.each([null, 'unit-a'])('denies a contributor-only %s scope', async unitId => {
    const h = fixture(restrictedRole, unitId);
    await expect(createProjectAmenityReservation(h.db, h.input)).rejects.toThrow('Amenity access requires');
    expect(h.db.roleAssignment.findFirst).toHaveBeenCalledWith(expect.objectContaining({where: expect.objectContaining({role: {notIn: ['content_contributor', 'pricing_editor', 'booking_mode_editor']}})}));
    expect(h.db.projectAmenityReservation.create).not.toHaveBeenCalled();
  });
  it('denies an unrelated project role', async () => {
    const h = fixture(restrictedRole, 'unit-c', 'project-c');
    await expect(createProjectAmenityReservation(h.db, h.input)).rejects.toThrow('Amenity access requires');
    expect(h.db.projectAmenityReservation.create).not.toHaveBeenCalled();
  });
  it('preserves the same identity’s independent eligible stay', async () => {
    const h = fixture(restrictedRole, 'unit-a', 'project-a', true);
    expect(await createProjectAmenityReservation(h.db, h.input)).toMatchObject({status: 'confirmed', bookingId: 'own-booking', unitId: 'unit-b'});
    expect(h.db.roleAssignment.findFirst).not.toHaveBeenCalled();
  });
  it('preserves a separate legitimate owner role', async () => {
    const h = fixture(restrictedRole); h.roles.push({role: 'owner', unitId: 'unit-b', projectId: 'project-a'});
    expect(await createProjectAmenityReservation(h.db, h.input)).toMatchObject({status: 'confirmed', unitId: 'unit-b'});
  });
});

it.each(['draft', 'archived'])('rejects direct native reservation writes for a %s project even with an eligible stay', async projectStatus => {
  const h = fixture('owner', 'unit-a', 'project-a', true, projectStatus);
  await expect(createProjectAmenityReservation(h.db, h.input)).rejects.toMatchObject({ message: 'Amenity not available', statusCode: 404, isPublic: true });
  expect(h.db.booking.findFirst).not.toHaveBeenCalled();
  expect(h.db.projectAmenityReservation.create).not.toHaveBeenCalled();
});
it('does not let privileged reservation callers bypass an unpublished project', async () => {
  const h = fixture('staff_ops', null, 'project-a', false, 'draft');
  await expect(createProjectAmenityReservation(h.db, { ...h.input, privileged: true })).rejects.toMatchObject({ message: 'Amenity not available', statusCode: 404, isPublic: true });
  expect(h.db.projectAmenityReservation.create).not.toHaveBeenCalled();
});
