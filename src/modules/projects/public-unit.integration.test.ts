import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createProject, createUnit } from '@/test/util';
import { getPublicUnitById } from './public.service';

/**
 * Doc 08 §7: "Suspended/draft entities never render (404)."
 *
 * The unit page's booking widget is client-rendered, so this server-side gate
 * is the only thing standing between paused inventory and a live, indexable
 * page advertising it.
 */
describe('getPublicUnitById — what the public may see (T-035)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function liveProject() {
    const project = await createProject({ status: 'live' });
    return project;
  }

  it('returns a live unit in a live project', async () => {
    const project = await liveProject();
    const unit = await createUnit({ projectId: project.id, status: 'live' });

    const result = await getPublicUnitById(unit.id);

    expect(result?.id).toBe(unit.id);
    expect(result?.project.name).toBe(project.name);
    expect(result?.project.latitude).toBeTypeOf('number');
  });

  it('hides a draft unit', async () => {
    const project = await liveProject();
    const unit = await createUnit({ projectId: project.id, status: 'draft' });

    expect(await getPublicUnitById(unit.id)).toBeNull();
  });

  it('hides a paused unit', async () => {
    const project = await liveProject();
    const unit = await createUnit({ projectId: project.id, status: 'paused' });

    expect(await getPublicUnitById(unit.id)).toBeNull();
  });

  it('hides a live unit whose project is not live', async () => {
    const project = await createProject({ status: 'draft' });
    const unit = await createUnit({ projectId: project.id, status: 'live' });

    // The unit is ready but the residence is not announced — publishing the
    // unit would leak the project.
    expect(await getPublicUnitById(unit.id)).toBeNull();
  });

  it('returns null for an unknown id rather than throwing', async () => {
    expect(await getPublicUnitById('00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('never exposes the owner identity to the public shape', async () => {
    const project = await liveProject();
    const owner = await db.identity.create({
      data: { firstName: 'Own', lastName: 'Er', status: 'active' },
    });
    const unit = await createUnit({
      projectId: project.id,
      status: 'live',
      ownerIdentityId: owner.id,
    });

    const result = await getPublicUnitById(unit.id);

    expect(result).not.toBeNull();
    expect(JSON.stringify(result)).not.toContain(owner.id);
  });
});
