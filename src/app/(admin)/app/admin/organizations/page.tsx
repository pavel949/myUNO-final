import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import AdminOrganizationsClient from './organizations-client';

export const dynamic = 'force-dynamic';

/**
 * Management companies, juristic persons, and developers (doc 02 §organizations).
 * Wired to GET/POST /api/admin/organizations and PUT/DELETE [organizationId].
 */
export default async function AdminOrganizationsPage() {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const labels = await getLabels({
    'admin.organizations.title': 'Organizations',
    'admin.organizations.subtitle':
      'Management companies, juristic persons, and developers. MC members and juristic roles are scoped to these records.',
    'admin.organizations.loading': 'Loading organizations…',
    'admin.organizations.empty': 'No organizations match this filter.',
    'admin.organizations.error': 'Could not load organizations.',
    'admin.organizations.filter_all': 'All',
    'admin.organizations.filter_mc': 'Management companies',
    'admin.organizations.filter_juristic': 'Juristic persons',
    'admin.organizations.filter_developer': 'Developers',
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
      <AdminOrganizationsClient labels={labels} projects={projects} />
    </div>
  );
}
