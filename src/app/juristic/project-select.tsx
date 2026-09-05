'use client';

interface JuristicProjectSelectProps {
  label: string;
  projectId: string;
  projects: { id: string; name: string }[];
}

export function JuristicProjectSelect({
  label,
  projectId,
  projects,
}: JuristicProjectSelectProps) {
  return (
    <form method="get" className="mb-24">
      <label className="text-small text-text-stone block mb-4" htmlFor="juristic-project">
        {label}
      </label>
      <select
        id="juristic-project"
        name="projectId"
        defaultValue={projectId}
        onChange={(event) => event.currentTarget.form?.submit()}
        className="h-48 px-16 border border-border-line rounded-lg bg-surface-paper text-text-ink"
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </form>
  );
}
