import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
const current = vi.hoisted(() => vi.fn());
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: () => current() }));
vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));
vi.mock('@/lib/i18n', () => ({ getLabels: async (labels: Record<string, string>) => labels, getRequestLocale: async () => 'en' }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error('REDIRECT:' + url); }, notFound: () => { throw new Error('NOT_FOUND'); } }));
import Home from './[spaceId]/page';
import Spaces from './page';
import Reservations from '@/app/ops/reservations/page';
import { POST as createTask } from '@/app/api/ops/tasks/route';
import { PATCH as updateTask } from '@/app/api/ops/tasks/[id]/route';
import { GET as getPlans, POST as createPlan } from '@/app/api/ops/preventive-maintenance/route';

const past = () => new Date(Date.now() - 86400000);
const future = () => new Date(Date.now() + 86400000);
async function fixture() {
  const actor = await createIdentity();
  const project = await createProject();
  const otherProject = await createProject();
  const unit = await createUnit({ projectId: project.id });
  const foreign = await createUnit({ projectId: otherProject.id });
  const org = await db.organization.create({ data: { name: 'HTTP scope', orgType: 'management_company', contactEmail: 'http-scope@example.test', contactPhone: '+66000000000' } });
  for (const projectId of [project.id, otherProject.id]) await db.projectOrganizationRole.create({ data: { projectId, organizationId: org.id, roleKey: 'operator', provenance: 'verified' } });
  const role = await db.roleAssignment.create({ data: { identityId: actor.id, role: 'staff_ops', scopeType: 'project', projectId: project.id } });
  await db.projectStaffPermission.create({ data: { identityId: actor.id, projectId: project.id, departments: ['housekeeping', 'maintenance', 'front_desk'] } });
  const space = await db.operatingSpace.create({ data: { key: 'http-scope', name: 'HTTP scope', organizationId: org.id } });
  for (const unitId of [unit.id, foreign.id]) await db.operatingSpaceUnit.create({ data: { operatingSpaceId: space.id, unitId, startsOn: past() } });
  const member = await db.operatingSpaceMember.create({ data: { identityId: actor.id, operatingSpaceId: space.id, capabilities: ['manage_tasks', 'assign_tasks', 'manage_housekeeping', 'manage_maintenance'] } });
  const task = await db.operationalTask.create({ data: { operatingSpaceId: space.id, unitId: unit.id, projectId: project.id, taskType: 'custom', title: 'Daily task', dueAt: future() } });
  await db.operationalTask.create({ data: { operatingSpaceId: space.id, unitId: foreign.id, projectId: otherProject.id, taskType: 'custom', dueAt: future() } });
  current.mockResolvedValue({ identityId: actor.id, isAdmin: true, roles: [] }); // stale admin flag must never widen scope
  return { actor, project, otherProject, unit, foreign, org, role, space, member, task };
}
function request(body: unknown, method = 'POST') {
  return new NextRequest('http://localhost/api/ops/tasks', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
describe('New membership cannot bypass daily-task boundaries through HTTP or workspace summaries', () => {
  beforeEach(async () => { current.mockReset(); await resetDb(); });
  it('renders mixed-project home counts only for the authorized unit and no booking/finance cards', async () => {
    const f = await fixture();
    const html = renderToStaticMarkup(await Home({ params: { spaceId: f.space.id } }));
    expect(html.match(/>1<\/p>/g)).toHaveLength(2);
    expect(html).not.toContain('Arrivals');
    expect(html).not.toContain('Booking requests');
    expect(html).not.toContain('Finance &amp; reports');
  });
  it('renders chooser counts without exposing all workspace units or a team roster total', async () => {
    await fixture();
    const html = renderToStaticMarkup(await Spaces({}));
    expect(html.match(/>1<\/p>/g)).toHaveLength(1);
    expect(html).not.toContain('team members');
  });
  it('rejects both count-only surfaces after role revocation with the same session', async () => {
    const f = await fixture();
    await db.roleAssignment.update({ where: { id: f.role.id }, data: { status: 'revoked' } });
    await expect(Home({ params: { spaceId: f.space.id } })).rejects.toThrow('NOT_FOUND');
    await expect(Spaces({})).rejects.toThrow('REDIRECT:/ops');
  });
  it('denies direct reservation-desk access to a task-only member despite an underlying front-desk department', async () => {
    const f = await fixture();
    await expect(Reservations({ searchParams: { spaceId: f.space.id } })).rejects.toThrow('NOT_FOUND');
  });
  it('creates, assigns and completes one authorized manual task through canonical endpoints', async () => {
    const f = await fixture();
    const response = await createTask(request({ operatingSpaceId: f.space.id, unitId: f.unit.id, taskType: 'custom', dueAt: future().toISOString(), assignedIdentityId: f.actor.id }));
    expect(response.status).toBe(201);
    const { task } = await response.json();
    expect((await updateTask(request({ status: 'in_progress' }, 'PATCH'), { params: { id: task.id } })).status).toBe(200);
    expect((await updateTask(request({ status: 'ready' }, 'PATCH'), { params: { id: task.id } })).status).toBe(200);
    expect(await db.operationalTask.findUnique({ where: { id: task.id } })).toMatchObject({ status: 'ready', assignedIdentityId: f.actor.id, startedAt: expect.any(Date), readyAt: expect.any(Date), completedAt: expect.any(Date) });
  });
  it.each(['foreign_unit', 'missing_space', 'empty_space', 'revoked_role', 'removed_attachment', 'missing_capability', 'foreign_assignee'] as const)('refuses %s task creation without a write', async kind => {
    const f = await fixture();
    if (kind === 'revoked_role') await db.roleAssignment.update({ where: { id: f.role.id }, data: { status: 'revoked' } });
    if (kind === 'removed_attachment') await db.operatingSpaceUnit.updateMany({ where: { operatingSpaceId: f.space.id, unitId: f.unit.id }, data: { active: false } });
    if (kind === 'missing_capability') await db.operatingSpaceMember.update({ where: { id: f.member.id }, data: { capabilities: ['manage_housekeeping'] } });
    const outsider = kind === 'foreign_assignee' ? await createIdentity() : null;
    const before = await db.operationalTask.count();
    const response = await createTask(request({ operatingSpaceId: kind === 'missing_space' ? 'known-invalid-space' : kind === 'empty_space' ? '' : f.space.id,
      unitId: kind === 'foreign_unit' ? f.foreign.id : f.unit.id, taskType: 'custom', dueAt: future().toISOString(), ...(outsider ? { assignedIdentityId: outsider.id } : {}) }));
    expect([400, 403]).toContain(response.status);
    expect(await db.operationalTask.count()).toBe(before);
  });
  it('denies a known task PATCH after attachment removal with an existing session', async () => {
    const f = await fixture();
    await db.operatingSpaceUnit.updateMany({ where: { operatingSpaceId: f.space.id, unitId: f.unit.id }, data: { active: false } });
    expect((await updateTask(request({ status: 'in_progress' }, 'PATCH'), { params: { id: f.task.id } })).status).toBe(403);
    expect((await db.operationalTask.findUniqueOrThrow({ where: { id: f.task.id } })).status).toBe('planned');
  });
  it('exposes only unit-linked authorized plans and denies all new recurring-plan creation', async () => {
    const f = await fixture();
    const own = await db.preventiveMaintenancePlan.create({ data: { operatingSpaceId: f.space.id, unitId: f.unit.id, title: 'Own existing plan', frequencyDays: 7, nextDueAt: future() } });
    await db.preventiveMaintenancePlan.create({ data: { operatingSpaceId: f.space.id, unitId: f.foreign.id, title: 'Foreign existing plan', frequencyDays: 7, nextDueAt: future() } });
    const read = await getPlans(new NextRequest('http://localhost/api/ops/preventive-maintenance?spaceId=' + f.space.id));
    expect(read.status).toBe(200);
    expect((await read.json()).plans.map((p: { id: string }) => p.id)).toEqual([own.id]);
    const response = await createPlan(request({ operatingSpaceId: f.space.id, unitId: f.unit.id, title: 'New plan', nextDueAt: future().toISOString() }));
    expect(response.status).toBe(409);
    expect(await db.preventiveMaintenancePlan.count()).toBe(2);
    await db.operatingSpaceMember.update({ where: { id: f.member.id }, data: { capabilities: ['manage_tasks'] } });
    expect((await getPlans(new NextRequest('http://localhost/api/ops/preventive-maintenance?spaceId=' + f.space.id))).status).toBe(403);
  });
});

describe('Task attachment HTTP boundary uses current identity and safe metadata', () => {
  beforeEach(async () => { current.mockReset(); await resetDb(); });
  const body = (f: Awaited<ReturnType<typeof fixture>>, mediaAssetId: string) => ({ operatingSpaceId: f.space.id, unitId: f.unit.id, taskType: 'custom', dueAt: future().toISOString(), mediaAssetIds: [mediaAssetId] });
  it.each(['other_uploader', 'passport', 'expired', 'unsupported_mime', 'outside_unit_founder'] as const)('rejects %s attachment without writing a task or revealing metadata', async kind => {
    const f = await fixture();
    const other = await createIdentity();
    if (kind === 'outside_unit_founder') await db.identity.update({ where: { id: f.actor.id }, data: { isAdmin: true } });
    const media = await db.mediaAsset.create({ data: {
      storageKey: 'private:must-not-be-returned', kind: kind === 'passport' ? 'passport' : 'photo',
      mimeType: kind === 'unsupported_mime' ? 'text/html' : 'image/jpeg', sizeBytes: 100,
      uploadedByIdentityId: kind === 'other_uploader' || kind === 'outside_unit_founder' ? other.id : f.actor.id,
      deleteAfter: kind === 'expired' ? past() : null,
    } });
    if (kind === 'outside_unit_founder') await db.unitMedia.create({ data: { unitId: f.foreign.id, mediaId: media.id, sort: 0 } });
    const before = await db.operationalTask.count();
    const response = await createTask(request(body(f, media.id)));
    expect(response.status).toBe(403);
    expect(JSON.stringify(await response.json())).not.toContain('private:must-not-be-returned');
    expect(await db.operationalTask.count()).toBe(before);
    expect(await db.operationalTaskMedia.count()).toBe(0);
  });
  it.each([
    { kind: 'photo' as const, mimeType: 'image/jpeg', encrypted: false },
    { kind: 'document' as const, mimeType: 'application/pdf', encrypted: true },
    { kind: 'receipt' as const, mimeType: 'application/pdf', encrypted: true },
    { kind: 'document' as const, mimeType: 'video/mp4', encrypted: true },
  ])('preserves caller-owned $kind $mimeType attachments without publishing their storage key', async type => {
    const f = await fixture();
    const media = await db.mediaAsset.create({ data: { ...type, storageKey: 'private:own-evidence', sizeBytes: 100, uploadedByIdentityId: f.actor.id } });
    const response = await createTask(request(body(f, media.id)));
    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.task.media).toHaveLength(1);
    expect(result.task.media[0].media).toEqual({ id: media.id, ...type, sizeBytes: 100 });
    expect(JSON.stringify(result)).not.toContain('private:own-evidence');
    expect(JSON.stringify(result)).not.toContain('uploadedByIdentityId');
    expect(await db.mediaAsset.findUnique({ where: { id: media.id } })).toMatchObject({ storageKey: 'private:own-evidence', encrypted: type.encrypted });
  });
  it('allows a fresh founder to reuse an existing attachment only on the exact canonical unit', async () => {
    const f = await fixture();
    const uploader = await createIdentity();
    await db.identity.update({ where: { id: f.actor.id }, data: { isAdmin: true } });
    const media = await db.mediaAsset.create({ data: { storageKey: 'private:unit-repair', kind: 'document', mimeType: 'application/pdf', encrypted: true, sizeBytes: 100, uploadedByIdentityId: uploader.id } });
    await db.operationalTaskMedia.create({ data: { operationalTaskId: f.task.id, mediaAssetId: media.id } });
    expect((await createTask(request(body(f, media.id)))).status).toBe(201);
    await db.identity.update({ where: { id: f.actor.id }, data: { isAdmin: false } });
    expect((await createTask(request(body(f, media.id)))).status).toBe(403);
  });
  it.each([-1, '10', 21_474_836.48, 1e100])('rejects malformed or out-of-range cost %s before persistence', async cost => {
    const f = await fixture();
    const before = await db.operationalTask.count();
    const response = await createTask(request({ operatingSpaceId: f.space.id, unitId: f.unit.id, taskType: 'custom', dueAt: future().toISOString(), estimatedCostThb: cost }));
    expect(response.status).toBe(400);
    expect(await db.operationalTask.count()).toBe(before);
  });
});


describe('Historical null-space compatibility cannot create a new delegated scope bypass', () => {
  beforeEach(async () => { current.mockReset(); await resetDb(); });
  it.each(['own_unit', 'unattached_sibling', 'revoked_member'] as const)('requires an explicit workspace for new non-founder tasks: %s', async kind => {
    const f = await fixture();
    const sibling = await createUnit({ projectId: f.project.id });
    if (kind === 'revoked_member') await db.operatingSpaceMember.update({ where: { id: f.member.id }, data: { active: false } });
    const before = await db.operationalTask.count();
    const response = await createTask(request({ unitId: kind === 'unattached_sibling' ? sibling.id : f.unit.id, taskType: 'custom', dueAt: future().toISOString(), isAdmin: true }));
    expect(response.status).toBe(400);
    expect(await db.operationalTask.count()).toBe(before);
  });
  it('also rejects a same-project sibling when a workspace is explicitly supplied', async () => {
    const f = await fixture();
    const sibling = await createUnit({ projectId: f.project.id });
    const before = await db.operationalTask.count();
    const response = await createTask(request({ operatingSpaceId: f.space.id, unitId: sibling.id, taskType: 'custom', dueAt: future().toISOString() }));
    expect(response.status).toBe(403);
    expect(await db.operationalTask.count()).toBe(before);
  });
  it('preserves freshly authorized founder legacy creation without manufacturing a workspace grant', async () => {
    const f = await fixture();
    await db.identity.update({ where: { id: f.actor.id }, data: { isAdmin: true } });
    const response = await createTask(request({ unitId: f.unit.id, taskType: 'custom', dueAt: future().toISOString() }));
    expect(response.status).toBe(201);
    expect((await response.json()).task.operatingSpaceId).toBeNull();
  });
  it('preserves canonical legacy PATCH authorization for historical null-space tasks', async () => {
    const f = await fixture();
    await db.operationalTask.update({ where: { id: f.task.id }, data: { operatingSpaceId: null } });
    await db.operatingSpaceMember.update({ where: { id: f.member.id }, data: { active: false } });
    expect((await updateTask(request({ status: 'in_progress' }, 'PATCH'), { params: { id: f.task.id } })).status).toBe(200);
    await db.roleAssignment.update({ where: { id: f.role.id }, data: { status: 'revoked' } });
    expect((await updateTask(request({ status: 'ready' }, 'PATCH'), { params: { id: f.task.id } })).status).toBe(403);
  });
});
