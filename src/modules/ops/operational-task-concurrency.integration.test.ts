import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb, createProject, createUnit } from '@/test/util';
import { createOperationalTask, transitionOperationalTask } from './operational-task.service';

async function fixture() {
  const project = await createProject();
  const unit = await createUnit({ projectId: project.id });
  const task = await db.operationalTask.create({ data: {
    projectId: project.id, unitId: unit.id, taskType: 'custom', status: 'in_progress',
    dueAt: new Date(), startedAt: new Date(), blocksInventory: true,
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  } });
  return { project, unit, task };
}
describe('Canonical task mutation validation and optimistic concurrency', () => {
  beforeEach(resetDb);
  it('lets one concurrent transition win and cannot overwrite ready with a stale blocked transition', async () => {
    const f = await fixture();
    let arrivals = 0;
    let releaseReaders!: () => void;
    const bothRead = new Promise<void>(resolve => { releaseReaders = resolve; });
    let releaseReady!: () => void;
    const readyWritten = new Promise<void>(resolve => { releaseReady = resolve; });
    const racing = db.$extends({ query: { operationalTask: { async updateMany({ args, query }) {
      if (args.where?.id !== f.task.id) return query(args);
      if (++arrivals === 2) releaseReaders();
      await bothRead;
      if (args.data.status === 'blocked') await readyWritten;
      const result = await query(args);
      if (args.data.status === 'ready') releaseReady();
      return result;
    } } } }) as unknown as typeof db;
    const outcomes = await Promise.allSettled([
      transitionOperationalTask(racing, f.task.id, 'ready'),
      transitionOperationalTask(racing, f.task.id, 'blocked'),
    ]);
    expect(outcomes[0].status).toBe('fulfilled');
    expect(outcomes[1]).toMatchObject({ status: 'rejected', reason: expect.objectContaining({ message: 'Operational task changed. Reload and retry.' }) });
    const saved = await db.operationalTask.findUniqueOrThrow({ where: { id: f.task.id } });
    expect(saved).toMatchObject({ status: 'ready', readyAt: expect.any(Date), completedAt: expect.any(Date), blocksInventory: true });
    expect(saved.updatedAt.getTime()).toBeGreaterThan(f.task.updatedAt.getTime());
    // The flag is not an inventory writer; no second BlockedDate authority is introduced.
    expect(await db.blockedDate.count()).toBe(0);
  });
  it.each([NaN, Infinity, -Infinity, -1, 0.5, 2_147_483_648, Number.MAX_SAFE_INTEGER])('rejects unsafe integer satang %s before database writes', async value => {
    const f = await fixture();
    const before = await db.operationalTask.count();
    await expect(createOperationalTask(db, { projectId: f.project.id, unitId: f.unit.id, taskType: 'custom', dueAt: new Date(), actualCostSatang: value })).rejects.toThrow('TASK_COST_INVALID');
    expect(await db.operationalTask.count()).toBe(before);
  });
  it('accepts zero and the canonical Int32 maximum in satang', async () => {
    const f = await fixture();
    const task = await createOperationalTask(db, { projectId: f.project.id, unitId: f.unit.id, taskType: 'custom', dueAt: new Date(), estimatedCostSatang: 0, actualCostSatang: 2_147_483_647 });
    expect(task).toMatchObject({ estimatedCostSatang: 0, actualCostSatang: 2_147_483_647 });
  });
  it('rejects an invalid due date before database writes', async () => {
    const f = await fixture();
    const before = await db.operationalTask.count();
    await expect(createOperationalTask(db, { projectId: f.project.id, unitId: f.unit.id, taskType: 'custom', dueAt: new Date('invalid') })).rejects.toThrow('TASK_DUE_AT_INVALID');
    expect(await db.operationalTask.count()).toBe(before);
  });
});
