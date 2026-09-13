import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Breadcrumb } from '@/components/Breadcrumb';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { getProjectFacts360 } from '@/modules/projects';
import Project360Client from './Project360Client';

export const dynamic = 'force-dynamic';

export default async function Project360Page({ params }: { params: { id: string } }) {
  const data = await getProjectFacts360(prisma, params.id);
  if (!data) notFound();

  const labels = await getLabels({
    'admin.project360.home': 'Home',
    'admin.project360.admin': 'Admin',
    'admin.project360.projects': 'Projects',
    'admin.project360.back': 'All projects',
    'admin.project360.score_label': 'Property Facts Completeness',
    'admin.project360.type_unspecified': 'Project',
    'admin.project360.development_facts_title': 'Development Facts',
    'admin.project360.status': 'Lifecycle Status',
    'admin.project360.construction': 'Construction',
    'admin.project360.location': 'Location',
    'admin.project360.total_units': 'Total Units',
    'admin.project360.buildings': 'Total Buildings',
    'admin.project360.floors': 'Floors',
    'admin.project360.completion': 'Completion',
    'admin.project360.developer_title': 'Developer Organization',
    'admin.project360.open_developer': 'Open Developer 360',
    'admin.project360.no_developer': 'No developer organization linked.',
    'admin.project360.org_roles_title': 'Organization Relationships',
    'admin.project360.primary': 'Primary',
    'admin.project360.operational_title': 'Operational footprint',
    'admin.project360.metric_bookings': 'Bookings',
    'admin.project360.metric_ledger': 'Ledger entries',
    'admin.project360.metric_tickets': 'Tickets',
    'admin.project360.metric_canonical_coverage': 'Canonical coverage',
    'admin.project360.migration_required': 'Inventory migration required',
    'admin.project360.migration_summary':
      '{legacy} unit(s) still rely only on legacy category keys; {uncategorized} are uncategorized.',
    'admin.project360.categories_title': 'Canonical inventory categories',
    'admin.project360.categories_hint':
      'Project → InventoryCategory → Unit. This is the sellable-class source of truth.',
    'admin.project360.categories_count': '{categories} categories · {units} linked units',
    'admin.project360.categories_empty': 'No canonical inventory categories configured.',
    'admin.project360.col_category': 'Category',
    'admin.project360.col_units': 'Units',
    'admin.project360.col_beds_baths': 'Beds/Baths',
    'admin.project360.col_guests': 'Guests',
    'admin.project360.col_base_rate': 'Base rate',
    'admin.project360.col_min_stay': 'Min stay',
    'admin.project360.nights': '{count} night(s)',
    'admin.project360.rate_plans_title': 'Rate plans',
    'admin.project360.rate_plans_hint':
      'Canonical commercial transformations attached at project, category, or unit scope.',
    'admin.project360.rate_plans_empty': 'No RatePlan records configured.',
    'admin.project360.scope_unit': 'Unit scoped',
    'admin.project360.scope_category': 'Category scoped',
    'admin.project360.scope_project': 'Project scoped',
    'admin.project360.min_nights_inline': 'min {count} nights',
    'admin.project360.facilities_title': 'Project Facilities',
    'admin.project360.no_facilities': 'No project facilities configured.',
  });

  const breadcrumbs = [
    { label: labels['admin.project360.home'], href: '/' },
    { label: labels['admin.project360.admin'], href: '/app/admin' },
    { label: labels['admin.project360.projects'], href: '/app/admin/projects' },
    { label: data.project.name, current: true },
  ];

  return (
    <div className="space-y-16">
      <Breadcrumb items={breadcrumbs} />
      <Link href="/app/admin/projects" className="text-small text-text-secondary hover:underline">
        ← {labels['admin.project360.back']}
      </Link>
      <h1 className="font-display text-display-xl font-semibold text-text-ink mt-8 mb-24">
        {data.project.name}
      </h1>
      <Project360Client
        project={{
          id: data.project.id,
          slug: data.project.slug,
          name: data.project.name,
          address: data.project.address,
          status: data.project.status,
          projectType: data.project.projectType,
          developmentLifecycleStatus: data.project.developmentLifecycleStatus,
          constructionStatus: data.project.constructionStatus,
          city: data.project.city,
          region: data.project.region,
          country: data.project.country,
          totalUnits: data.project.totalUnits,
          totalBuildings: data.project.totalBuildings,
          floors: data.project.floors,
          landAreaSqm: data.project.landAreaSqm ? Number(data.project.landAreaSqm) : null,
          completionYear: data.project.completionYear,
          expectedCompletion: data.project.expectedCompletion?.toISOString() ?? null,
          facilities: data.project.facilities,
        }}
        developerOrg={
          data.developerOrg
            ? {
                id: data.developerOrg.id,
                name: data.developerOrg.name,
                tradingName: data.developerOrg.tradingName,
                website: data.developerOrg.website,
              }
            : null
        }
        orgRoles={data.orgRoles.map((role) => ({
          id: role.id,
          roleKey: role.roleKey,
          isPrimary: role.isPrimary,
          provenance: role.provenance,
          organization: {
            id: role.organization.id,
            name: role.organization.name,
            orgType: role.organization.orgType,
          },
        }))}
        canonicalInventory={{
          categories: data.canonicalInventory.categories.map((category) => ({
            id: category.id,
            categoryKey: category.categoryKey,
            name: category.name,
            bedrooms: category.bedrooms,
            bathrooms: category.bathrooms,
            maxGuests: category.maxGuests,
            baseNightlyThb: Math.round(category.baseNightlyThb / 100),
            minNights: category.minNights,
            status: category.status,
            unitCount: category._count.units,
          })),
          ratePlans: data.canonicalInventory.ratePlans.map((plan) => ({
            id: plan.id,
            code: plan.code,
            name: plan.name,
            status: plan.status,
            categoryId: plan.categoryId,
            unitId: plan.unitId,
            adjustmentType: plan.adjustmentType,
            adjustmentValue: plan.adjustmentValue?.toString() ?? null,
            minNights: plan.minNights,
          })),
          linkedUnits: data.canonicalInventory.linkedUnits,
          legacyCategoryOnlyUnits: data.canonicalInventory.legacyCategoryOnlyUnits,
          uncategorizedUnits: data.canonicalInventory.uncategorizedUnits,
          bookingsCount: data.canonicalInventory.bookingsCount,
          ledgerEntriesCount: data.canonicalInventory.ledgerEntriesCount,
          openWorkItemsCount: data.canonicalInventory.openWorkItemsCount,
        }}
        completenessScore={data.completenessScore}
        labels={labels}
      />
    </div>
  );
}
