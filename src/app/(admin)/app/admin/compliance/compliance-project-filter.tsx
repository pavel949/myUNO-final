'use client';

type Labels = Record<string, string>;

interface ProjectOption {
  id: string;
  name: string;
}

export default function ComplianceProjectFilter({
  projects,
  activeProjectId,
  labels,
}: {
  projects: ProjectOption[];
  activeProjectId: string;
  labels: Labels;
}) {
  if (projects.length === 0) return null;

  return (
    <form method="get" className="mb-24">
      <label className="text-small text-text-secondary block mb-4">
        {labels['admin.compliance.project_filter']}
      </label>
      <select
        name="projectId"
        defaultValue={activeProjectId}
        className="px-12 py-8 border border-border-line rounded-lg bg-surface-paper text-text-ink"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        <option value="">{labels['admin.compliance.all_projects']}</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </form>
  );
}
