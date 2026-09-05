'use client';

import React from 'react';

interface Project {
  id: string;
  name: string;
  slug: string;
  _count: {
    units: number;
  };
}

interface ProjectSwitcherProps {
  projects: Project[];
  selectedProjectId: string | null;
  onProjectChange: (projectId: string | null) => void;
  labels?: {
    selectProject: string;
    unitSingular: string;
    unitPlural: string;
    allProjects?: string;
  };
}

export const ProjectSwitcher = React.forwardRef<HTMLDivElement, ProjectSwitcherProps>(
  ({ projects, selectedProjectId, onProjectChange, labels }, ref) => {
    const allProjectsLabel = labels?.allProjects ?? labels?.selectProject ?? '';

    const chip = (active: boolean) =>
      active
        ? 'px-16 py-8 rounded-full bg-brand-andaman text-surface-ivory text-small font-medium'
        : 'px-16 py-8 rounded-full bg-surface-paper border border-border-line text-small font-medium text-text-ink hover:border-border-line-2';

    return (
      <div ref={ref} className="flex flex-wrap gap-12 mb-32">
        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            onClick={() => onProjectChange(project.id)}
            className={chip(selectedProjectId === project.id)}
          >
            {project.name}
            {project._count.units
              ? ` · ${project._count.units}`
              : ''}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onProjectChange(null)}
          className={chip(selectedProjectId === null)}
        >
          {allProjectsLabel}
        </button>
      </div>
    );
  }
);

ProjectSwitcher.displayName = 'ProjectSwitcher';
