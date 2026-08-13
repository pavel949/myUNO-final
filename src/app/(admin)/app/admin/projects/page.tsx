import { getLabels } from '@/lib/i18n';
import { listProjects } from '@/modules/projects';
import ProjectsAdminClient from './projects-client';

export const dynamic = 'force-dynamic';

export default async function AdminProjectsPage() {
  const projects = await listProjects();

  const labels = await getLabels({
    'admin.projects.title': 'Projects',
    'admin.projects.empty': 'No projects yet.',
    'admin.projects.name': 'Name',
    'admin.projects.slug': 'Slug',
    'admin.projects.status': 'Status',
    'admin.projects.address': 'Address',
    'admin.projects.save': 'Save',
    'admin.projects.edit': 'Edit',
    'admin.projects.cancel_edit': 'Cancel',
    'admin.projects.create_title': 'New project',
    'admin.projects.create': 'Create project',
    'admin.projects.latitude': 'Latitude',
    'admin.projects.longitude': 'Longitude',
    'admin.projects.error_generic': 'Action failed. Please try again.',
    'admin.projects.config_link': 'Pricing & config →',
  });

  return (
    <div>
      <h1 className="text-heading-1 font-bold text-text-ink mb-24">
        {labels['admin.projects.title']}
      </h1>
      <ProjectsAdminClient
        projects={projects.map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          status: p.status,
          address: p.address,
        }))}
        labels={labels}
      />
    </div>
  );
}
