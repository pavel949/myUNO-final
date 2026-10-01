import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { getPublicProjectPassport } from './passport.service';

const asDb = (project: any) =>
  ({
    project: {
      findUnique: vi.fn().mockResolvedValue(project),
    },
  }) as unknown as PrismaClient;

const baseProject = () => ({
  id: 'p1',
  slug: 'project-one',
  name: 'Project One',
  address: 'Phuket',
  projectType: 'villa_resort',
  completionYear: 2026,
  totalUnits: 2,
  latitude: { toString: () => '7.950000', valueOf: () => 7.95 },
  longitude: { toString: () => '98.320000', valueOf: () => 98.32 },
  status: 'live',
  orgRoles: [],
  regulatoryCredentials: [],
  units: [],
});

describe('public Project Passport', () => {
  it('never publishes a draft project', async () => {
    const project = { ...baseProject(), status: 'draft' };
    await expect(getPublicProjectPassport(asDb(project), project.slug)).resolves.toBeNull();
  });

  it('reports missing evidence instead of inventing a pass', async () => {
    const passport = await getPublicProjectPassport(asDb(baseProject()), 'project-one');
    expect(passport?.developer.status).toBe('not_evidenced');
    expect(passport?.regulatory.status).toBe('not_evidenced');
    expect(passport?.unitCompliance.status).toBe('not_evidenced');
    expect(passport?.facts.activeOfferingCounts).toEqual({});
  });

  it('documents verified organization and current regulatory evidence but keeps aggregate unit compliance partial', async () => {
    const project = {
      ...baseProject(),
      orgRoles: [
        {
          roleKey: 'developer',
          provenance: 'verified',
          effectiveFrom: null,
          effectiveTo: null,
          organization: {
            name: 'Developer Co',
            status: 'active',
            developerVerification: 'verified',
          },
        },
      ],
      regulatoryCredentials: [
        {
          requirementKey: 'hotel_licence',
          credentialType: 'licence',
          issuingAuthority: 'Authority',
          status: 'active',
          verificationStatus: 'verified',
          verifiedAt: new Date('2026-01-01T00:00:00Z'),
          expiryDate: new Date('2027-01-01T00:00:00Z'),
        },
      ],
      units: [
        {
          id: 'u1',
          commercialOfferings: [{ offeringType: 'short_stay' }],
          complianceRecords: [{ recordType: 'permitted_use' }],
        },
        {
          id: 'u2',
          commercialOfferings: [{ offeringType: 'short_stay' }],
          complianceRecords: [{ recordType: 'permitted_use' }],
        },
      ],
    };

    const passport = await getPublicProjectPassport(asDb(project), 'project-one');
    expect(passport?.developer.status).toBe('documented');
    expect(passport?.regulatory.status).toBe('documented');
    expect(passport?.facts.activeOfferingCounts.short_stay).toBe(2);
    expect(passport?.unitCompliance.status).toBe('partial');
    expect(passport?.unitCompliance.byType).toEqual([
      { type: 'permitted_use', confirmedUnits: 2, totalUnits: 2 },
    ]);
  });
});
