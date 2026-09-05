import Link from 'next/link';
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

  const pillClass = (active: boolean) =>
    `inline-flex items-center rounded-full px-12 py-6 text-small border transition-colors ${
      active
        ? 'bg-brand-andaman-soft text-brand-andaman border-brand-andaman'
        : 'bg-surface-paper text-text-secondary border-border-line hover:text-text-ink'
    }`;

  return (
    <div className="mb-24">
      <p className="text-small text-text-secondary mb-8">{labels['staff.ops.context.switcher']}</p>
      <div className="flex flex-wrap gap-8">
        <Link href={basePath} className={pillClass(!activeProjectId)}>
          {labels['staff.ops.context.all_projects']}
        </Link>
        {projects.map((project) => (
          <Link
            key={project.id}
            href={opsHref(basePath, project.id)}
            className={pillClass(activeProjectId === project.id)}
          >
            {project.name}
          </Link>
        ))}
      </div>
      {activeProjectId ? (
        <p className="text-small text-text-secondary mt-12">
          {labels['staff.ops.context.active']}:{' '}
          {projects.find((project) => project.id === activeProjectId)?.name || activeProjectId}
        </p>
      ) : null}
    </div>
  );
}
