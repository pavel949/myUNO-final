import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import { getResidences } from './residence.service';
import { createAnnouncement, publishAnnouncement } from '@/modules/comms';

/**
 * A resident had no surface at all — the role could be granted and the person
 * had nowhere to go. These cover the part that matters once they do: a resident
 * of one building must see that building and learn nothing about another.
 */
describe('what a resident can see', () => {
  let residentId: string;
  let projectId: string;
  let staffId: string;

  beforeEach(async () => {
    await resetDb();
    const resident = await createIdentity({ firstName: 'Ivan', lastName: 'Ivanov' });
    residentId = resident.id;
    const staff = await createIdentity();
    staffId = staff.id;
    const project = await createProject({ name: 'Andaman One' });
    projectId = project.id;
  });

  const makeResident = async (scope: { projectId?: string; unitId?: string }) =>
    db.roleAssignment.create({
      data: {
        identityId: residentId,
        role: 'resident',
        scopeType: scope.unitId ? 'unit' : 'project',
        projectId: scope.projectId ?? null,
        unitId: scope.unitId ?? null,
        status: 'active',
      },
    });

  const announce = async (
    audience: 'everyone' | 'owners' | 'residents',
    title: string,
    project = projectId
  ) => {
    const { id } = await createAnnouncement(db, {
      projectId: project,
      createdByIdentityId: staffId,
      title,
      body: 'Body.',
      audience,
      postedAs: 'myuno',
    });
    await publishAnnouncement(db, id, staffId);
    return id;
  };

  it('is nothing at all when they hold no resident role', async () => {
    expect(await getResidences(db, residentId)).toEqual([]);
  });

  it('is the building their project-scoped role names', async () => {
    await makeResident({ projectId });

    const residences = await getResidences(db, residentId);

    expect(residences).toHaveLength(1);
    expect(residences[0].projectName).toBe('Andaman One');
  });

  it('resolves a unit-scoped role to the building that unit is in', async () => {
    // A resident role can be granted on one apartment. The person still lives
    // in the building, so the announcements they need are the building's.
    const unit = await createUnit({ projectId, name: 'B-707' });
    await makeResident({ unitId: unit.id });

    const residences = await getResidences(db, residentId);

    expect(residences).toHaveLength(1);
    expect(residences[0].projectId).toBe(projectId);
    expect(residences[0].units).toEqual([{ id: unit.id, name: 'B-707' }]);
  });

  it('lists a building once even when they hold several roles inside it', async () => {
    const first = await createUnit({ projectId, name: 'B-707' });
    const second = await createUnit({ projectId, name: 'B-708' });
    await makeResident({ unitId: first.id });
    await makeResident({ unitId: second.id });

    const residences = await getResidences(db, residentId);

    expect(residences).toHaveLength(1);
    expect(residences[0].units.map((u) => u.name).sort()).toEqual(['B-707', 'B-708']);
  });

  it('shows announcements addressed to residents and to everyone', async () => {
    await makeResident({ projectId });
    await announce('everyone', 'Pool closed');
    await announce('residents', 'Lift maintenance');

    const [residence] = await getResidences(db, residentId);

    expect(residence.announcements.map((a) => a.title).sort()).toEqual([
      'Lift maintenance',
      'Pool closed',
    ]);
  });

  it('does not show an announcement addressed to owners', async () => {
    // A resident is often a tenant, not the owner. Service-charge notices are
    // not theirs to read.
    await makeResident({ projectId });
    await announce('owners', 'Service charge review');

    const [residence] = await getResidences(db, residentId);
    expect(residence.announcements).toEqual([]);
  });

  it('tells them nothing about a building they do not live in', async () => {
    await makeResident({ projectId });
    const elsewhere = await createProject({ name: 'Other Residence' });
    await announce('everyone', 'Not your building', elsewhere.id);

    const residences = await getResidences(db, residentId);

    expect(residences).toHaveLength(1);
    expect(residences[0].projectName).toBe('Andaman One');
    expect(residences[0].announcements).toEqual([]);
  });

  it('ignores a revoked residency', async () => {
    const assignment = await makeResident({ projectId });
    await db.roleAssignment.update({
      where: { id: assignment.id },
      data: { status: 'revoked' },
    });

    expect(await getResidences(db, residentId)).toEqual([]);
  });
});
