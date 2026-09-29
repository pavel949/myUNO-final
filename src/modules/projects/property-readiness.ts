import type { PrismaClient } from '@prisma/client';

export type ReadinessSeverity = 'blocker' | 'warning';

export interface PropertyReadinessItem {
  key: string;
  severity: ReadinessSeverity;
  scope: 'project' | 'unit';
  unitId?: string;
  unitName?: string;
  message: string;
  href: string;
}

export interface PropertyReadinessReport {
  projectId: string;
  score: number;
  readyForActivation: boolean;
  blockers: PropertyReadinessItem[];
  warnings: PropertyReadinessItem[];
  checkedAt: string;
}

/**
 * One activation report shared by the wizard, the admin review screen and the
 * write-side go-live gate. Keeping it server-side prevents the UI from
 * presenting a weaker definition of "ready" than the status transition uses.
 */
export async function getPropertyReadiness(
  db: PrismaClient,
  projectId: string
): Promise<PropertyReadinessReport | null> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      galleryMedia: true,
      inventoryCategories: true,
      orgRoles: true,
      ratePlans: true,
      integrationAccounts: true,
      regulatoryCredentials: true,
      units: {
        include: {
          media: true,
          sleepingSpaces: { include: { beds: true } },
          engagements: { where: { status: 'active' } },
          complianceRecords: true,
          regulatoryCredentials: true,
          mobilizationChecklist: true,
          roleAssignments: { where: { status: 'active' } },
          integrationAccounts: true,
          commercialOfferings: { include: { channelMappings: true } },
          inventoryCategory: { include: { galleryMedia: true } },
        },
      },
    },
  });
  if (!project) return null;

  // One batch read for source-linked units. Being in the physical portfolio
  // does not grant myUNO authority to sell a Layantara villa.
  const sourceMappings = project.units.length
    ? await db.externalMapping.findMany({
        where: { entity_type: 'unit',
          internal_id: { in: project.units.map(unit => unit.id) },
          externalSystem: { system_key: 'layantara_os' } },
        select: { internal_id: true, externalSystem: { select: { config: true } } },
      })
    : [];
  const sourceConfigByUnit = new Map(sourceMappings.map(mapping =>
    [mapping.internal_id, mapping.externalSystem.config] as const
  ));

  const blockers: PropertyReadinessItem[] = [];
  const warnings: PropertyReadinessItem[] = [];
  const projectHref = `/app/admin/properties/${project.id}/onboarding`;
  const add = (
    severity: ReadinessSeverity,
    key: string,
    message: string,
    options: Partial<PropertyReadinessItem> = {}
  ) => {
    const item: PropertyReadinessItem = {
      key,
      severity,
      scope: options.scope ?? 'project',
      message,
      href: options.href ?? projectHref,
      ...(options.unitId ? { unitId: options.unitId } : {}),
      ...(options.unitName ? { unitName: options.unitName } : {}),
    };
    (severity === 'blocker' ? blockers : warnings).push(item);
  };

  if (!project.areaId) add('blocker', 'project.area', 'Select a canonical area.');
  if (!project.descriptionKey) add('blocker', 'project.description', 'Add the project description key.');
  if (!project.coverMediaId && project.galleryMedia.length === 0) {
    add('blocker', 'project.media', 'Upload at least one project photo and choose a cover.');
  }
  if (project.inventoryCategories.length === 0) {
    add('blocker', 'project.categories', 'Create at least one inventory category.');
  }
  if (project.amenityKeys.length === 0 && project.facilities.length === 0) {
    add('warning', 'project.amenities', 'Add shared project amenities or facilities so guests know what is available on site.');
  }
  if (project.orgRoles.length === 0) {
    add('warning', 'project.organizations', 'No developer, operator or management company is linked.');
  }
  if (project.units.length === 0) add('blocker', 'project.units', 'Add at least one unit.');

  for (const unit of project.units) {
    const href = `/app/admin/units/${unit.id}`;
    const options = { scope: 'unit' as const, unitId: unit.id, unitName: unit.name, href };
    if (sourceConfigByUnit.has(unit.id)) {
      const raw = sourceConfigByUnit.get(unit.id);
      const config = typeof raw === 'object' && raw !== null && !Array.isArray(raw)
        ? raw as Record<string, unknown> : {};
      if (config.bookingAuthority !== 'myuno' || config.cutoverVerified !== true) {
        add('blocker', 'unit.source_authority',
          'Layantara source calendar remains authoritative; signed cutover is required.', options);
      }
      const canonicalStay = unit.commercialOfferings.find(offering =>
        offering.offeringType === 'short_term_stay');
      const terms = canonicalStay?.pricingTerms;
      const validated = typeof terms === 'object' && terms !== null &&
        !Array.isArray(terms) &&
        (terms as Record<string, unknown>).quoteEngine !== undefined &&
        (terms as Record<string, unknown>).quoteEngine !== 'pending_validation';
      if (unit.baseNightlyThb <= 0 || !validated) {
        add('blocker', 'unit.source_pricing',
          'Validate the source tariff grid and enable the canonical price engine before sale.', options);
      }
    }
    // A property's physical facts and title are shared, but commercial
    // activation is specific to the enabled offering. A sale-only or yearly
    // rental must not be forced to turn on short-stay inventory to go live.
    const activeOfferings = unit.commercialOfferings.filter(offering => offering.status === 'active');
    const hasStayOffering = activeOfferings.some(offering =>
      ['short_term_stay', 'short_stay', 'serviced_residence'].includes(offering.offeringType));
    const hasLongTermOffering = activeOfferings.some(offering => offering.offeringType === 'long_term_rental');
    const hasSaleOffering = activeOfferings.some(offering => offering.offeringType === 'sale');
    if (project.projectType && activeOfferings.length === 0) {
      // Keep the established resort-specific readiness key for existing
      // onboarding links while allowing a condominium to begin with sale or
      // long-term offers instead of fabricating a short-stay business model.
      const expectsStay = ['resort', 'villa_estate'].includes(project.projectType);
      add('blocker', expectsStay ? 'unit.stay_offering' : 'unit.offering',
        expectsStay ? 'Activate a short-stay commercial offering before publication.' :
          'Activate at least one commercial offering before publication.', options);
    }
    if (!unit.ownerIdentityId) add('blocker', 'unit.owner', 'Assign or invite the owner.', options);
    if (!unit.inventoryCategoryId) add('blocker', 'unit.category', 'Assign an inventory category.', options);
    if (!unit.descriptionKey) add('blocker', 'unit.description', 'Add a unit description key.', options);
    if (unit.amenityKeys.length === 0 && unit.unitFeatures.length === 0) {
      add('warning', 'unit.amenities', 'Add amenities or features that belong to this specific home.', options);
    }
    // Hotel rooms may use representative category media; private condos and
    // villas need genuine media of the exact physical unit.
    const representativeRoom = project.projectType === 'hotel' || unit.accommodationType === 'hotel_room';
    const ownMediaReady = Boolean(unit.coverMediaId) && unit.media.length >= 3;
    const categoryMediaReady = Boolean(unit.inventoryCategory?.coverMediaId) &&
      (unit.inventoryCategory?.galleryMedia.length ?? 0) >= 3;
    if (!ownMediaReady && !(representativeRoom && categoryMediaReady)) {
      add('blocker', 'unit.media', representativeRoom
        ? 'Add three room-type photos with a cover or photograph this room individually.'
        : 'Add at least three exact-unit photos and choose a cover.', options);
    }
    if (hasStayOffering && (unit.sleepingSpaces.length === 0 || !unit.sleepingSpaces.some((space) => space.beds.length > 0))) {
      add('blocker', 'unit.sleeping', 'Describe sleeping spaces and beds.', options);
    }
    if (unit.engagements.length === 0) add('blocker', 'unit.engagement', 'Record an active management engagement.', options);
    if ((hasStayOffering || hasLongTermOffering) &&
      (!unit.permittedUseConfirmedAt || !unit.complianceRecords.some((record) => record.recordType === 'permitted_use' && record.status === 'confirmed'))) {
      add('blocker', 'unit.permitted_use', 'Confirm a permitted-use compliance record.', options);
    }
    if (hasSaleOffering && ![...project.regulatoryCredentials, ...unit.regulatoryCredentials].some(credential =>
      credential.credentialType === 'title_legal_use' && credential.status === 'active')) {
      add('blocker', 'unit.sale_title', 'Verify active title and legal-use evidence before publishing a sale offering.', options);
    }
    const completed = new Set(unit.mobilizationChecklist.filter((item) => item.status === 'done' || item.status === 'skipped').map((item) => item.step));
    if (hasStayOffering && completed.size < 7) {
      add('blocker', 'unit.mobilization', 'Complete all seven hospitality mobilization steps.', options);
    }
    if (hasStayOffering && (
      !unit.inventoryCategory ||
      unit.inventoryCategory.status !== 'live' ||
      unit.inventoryCategory.baseNightlyThb <= 0 ||
      unit.inventoryCategory.minNights < 1
    )) {
      add(
        'blocker',
        'unit.pricing',
        'Set a valid base rate and minimum stay on the canonical inventory category.',
        options
      );
    }
    if (unit.roleAssignments.length === 0) add('warning', 'unit.team', 'No unit-scoped operating team member is assigned.', options);

    const mappings = unit.commercialOfferings.flatMap((offering) => offering.channelMappings);
    if (mappings.length === 0 && unit.integrationAccounts.length === 0) {
      add('warning', 'unit.channels', 'No OTA or calendar connection is configured.', options);
    } else if (hasStayOffering && mappings.some((mapping) => mapping.syncState !== 'ari_push')) {
      add('warning', 'unit.ota_push', 'OTA connection has no ARI push. A direct booking may not close external availability immediately.', options);
    }
  }


  const checks = blockers.length + warnings.length;
  const score = Math.max(0, Math.round(100 - blockers.length * 8 - warnings.length * 2));
  return {
    projectId,
    score: checks === 0 ? 100 : score,
    readyForActivation: blockers.length === 0,
    blockers,
    warnings,
    checkedAt: new Date().toISOString(),
  };
}

export async function assertUnitReadyForActivation(db: PrismaClient, unitId: string) {
  const unit = await db.unit.findUnique({
    where: { id: unitId },
    select: { projectId: true, project: { select: { projectType: true } } },
  });
  if (!unit) throw new Error(`Unit ${unitId} not found`);
  // Legacy projects retain the existing permitted-use gate until they enter
  // canonical onboarding and receive a project type.
  if (!unit.project.projectType) return;
  const report = await getPropertyReadiness(db, unit.projectId);
  const blockers = report?.blockers.filter((item) => item.scope === 'project' || item.unitId === unitId) ?? [];
  if (blockers.length > 0) {
    throw new Error(`Unit cannot go live: ${blockers.map((item) => item.message).join(' ')}`);
  }
}

export async function assertProjectReadyForActivation(db: PrismaClient, projectId: string) {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { projectType: true } });
  if (!project) throw new Error(`Project ${projectId} not found`);
  if (!project.projectType) return;
  const report = await getPropertyReadiness(db, projectId);
  if (!report) throw new Error(`Project ${projectId} not found`);
  if (!report.readyForActivation) {
    throw new Error(`Project cannot go live: ${report.blockers.map((item) => item.message).join(' ')}`);
  }
}
