import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';

const session = { identityId: '' };

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: async () => (session.identityId ? { identityId: session.identityId } : null),
}));

import { POST as recordEngagement, GET as readEngagements } from './[id]/engagement/route';
import { POST as addCompliance, GET as readCompliance } from './[id]/compliance/route';
import { PATCH as confirmCompliance } from './[id]/compliance/[recordId]/route';
import { POST as startChecklist, GET as readChecklist } from './[id]/mobilization/route';
import { POST as completeStep } from './[id]/mobilization/[itemId]/route';
import { PUT as setOwner } from './[id]/owner/route';

/**
 * The onboarding services existed and were tested; none had a route, so doc 07
 * F-OWN-1 could not be run through the application at all. A unit could go live
 * and take bookings, then refuse forever to produce an owner statement.
 */
describe('property onboarding routes', () => {
  let unitId: string;
  let projectId: string;
  let adminId: string;
  let ownerId: string;

  const post = (body?: unknown) =>
    new NextRequest('http://localhost/x', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  const put = (body: unknown) =>
    new NextRequest('http://localhost/x', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  const patch = (body: unknown) =>
    new NextRequest('http://localhost/x', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  const get = () => new NextRequest('http://localhost/x');

  beforeEach(async () => {
    await resetDb();
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, status: 'draft' });
    const admin = await createIdentity({ isAdmin: true });
    const owner = await createIdentity();

    projectId = project.id;
    unitId = unit.id;
    adminId = admin.id;
    ownerId = owner.id;
    session.identityId = admin.id;
  });

  describe('who may reach these routes', () => {
    it('refuses a signed-out caller', async () => {
      session.identityId = '';

      const res = await recordEngagement(post({ engagementType: 'owner_direct' }), {
        params: { id: unitId },
      });
      expect(res.status).toBe(401);
    });

    it('refuses a signed-in non-admin on the commercial terms', async () => {
      const stranger = await createIdentity();
      session.identityId = stranger.id;

      // The mandate sets what myUNO earns. Doc 03's matrix has no row for it,
      // so the route takes the narrow reading rather than inventing one.
      const res = await recordEngagement(post({ engagementType: 'owner_direct' }), {
        params: { id: unitId },
      });
      expect(res.status).toBe(403);
    });

    it('refuses a stranger on the owner route', async () => {
      const stranger = await createIdentity();
      session.identityId = stranger.id;

      const res = await setOwner(put({ ownerIdentityId: ownerId }), { params: { id: unitId } });
      expect(res.status).toBe(403);
    });
  });

  describe('setting the owner', () => {
    it('records a period rather than moving a pointer', async () => {
      const res = await setOwner(put({ ownerIdentityId: ownerId }), { params: { id: unitId } });

      expect(res.status).toBe(200);
      expect((await res.json()).changed).toBe(true);

      const unit = await db.unit.findUnique({ where: { id: unitId } });
      expect(unit!.ownerIdentityId).toBe(ownerId);

      // Ownership is a dated fact: the history is what money records read.
      const periods = await db.ownershipPeriod.findMany({ where: { unitId } });
      expect(periods.length).toBeGreaterThan(0);
      expect(periods.some((p) => p.ownerIdentityId === ownerId && p.endsOn === null)).toBe(true);
    });

    it('reports an unchanged owner honestly instead of logging a transfer', async () => {
      await setOwner(put({ ownerIdentityId: ownerId }), { params: { id: unitId } });
      const again = await setOwner(put({ ownerIdentityId: ownerId }), { params: { id: unitId } });

      expect((await again.json()).changed).toBe(false);
      const audits = await db.auditLog.findMany({ where: { action: 'units:owner_changed' } });
      expect(audits).toHaveLength(1);
    });

    it('refuses an identity that does not exist', async () => {
      const res = await setOwner(put({ ownerIdentityId: 'nobody' }), { params: { id: unitId } });
      expect(res.status).toBe(404);
    });

    it('requires an owner to be named', async () => {
      const res = await setOwner(put({}), { params: { id: unitId } });
      expect(res.status).toBe(400);
    });
  });

  describe('the mandate — the step that was blocking every owner statement', () => {
    // Called explicitly rather than from a nested beforeEach: vitest runs hooks
    // at different nesting levels in parallel by default, so a nested hook
    // races the outer resetDb and the fixtures vanish mid-setup.
    const withOwner = () => setOwner(put({ ownerIdentityId: ownerId }), { params: { id: unitId } });

    it('records an engagement and takes the owner from the unit', async () => {
      await withOwner();
      const res = await recordEngagement(post({ engagementType: 'owner_direct' }), {
        params: { id: unitId },
      });

      expect(res.status).toBe(201);
      const engagement = await db.unitEngagement.findFirst({ where: { unitId } });
      expect(engagement!.ownerIdentityId).toBe(ownerId);
    });

    it('refuses a direct-managed mandate with no NOI cap', async () => {
      await withOwner();
      // Doc 07 marks the cap required with no default (Q14). A statement for a
      // direct-managed unit without one refuses to generate, so accepting the
      // mandate without it would only move the failure later.
      const res = await recordEngagement(post({ engagementType: 'direct_managed' }), {
        params: { id: unitId },
      });

      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/NOI cap/i);
    });

    it('accepts a direct-managed mandate with a cap', async () => {
      await withOwner();
      const res = await recordEngagement(
        post({ engagementType: 'direct_managed', noiCapAnnualThb: 120_000_00 }),
        { params: { id: unitId } }
      );

      expect(res.status).toBe(201);
    });

    it('refuses a mandate on a unit with no owner', async () => {
      const orphan = await createUnit({ projectId, status: 'draft' });

      const res = await recordEngagement(post({ engagementType: 'owner_direct' }), {
        params: { id: orphan.id },
      });

      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/no owner/i);
    });

    it('lists what a unit has', async () => {
      await withOwner();
      await recordEngagement(post({ engagementType: 'owner_direct' }), { params: { id: unitId } });

      const body = await (await readEngagements(get(), { params: { id: unitId } })).json();
      expect(body.engagements).toHaveLength(1);
    });

    it('leaves an audit trail', async () => {
      await withOwner();
      await recordEngagement(post({ engagementType: 'owner_direct' }), { params: { id: unitId } });

      const audit = await db.auditLog.findFirst({ where: { action: 'units:record_engagement' } });
      expect(audit!.actorIdentityId).toBe(adminId);
    });
  });

  describe('compliance records', () => {
    it('records one and reads it back', async () => {
      const res = await addCompliance(post({ recordType: 'permitted_use', label: 'Hotel licence' }), {
        params: { id: unitId },
      });
      expect(res.status).toBe(201);

      const body = await (await readCompliance(get(), { params: { id: unitId } })).json();
      expect(body.records).toHaveLength(1);
      expect(body.records[0].recordType).toBe('permitted_use');
    });

    it('requires a record type', async () => {
      const res = await addCompliance(post({ label: 'Something' }), { params: { id: unitId } });
      expect(res.status).toBe(400);
    });

    it('404s for a unit that does not exist', async () => {
      const res = await addCompliance(post({ recordType: 'insurance' }), {
        params: { id: 'no-such-unit' },
      });
      expect(res.status).toBe(404);
    });
  });

  describe('the mobilization checklist', () => {
    /**
     * An engagement is created `draft`. Activating it requires the mandate
     * document (doc 07 step 2, "mandate PDF upload") — a real requirement, not
     * a gap, so the fixture uploads one rather than routing around it.
     */
    const withOwnerAndMandate = async () => {
      await setOwner(put({ ownerIdentityId: ownerId }), { params: { id: unitId } });
      const created = await recordEngagement(post({ engagementType: 'owner_direct' }), {
        params: { id: unitId },
      }).then((r) => r.json());
      const media = await db.mediaAsset.create({
        data: {
          kind: 'document',
          storageKey: `mandate-${unitId}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          uploadedByIdentityId: adminId,
        },
      });
      await db.unitEngagement.update({
        where: { id: created.id },
        data: { mandateMediaId: media.id, status: 'active' },
      });
    };

    it('starts with all seven steps', async () => {
      const res = await startChecklist(post(), { params: { id: unitId } });

      expect(res.status).toBe(201);
      const items = await db.mobilizationChecklistItem.findMany({ where: { unitId } });
      expect(items).toHaveLength(7);
      expect(items.every((i) => i.status === 'pending')).toBe(true);
    });

    it('is idempotent, so a double-click repairs rather than fails', async () => {
      await startChecklist(post(), { params: { id: unitId } });
      const again = await startChecklist(post(), { params: { id: unitId } });

      expect(again.status).toBe(200);
      expect((await again.json()).created).toBe(0);
      expect(await db.mobilizationChecklistItem.count({ where: { unitId } })).toBe(7);
    });

    it('completes the first step and records who did it', async () => {
      await startChecklist(post(), { params: { id: unitId } });
      const qualify = await db.mobilizationChecklistItem.findFirst({
        where: { unitId, step: 'qualify' },
      });

      const res = await completeStep(post({ notes: 'Owner met on site' }), {
        params: { id: unitId, itemId: qualify!.id },
      });

      expect(res.status).toBe(200);
      const after = await db.mobilizationChecklistItem.findUnique({ where: { id: qualify!.id } });
      expect(after!.status).toBe('done');
      expect(after!.completedByIdentityId).toBe(adminId);
      expect(after!.notes).toBe('Owner met on site');
    });

    it('refuses the mandate step until an engagement is active', async () => {
      await startChecklist(post(), { params: { id: unitId } });
      const mandate = await db.mobilizationChecklistItem.findFirst({
        where: { unitId, step: 'mandate' },
      });

      // The route adds no rules of its own — this is the gate speaking, which
      // is where that judgement belongs.
      const res = await completeStep(post(), { params: { id: unitId, itemId: mandate!.id } });

      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/engagement/i);
      const after = await db.mobilizationChecklistItem.findUnique({ where: { id: mandate!.id } });
      expect(after!.status).toBe('pending');
    });

    it('refuses go-live until a permitted-use record is confirmed', async () => {
      await startChecklist(post(), { params: { id: unitId } });
      await addCompliance(post({ recordType: 'permitted_use' }), { params: { id: unitId } });
      const golive = await db.mobilizationChecklistItem.findFirst({
        where: { unitId, step: 'golive_checklist' },
      });

      // Attaching the document is not attesting to it: records are created
      // pending, and the gate wants a confirmed one.
      const res = await completeStep(post(), { params: { id: unitId, itemId: golive!.id } });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/permitted use/i);
    });

    it('refuses go-live while any other step is unfinished — without ticking it', async () => {
      await startChecklist(post(), { params: { id: unitId } });
      const record = await addCompliance(post({ recordType: 'permitted_use' }), {
        params: { id: unitId },
      }).then((r) => r.json());
      await confirmCompliance(patch({ status: 'confirmed' }), {
        params: { id: unitId, recordId: record.id },
      });
      const golive = await db.mobilizationChecklistItem.findFirst({
        where: { unitId, step: 'golive_checklist' },
      });

      const res = await completeStep(post(), { params: { id: unitId, itemId: golive!.id } });
      expect(res.status).toBe(400);

      // The step must not be ticked by a refused go-live. It used to be marked
      // done before the check, with no transaction to undo it, so the screen
      // said the unit was ready while it sat in draft.
      const after = await db.mobilizationChecklistItem.findUnique({ where: { id: golive!.id } });
      expect(after!.status).toBe('pending');
      const unit = await db.unit.findUnique({ where: { id: unitId } });
      expect(unit!.status).toBe('draft');
    });

    it('goes live once every step is done and the licence is confirmed', async () => {
      await withOwnerAndMandate();
      await startChecklist(post(), { params: { id: unitId } });
      const record = await addCompliance(post({ recordType: 'permitted_use' }), {
        params: { id: unitId },
      }).then((r) => r.json());
      await confirmCompliance(patch({ status: 'confirmed' }), {
        params: { id: unitId, recordId: record.id },
      });

      const items = await db.mobilizationChecklistItem.findMany({ where: { unitId } });
      for (const item of items.filter((i) => i.step !== 'golive_checklist')) {
        const res = await completeStep(post(), { params: { id: unitId, itemId: item.id } });
        expect(res.status).toBe(200);
      }

      const golive = items.find((i) => i.step === 'golive_checklist');
      const res = await completeStep(post(), { params: { id: unitId, itemId: golive!.id } });

      expect(res.status).toBe(200);
      const unit = await db.unit.findUnique({ where: { id: unitId } });
      expect(unit!.status).toBe('live');
    });

    it('leaves the rest of the steps open, which is narrower than doc 07 reads', async () => {
      await startChecklist(post(), { params: { id: unitId } });
      const legal = await db.mobilizationChecklistItem.findFirst({
        where: { unitId, step: 'legal_audit' },
      });

      // Doc 07 says the mandate gates "no further steps until active", which
      // would block this. The code gates only the mandate step itself, so the
      // legal audit can be ticked before the mandate exists. Pinned here so the
      // behaviour cannot drift while Q43 is open.
      const res = await completeStep(post(), { params: { id: unitId, itemId: legal!.id } });
      expect(res.status).toBe(200);
    });

    it('refuses a checklist item that belongs to another unit', async () => {
      await startChecklist(post(), { params: { id: unitId } });
      const other = await createUnit({ projectId, status: 'draft' });
      await startChecklist(post(), { params: { id: other.id } });
      const foreign = await db.mobilizationChecklistItem.findFirst({
        where: { unitId: other.id, step: 'qualify' },
      });

      // Scoped in the query, not fetched-then-checked: an item id alone would
      // let one unit's step be ticked through another unit's route.
      const res = await completeStep(post(), {
        params: { id: unitId, itemId: foreign!.id },
      });
      expect(res.status).toBe(404);
    });

    it('reports whether the checklist is finished', async () => {
      await startChecklist(post(), { params: { id: unitId } });

      const body = await (await readChecklist(get(), { params: { id: unitId } })).json();
      expect(body.items).toHaveLength(7);
      expect(body.complete).toBe(false);
    });
  });

  describe('the loop closes', () => {
    it('a unit onboarded through the routes has what a statement needs', async () => {
      // The whole point: before these routes, this sequence was impossible
      // through the application, and statement generation refused forever.
      await setOwner(put({ ownerIdentityId: ownerId }), { params: { id: unitId } });
      await recordEngagement(
        post({ engagementType: 'direct_managed', noiCapAnnualThb: 500_000_00 }),
        { params: { id: unitId } }
      );
      await addCompliance(post({ recordType: 'permitted_use' }), { params: { id: unitId } });
      await startChecklist(post(), { params: { id: unitId } });

      // Recorded as draft: activating a mandate requires the signed document
      // (doc 07 step 2), which is a real requirement rather than a gap. What
      // matters here is that the record now exists at all — before these
      // routes, nothing in the application could create one.
      const engagement = await db.unitEngagement.findFirst({ where: { unitId } });
      expect(engagement).not.toBeNull();
      expect(engagement!.status).toBe('draft');
      expect(engagement!.noiCapAnnualThb).not.toBeNull();

      const unit = await db.unit.findUnique({ where: { id: unitId } });
      expect(unit!.ownerIdentityId).toBe(ownerId);
    });
  });
});
