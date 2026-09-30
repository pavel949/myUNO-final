import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit, createRegulatoryEvidence } from '@/test/util';
import {
  createRegulatoryCredential,
  updateRegulatoryCredential,
  listRegulatoryCredentials,
  checkRegulatoryCredentialForGoLive,
} from './regulatory-credential.service';
import { updateUnit } from '@/modules/projects';

describe('RegulatoryCredential writer and go-live gate (Q71)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('rejects an unknown credential type', async () => {
    const admin = await createIdentity({ isAdmin: true });
    const project = await createProject({ status: 'draft' });

    await expect(
      createRegulatoryCredential(db, {
        credentialType: 'made_up_type',
        scopeLevel: 'project',
        projectId: project.id,
        verifiedByIdentityId: admin.id,
      })
    ).rejects.toThrow(/Unknown credential type/);
  });

  it('rejects a unit-scoped credential with no unitId', async () => {
    const admin = await createIdentity({ isAdmin: true });

    await expect(
      createRegulatoryCredential(db, {
        credentialType: 'hotel_business_license',
        scopeLevel: 'unit',
        verifiedByIdentityId: admin.id,
      })
    ).rejects.toThrow(/requires unitId/);
  });

  it('blocks go-live for a unit with no regulatory credential', async () => {
    const project = await createProject({ status: 'draft' });
    const unit = await createUnit({ projectId: project.id, status: 'draft' });

    const check = await checkRegulatoryCredentialForGoLive(db, unit.id);
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/active regulatory credential/);
  });

  it('passes once an active hotel_business_license credential exists on the unit', async () => {
    const admin = await createIdentity({ isAdmin: true });
    const project = await createProject({ status: 'draft' });
    const unit = await createUnit({ projectId: project.id, status: 'draft' });

    await createRegulatoryCredential(db, {
      credentialType: 'hotel_business_license',
      scopeLevel: 'unit',
      unitId: unit.id,
      issuingAuthority: 'Phuket Provincial Office',
      evidenceMediaId: (await createRegulatoryEvidence(admin.id)).id,
      verifiedByIdentityId: admin.id,
    });

    const check = await checkRegulatoryCredentialForGoLive(db, unit.id);
    expect(check.ok).toBe(true);
  });

  it('a project-level credential satisfies every unit in that project', async () => {
    const admin = await createIdentity({ isAdmin: true });
    const project = await createProject({ status: 'draft' });
    const unit = await createUnit({ projectId: project.id, status: 'draft' });

    await createRegulatoryCredential(db, {
      credentialType: 'accommodation_exemption',
      scopeLevel: 'project',
      projectId: project.id,
      exemptionBasis: 'Fewer than 4 rooms, hotel-exempt under the 2004 Act',
      evidenceMediaId: (await createRegulatoryEvidence(admin.id)).id,
      verifiedByIdentityId: admin.id,
    });

    const check = await checkRegulatoryCredentialForGoLive(db, unit.id);
    expect(check.ok).toBe(true);
  });

  it('an expired credential does not satisfy the gate', async () => {
    const admin = await createIdentity({ isAdmin: true });
    const project = await createProject({ status: 'draft' });
    const unit = await createUnit({ projectId: project.id, status: 'draft' });

    await createRegulatoryCredential(db, {
      credentialType: 'hotel_business_license',
      scopeLevel: 'unit',
      unitId: unit.id,
      status: 'expired',
      evidenceMediaId: (await createRegulatoryEvidence(admin.id)).id,
      verifiedByIdentityId: admin.id,
    });

    const check = await checkRegulatoryCredentialForGoLive(db, unit.id);
    expect(check.ok).toBe(false);
  });

  it('revoking a credential via updateRegulatoryCredential closes the gate again', async () => {
    const admin = await createIdentity({ isAdmin: true });
    const project = await createProject({ status: 'draft' });
    const unit = await createUnit({ projectId: project.id, status: 'draft' });

    const credential = await createRegulatoryCredential(db, {
      credentialType: 'hotel_business_license',
      scopeLevel: 'unit',
      unitId: unit.id,
      evidenceMediaId: (await createRegulatoryEvidence(admin.id)).id,
      verifiedByIdentityId: admin.id,
    });

    expect((await checkRegulatoryCredentialForGoLive(db, unit.id)).ok).toBe(true);

    await updateRegulatoryCredential(db, credential.id, {
      status: 'revoked',
      evidenceMediaId: (await createRegulatoryEvidence(admin.id)).id,
      verifiedByIdentityId: admin.id,
    });

    expect((await checkRegulatoryCredentialForGoLive(db, unit.id)).ok).toBe(false);
  });

  it('listRegulatoryCredentials filters by unit and by project', async () => {
    const admin = await createIdentity({ isAdmin: true });
    const project = await createProject({ status: 'draft' });
    const unit = await createUnit({ projectId: project.id, status: 'draft' });

    await createRegulatoryCredential(db, {
      credentialType: 'hotel_business_license',
      scopeLevel: 'unit',
      unitId: unit.id,
      evidenceMediaId: (await createRegulatoryEvidence(admin.id)).id,
      verifiedByIdentityId: admin.id,
    });
    await createRegulatoryCredential(db, {
      credentialType: 'accommodation_exemption',
      scopeLevel: 'project',
      projectId: project.id,
      evidenceMediaId: (await createRegulatoryEvidence(admin.id)).id,
      verifiedByIdentityId: admin.id,
    });

    expect(await listRegulatoryCredentials(db, { unitId: unit.id })).toHaveLength(1);
    expect(await listRegulatoryCredentials(db, { projectId: project.id })).toHaveLength(1);
  });

  it('a unit cannot move to live status without an active regulatory credential (units.ts wiring)', async () => {
    const admin = await createIdentity({ isAdmin: true });
    const project = await createProject({ status: 'draft' });
    // categoryKey forces the factory to attach a canonical InventoryCategory
    // even for a draft unit, satisfying the separate go-live requirement
    // that a live unit have one — not what this test is about.
    const unit = await createUnit({ projectId: project.id, status: 'draft', categoryKey: 'q71_test_category' });

    // Grant the *other*, independent go-live prerequisite so the credential
    // check is what's actually under test.
    await db.unit.update({ where: { id: unit.id }, data: { permittedUseConfirmedAt: new Date() } });

    await expect(
      updateUnit({ unitId: unit.id, status: 'live', actorIdentityId: admin.id })
    ).rejects.toThrow(/active regulatory credential/);

    await createRegulatoryCredential(db, {
      credentialType: 'hotel_business_license',
      scopeLevel: 'unit',
      unitId: unit.id,
      evidenceMediaId: (await createRegulatoryEvidence(admin.id)).id,
      verifiedByIdentityId: admin.id,
    });

    const updated = await updateUnit({ unitId: unit.id, status: 'live', actorIdentityId: admin.id });
    expect(updated.status).toBe('live');
  });

  it('an already-live unit is never retroactively re-checked (grandfather clause)', async () => {
    const admin = await createIdentity({ isAdmin: true });
    const project = await createProject({ status: 'draft' });
    // Created directly live, exactly like every pre-Q71 unit in production —
    // no RegulatoryCredential row exists for it.
    const unit = await createUnit({ projectId: project.id, status: 'live' });

    const stillLive = await db.unit.findUnique({ where: { id: unit.id } });
    expect(stillLive?.status).toBe('live');
    // The gate only fires on a transition; leaving status unset (or equal to
    // the current status) never calls the credential check at all.
    const unchanged = await updateUnit({ unitId: unit.id, name: unit.name, actorIdentityId: admin.id });
    expect(unchanged.status).toBe('live');
  });
});
