import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Breadcrumb } from '@/components/Breadcrumb';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { getDeveloper360 } from '@/modules/projects';
import Developer360Client from './Developer360Client';

export const dynamic = 'force-dynamic';

type DeveloperTrackRecord = {
  completedProjects?: number;
  activeProjects?: number;
  plannedProjects?: number;
  totalUnitsDelivered?: number;
};

export default async function Developer360Page({ params }: { params: { id: string } }) {
  const data = await getDeveloper360(prisma, params.id);
  if (!data) notFound();

  const labels = await getLabels({
    'admin.dev360.home': 'Home',
    'admin.dev360.admin': 'Admin',
    'admin.dev360.organizations': 'Organizations',
    'admin.dev360.back': 'All organizations',
    'admin.dev360.score_label': 'Developer Profile Completeness',
    'admin.dev360.identity_title': 'Developer Legal Identity',
    'admin.dev360.legal_name': 'Legal Entity Name',
    'admin.dev360.trading_name': 'Trading / Brand Name',
    'admin.dev360.registration_no': 'Company Reg. No.',
    'admin.dev360.hq': 'Headquarters',
    'admin.dev360.portfolio_title': 'Development Portfolio',
    'admin.dev360.linked_projects_count': 'Linked Projects',
    'admin.dev360.no_projects': 'No linked projects yet.',
  });

  const breadcrumbs = [
    { label: labels['admin.dev360.home'], href: '/' },
    { label: labels['admin.dev360.admin'], href: '/app/admin' },
    { label: labels['admin.dev360.organizations'], href: '/app/admin/organizations' },
    { label: data.organization.name, current: true },
  ];

  return (
    <div className="space-y-16">
      <Breadcrumb items={breadcrumbs} />
      <Link href="/app/admin/organizations" className="text-small text-text-secondary hover:underline">
        ← {labels['admin.dev360.back']}
      </Link>
      <h1 className="font-display text-display-xl font-semibold text-text-ink mt-8 mb-24">
        {data.organization.tradingName || data.organization.name}
      </h1>
      <Developer360Client
        organization={{
          id: data.organization.id,
          name: data.organization.name,
          legalName: data.organization.legalName,
          tradingName: data.organization.tradingName,
          website: data.organization.website,
          contactEmail: data.organization.contactEmail,
          contactPhone: data.organization.contactPhone,
          hqCountry: data.organization.hqCountry,
          officeAddress: data.organization.officeAddress,
          registrationNumber: data.organization.registrationNumber,
          yearEstablished: data.organization.yearEstablished,
          developerVerification: data.organization.developerVerification,
          developerTrackRecord: (data.organization.developerTrackRecord as DeveloperTrackRecord | null) || null,
        }}
        completeness={data.completeness}
        credentialSummary={data.credentialSummary}
        projectRelationships={data.projectRelationships.map((relationship) => ({
          id: relationship.id,
          roleKey: relationship.roleKey,
          isPrimary: relationship.isPrimary,
          provenance: relationship.provenance,
          effectiveFrom: relationship.effectiveFrom?.toISOString() ?? null,
          effectiveTo: relationship.effectiveTo?.toISOString() ?? null,
          project: {
            id: relationship.project.id,
            name: relationship.project.name,
            slug: relationship.project.slug,
            status: relationship.project.status,
            city: relationship.project.city,
            developmentLifecycleStatus: relationship.project.developmentLifecycleStatus,
            unitsCount: relationship.project._count.units,
            bookingsCount: relationship.project._count.bookings,
            categoryCount: relationship.project.inventoryCategories.length,
            ratePlanCount: relationship.project.ratePlans.filter((plan) => plan.status === 'active').length,
          },
        }))}
        labels={labels}
      />
    </div>
  );
}
