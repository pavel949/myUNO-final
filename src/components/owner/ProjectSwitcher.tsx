'use client';

import React, { useState } from 'react';

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
  onProjectChange: (projectId: string) => void;
}

export const ProjectSwitcher = React.forwardRef<HTMLDivElement, ProjectSwitcherProps>(
  ({ projects, selectedProjectId, onProjectChange }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedProject = projects.find((p) => p.id === selectedProjectId);

    const handleSelect = (projectId: string) => {
      onProjectChange(projectId);
      setIsOpen(false);
    };

    return (
      <div ref={ref} className="relative mb-32">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between w-full px-24 py-16 bg-surface-paper border border-border-line rounded-md hover:border-border-line-2 transition-colors"
        >
          <span className="text-body font-medium text-text-ink">
            {selectedProject?.name || 'Select project'}
          </span>
          <svg
            className={`w-20 h-20 text-text-secondary transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-8 bg-surface-ivory border border-border-line rounded-md shadow-lg z-10">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => handleSelect(project.id)}
                className={`w-full text-left px-24 py-12 text-body transition-colors border-b border-border-line last:border-b-0 ${
                  selectedProjectId === project.id
                    ? 'bg-brand-andaman-soft text-brand-andaman font-medium'
                    : 'hover:bg-surface-paper text-text-ink'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span>{project.name}</span>
                  <span className="text-small text-text-secondary">
                    {project._count.units} unit{project._count.units !== 1 ? 's' : ''}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
);

ProjectSwitcher.displayName = 'ProjectSwitcher';
