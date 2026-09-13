import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import AdminOrganizationsClient from './organizations-client';

export const dynamic = 'force-dynamic';

/**
 * Management companies, juristic persons, and developers (doc 02 §organizations).
 * Wired to GET/POST /api/admin/organizations and PUT/DELETE [organizationId].
 */
export default async function AdminOrganizationsPage() {
  const [projects, developers] = await Promise.all([
    prisma.project.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.organization.findMany({
      where: { orgType: 'developer' },
      select: {
        id: true,
        name: true,
        tradingName: true,
        developerVerification: true,
        projectRoles: {
          where: { roleKey: { in: ['developer', 'co_developer'] } },
          select: { id: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  const labels = await getLabels({
    'admin.organizations.title': 'Organizations',
    'admin.organizations.subtitle':
      'Management companies, juristic persons, and developers. Project relationships are represented canonically through organization roles.',
    'admin.organizations.loading': 'Loading organizations…',
    'admin.organizations.empty': 'No organizations match this filter.',
    'admin.organizations.error': 'Could not load organizations.',
    'admin.organizations.filter_all': 'All',
    'admin.organizations.filter_mc': 'Management companies',
    'admin.organizations.filter_juristic': 'Juristic persons',
    'admin.organizations.filter_developer': 'Developers',
    'admin.organizations.developer360_title': 'Developer 360',
    'admin.organizations.developer360_hint': 'Verified developer identity, portfolio, project roles and canonical inventory coverage.',
    'admin.organizations.developer360_projects': 'projects',
    'admin.organizations.developer360_open': 'Open profile',
    'admin.organizations.create_title': 'Add organization',
    'admin.organizations.create_submit': 'Create',
    'admin.organizations.col_name': 'Name',
    'admin.organizations.col_type': 'Type',
    'admin.organizations.col_project': 'Project',
    'admin.organizations.col_email': 'Contact email',
    'admin.organizations.col_phone': 'Contact phone',
    'admin.organizations.col_contact': 'Contact',
    'admin.organizations.col_members': 'Roles / engagements',
    'admin.organizations.col_action': '',
    'admin.organizations.project_any': 'Platform-wide',
    'admin.organizations.type.management_company': 'Management company',
    'admin.organizations.type.juristic_person': 'Juristic person',
    'admin.organizations.type.developer': 'Developer',
    'admin.organizations.edit': 'Edit',
    'admin.organizations.save': 'Save',
    'admin.organizations.cancel': 'Cancel',
    'admin.organizations.delete': 'Delete',
    'admin.organizations.confirm_delete':
      'Delete {name}? This cannot be undone. Organizations with active engagements cannot be deleted.',
  });

  return (
    <div>
      <h1 className="font-display text-display-xl font-semibold text-text-ink mb-8">
        {labels['admin.organizations.title']}
      </h1>
      <p className="text-body text-text-secondary mb-24 max-w-3xl">
        {labels['admin.organizations.subtitle']}
      </p>

      {developers.length > 0 ? (
        <section className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
          <div className="mb-16">
            <h2 className="text-heading-3 font-semibold text-text-ink">
              {labels['admin.organizations.developer360_title']}
            </h2>
            <p className="text-small text-text-secondary">
              {labels['admin.organizations.developer360_hint']}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-12">
            {developers.map((developer) => (
              <Link
                key={developer.id}
                href={`/app/admin/developers/${developer.id}`}
                className="block p-16 rounded-md bg-surface-ivory border border-border-line hover:border-brand-andaman transition-colors"
              >
                <div className="flex items-start justify-between gap-8">
                  <div>
                    <p className="font-semibold text-text-ink">
                      {developer.tradingName || developer.name}
                    </p>
                    <p className="text-small text-text-secondary">
                      {developer.projectRoles.length} {labels['admin.organizations.developer360_projects']}
                    </p>
                  </div>
                  <span className="text-micro px-8 py-2 rounded-full bg-brand-sand text-text-ink">
                    {developer.developerVerification || 'unverified'}
                  </span>
                </div>
                <p className="text-small text-brand-andaman mt-12">
                  {labels['admin.organizations.developer360_open']} →
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <AdminOrganizationsClient labels={labels} projects={projects} />
    </div>
  );
}
