import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit, createRegulatoryEvidence } from '@/test/util';
import { createRegulatoryCredential } from './regulatory-credential.service';
import { listPublicCommercialHomes } from '@/modules/projects/commercial-discovery';

/**
 * Audit P0 #3: the public "buy" listing requires a verified `sale_authority`
 * credential, but the only credential writer refused that type, so no unit
 * could ever be listed for sale. These tests walk the whole path: record the
 * authority on the unit, activate the sale offering, see the unit under "buy".
 */
describe('sale authority → public buy listing', () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function saleReadyUnit() {
    const admin = await createIdentity({ isAdmin: true });
    const project = await createProject({ status: 'live' });
    // The factory gives a live unit a publicly ready gallery (cover included),
    // which the public listing requires.
    const unit = await createUnit({ projectId: project.id, status: 'live' });
    return { admin, project, unit };
  }

  it('records a sale authority on a unit', async () => {
    const { admin, unit } = await saleReadyUnit();
    const credential = await createRegulatoryCredential(db, {
      credentialType: 'sale_authority',
      scopeLevel: 'unit',
      unitId: unit.id,
      evidenceMediaId: (await createRegulatoryEvidence(admin.id)).id,
      verifiedByIdentityId: admin.id,
    });
    expect(credential.credentialType).toBe('sale_authority');
    expect(credential.verificationStatus).toBe('verified');
  });

  it('refuses a project-wide sale authority (the sale gate only reads unit credentials)', async () => {
    const { admin, project } = await saleReadyUnit();
    await expect(
      createRegulatoryCredential(db, {
        credentialType: 'sale_authority',
        scopeLevel: 'project',
        projectId: project.id,
        verifiedByIdentityId: admin.id,
      })
    ).rejects.toThrow(/single unit/);
  });

  it('lists the unit under "buy" once title, sale authority and an active sale offering exist', async () => {
    const { admin, unit } = await saleReadyUnit();
    await db.commercialOffering.create({ data: { unitId: unit.id, offeringType: 'sale', status: 'active' } });
    expect(await listPublicCommercialHomes(db, 'buy')).toHaveLength(0);

    for (const credentialType of ['title_legal_use', 'sale_authority']) {
      await createRegulatoryCredential(db, {
        credentialType,
        scopeLevel: 'unit',
        unitId: unit.id,
        status: 'active',
        evidenceMediaId: (await createRegulatoryEvidence(admin.id)).id,
        verifiedByIdentityId: admin.id,
      });
    }

    const homes = await listPublicCommercialHomes(db, 'buy');
    expect(homes.map(home => home.id)).toEqual([unit.id]);
    expect(homes[0].intents).toContain('buy');
  });
});
