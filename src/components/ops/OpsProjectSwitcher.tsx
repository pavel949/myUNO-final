import OpsProjectFilter from './OpsProjectFilter';
import { opsHref } from '@/app/libs/opsProjectContext';

export default function OpsProjectSwitcher({
  projects,
  activeProjectId,
  basePath,
  labels,
}: {
  projects: Array<{ id: string; name: string }>;
  activeProjectId: string | null;
  basePath: string;
  labels: Record<string, string>;
}) {
  if (projects.length <= 1) {
    return null;
  }

  return (
    <div className="mb-24">
      <OpsProjectFilter
        label={labels['staff.ops.context.switcher']}
        allLabel={labels['staff.ops.context.all_projects']}
        allHref={basePath}
        activeProjectId={activeProjectId}
        options={projects.map((project) => ({ ...project, href: opsHref(basePath, project.id) }))}
      />
    </div>
  );
}
