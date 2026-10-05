import type { PrismaClient } from '@prisma/client';
import { isCredentialCurrentlyVerified } from '@/modules/compliance/commercial-eligibility.engine';
import {
  assessGalleryReadiness,
  assessUnitMediaReadiness,
  publicMediaReadinessMessage,
} from '@/modules/media/public-readiness';

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
      galleryMedia: { include: { media: true }, orderBy: { sort: 'asc' } },
      inventoryCategories: {
        include: {
          galleryMedia: { include: { media: true }, orderBy: { sort: 'asc' } },
        },
      },
      orgRoles: true,
      ratePlans: true,
      integrationAccounts: true,
      regulatoryCredentials: true,
      units: {
        include: {
          media: { include: { media: true }, orderBy: { sort: 'asc' } },
          sleepingSpaces: { include: { beds: true } },
          engagements: { where: { status: 'active' } },
          complianceRecords: true,
          regulatoryCredentials: true,
          mobilizationChecklist: true,
          roleAssignments: { where: { status: 'active' } },
          integrationAccounts: true,
          commercialOfferings: { include: { channelMappings: true } },
          inventoryCategory: {
            include: {
              galleryMedia: { include: { media: true }, orderBy: { sort: 'asc' } },
            },
          },
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
        select: { internal_id: true, metadata: true, externalSystem: { select: { config: true } } },
      })
    : [];
  const sourceMappingByUnit = new Map(sourceMappings.map(mapping =>
    [mapping.internal_id, {
      config: mapping.externalSystem.config,
      metadata: mapping.metadata,
    }] as const
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
  const latitude = Number(project.latitude);
  const longitude = Number(project.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude === 0 || longitude === 0 ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    add('blocker', 'project.location', 'Set verified, non-zero project coordinates.');
  }
  const projectMedia = assessGalleryReadiness({
    coverMediaId: project.coverMediaId,
    links: project.galleryMedia,
  });
  if (!projectMedia.ready) {
    add(
      'blocker',
      'project.media',
      `Project gallery: ${publicMediaReadinessMessage(projectMedia)}`,
      { href: `/app/admin/projects/${project.id}/media` }
    );
  }
  if (projectMedia.ready && project.units.length > 0) {
    const exactUnitMediaIds = new Set(
      project.units.flatMap((unit) => unit.media.map((link) => link.mediaId))
    );
    const projectOnlyPhotoCount = project.galleryMedia.filter(
      (link) => !exactUnitMediaIds.has(link.mediaId)
    ).length;
    if (project.galleryMedia.length > 0 && projectOnlyPhotoCount === 0) {
      // A resort/villa-estate portal is a property-level promise. Reusing only
      // exact-unit photos as its project gallery makes a villa look like shared
      // resort context. Keep this a hard publication gate for those project
      // types while leaving exact-unit media fully usable on the unit itself.
      const provenanceSeverity: ReadinessSeverity =
        ['resort', 'villa_estate'].includes(project.projectType ?? '') ? 'blocker' : 'warning';
      add(
        provenanceSeverity,
        'project.media_provenance',
        'Project gallery is composed entirely of exact-unit media. Curate project/common-area photography so the portal does not present villa photos as shared property context.',
        { href: `/app/admin/projects/${project.id}/media` }
      );
    }
  }

  if (project.inventoryCategories.length === 0) {
    add('blocker', 'project.categories', 'Create at least one inventory category.');
  } else {
    for (const category of project.inventoryCategories.filter((item) => item.status === 'live')) {
      const categoryMedia = assessGalleryReadiness({
        coverMediaId: category.coverMediaId,
        links: category.galleryMedia,
      });
      if (!categoryMedia.ready) {
        // Representative type media is mandatory when the project genuinely
        // sells/allocates accommodation by category (hotel/resort/villa estate).
        // A condominium may still use categories for taxonomy while selling
        // exact units; missing type photography must not block an otherwise
        // truthful exact-unit listing.
        const categoryMediaSeverity: ReadinessSeverity =
          ['hotel', 'resort', 'villa_estate'].includes(project.projectType ?? '')
            ? 'blocker'
            : 'warning';
        add(
          categoryMediaSeverity,
          `category.media.${category.id}`,
          `${category.name}: ${publicMediaReadinessMessage(categoryMedia)}`,
          { href: `/app/admin/projects/${project.id}/media?select=category:${category.id}` }
        );
      }
    }
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
    if (sourceMappingByUnit.has(unit.id)) {
      const source = sourceMappingByUnit.get(unit.id)!;
      const rawConfig = source.config;
      const config = typeof rawConfig === 'object' && rawConfig !== null && !Array.isArray(rawConfig)
        ? rawConfig as Record<string, unknown> : {};
      const rawMetadata = source.metadata;
      const metadata = typeof rawMetadata === 'object' && rawMetadata !== null && !Array.isArray(rawMetadata)
        ? rawMetadata as Record<string, unknown> : {};
      if (config.bookingAuthority !== 'myuno' || config.cutoverVerified !== true) {
        add('blocker', 'unit.source_authority',
          'Layantara source calendar remains authoritative; signed cutover is required.', options);
      }
      if (metadata.specification_verification !== 'confirmed') {
        add('blocker', 'unit.source_specification',
          'Confirm the physical villa specification against the Layantara source crosswalk before publication.', options);
      }
      const canonicalStay = unit.commercialOfferings.find(offering =>
        offering.offeringType === 'short_term_stay');
      const terms = canonicalStay?.pricingTerms;
      const validated = typeof terms === 'object' && terms !== null &&
        !Array.isArray(terms) &&
        (terms as Record<string, unknown>).quoteEngine === 'canonical_tariff_grid_v1' &&
        (terms as Record<string, unknown>).taxPolicyVerified === true &&
        (terms as Record<string, unknown>).policyEngineVerified === true;
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
    // Public accommodation media follows one truthful rule everywhere:
    // private villas/condos require exact-unit photos; hotel rooms may use the
    // representative room-type gallery. The same helper is used by search and
    // public project/unit read models so readiness cannot drift from discovery.
    const unitMedia = assessUnitMediaReadiness({
      projectType: project.projectType,
      accommodationType: unit.accommodationType,
      unitCoverMediaId: unit.coverMediaId,
      unitMedia: unit.media,
      categoryCoverMediaId: unit.inventoryCategory?.coverMediaId,
      categoryMedia: unit.inventoryCategory?.galleryMedia ?? [],
    });
    if (!unitMedia.ready) {
      add(
        'blocker',
        'unit.media',
        project.projectType === 'hotel' || unit.accommodationType === 'hotel_room'
          ? 'Add three valid room-type photos with a cover or photograph this room individually.'
          : 'Add at least three valid exact-unit photos and choose a cover.',
        { ...options, href: `/app/admin/projects/${project.id}/media?select=unit:${unit.id}` }
      );
    }
    if (hasStayOffering && (unit.sleepingSpaces.length === 0 || !unit.sleepingSpaces.some((space) => space.beds.length > 0))) {
      add('blocker', 'unit.sleeping', 'Describe sleeping spaces and beds.', options);
    }
    if (unit.engagements.length === 0) add('blocker', 'unit.engagement', 'Record an active management engagement.', options);
    if ((hasStayOffering || hasLongTermOffering) &&
      (!unit.permittedUseConfirmedAt || !unit.complianceRecords.some((record) => record.recordType === 'permitted_use' && record.status === 'confirmed'))) {
      add('blocker', 'unit.permitted_use', 'Confirm a permitted-use compliance record.', options);
    }
    if (hasSaleOffering && !unit.regulatoryCredentials.some(credential =>
      credential.credentialType === 'title_legal_use' && isCredentialCurrentlyVerified(credential))) {
      add('blocker', 'unit.sale_title',
        'Attach and verify current title/legal-use evidence for this specific unit before publishing a sale offering.', options);
    }
    if (hasSaleOffering && !unit.regulatoryCredentials.some(credential =>
      credential.credentialType === 'sale_authority' && isCredentialCurrentlyVerified(credential))) {
      add('blocker', 'unit.sale_authority',
        'Attach a current verified seller or marketing authority document for this unit.', options);
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
  // A Project is the public residence/resort portal, not the sum of every
  // physical unit's sellability. Draft or evidence-incomplete units stay
  // private through their own activation gate and public read-model filters.
  // Requiring all unit blockers here made a 39-villa resort impossible to
  // publish incrementally and conflated project presentation with inventory.
  const projectBlockers = report.blockers.filter((item) => item.scope === 'project');
  if (projectBlockers.length > 0) {
    throw new Error(`Project cannot go live: ${projectBlockers.map((item) => item.message).join(' ')}`);
  }
}
