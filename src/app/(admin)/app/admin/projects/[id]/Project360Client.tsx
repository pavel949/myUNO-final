'use client';

import React from 'react';

export interface Project360ClientProps {
  project: {
    id: string;
    slug: string;
    name: string;
    address: string;
    projectType?: string | null;
    developmentLifecycleStatus?: string | null;
    totalUnits?: number | null;
    totalBuildings?: number | null;
    floors?: number | null;
    landAreaSqm?: number | null;
    facilities: string[];
  };
  developerOrg?: {
    id: string;
    name: string;
    tradingName?: string | null;
    website?: string | null;
  } | null;
  orgRoles: {
    id: string;
    roleKey: string;
    organization: {
      id: string;
      name: string;
    };
  }[];
  completenessScore: number;
  labels: Record<string, string>;
}

export default function Project360Client({
  project,
  developerOrg,
  orgRoles,
  completenessScore,
  labels,
}: Project360ClientProps) {
  return (
    <div className="space-y-24">
      {/* Header & Completeness */}
      <div className="p-16 bg-surface-white border border-border-subtle rounded-md flex justify-between items-center">
        <div>
          <p className="text-small text-text-secondary">{labels['admin.project360.score_label']}</p>
          <div className="flex items-center gap-8 mt-4">
            <div className="w-128 bg-surface-neutral h-8 rounded-full overflow-hidden">
              <div
                className="bg-brand-andaman h-full rounded-full"
                style={{ width: `${completenessScore}%` }}
              />
            </div>
            <span className="font-semibold text-text-ink">{completenessScore}%</span>
          </div>
        </div>
        <div>
          <span className="px-12 py-4 text-small bg-brand-deep text-on-dark-text rounded-full">
            {project.projectType || labels['admin.project360.type_unspecified']}
          </span>
        </div>
      </div>

      {/* Grid overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
        {/* Development Facts */}
        <div className="p-16 bg-surface-white border border-border-subtle rounded-md space-y-12">
          <h2 className="font-semibold text-subtitle text-text-ink">
            {labels['admin.project360.development_facts_title']}
          </h2>
          <div className="space-y-8 text-small">
            <div className="flex justify-between border-b border-border-subtle pb-4">
              <span className="text-text-secondary">{labels['admin.project360.status']}:</span>
              <span className="font-medium">{project.developmentLifecycleStatus || '—'}</span>
            </div>
            <div className="flex justify-between border-b border-border-subtle pb-4">
              <span className="text-text-secondary">{labels['admin.project360.total_units']}:</span>
              <span className="font-medium">{project.totalUnits ?? '—'}</span>
            </div>
            <div className="flex justify-between border-b border-border-subtle pb-4">
              <span className="text-text-secondary">{labels['admin.project360.buildings']}:</span>
              <span className="font-medium">{project.totalBuildings ?? '—'}</span>
            </div>
            <div className="flex justify-between pb-4">
              <span className="text-text-secondary">{labels['admin.project360.floors']}:</span>
              <span className="font-medium">{project.floors ?? '—'}</span>
            </div>
          </div>
        </div>

        {/* Developer & Roles */}
        <div className="p-16 bg-surface-white border border-border-subtle rounded-md space-y-12">
          <h2 className="font-semibold text-subtitle text-text-ink">
            {labels['admin.project360.developer_title']}
          </h2>
          {developerOrg ? (
            <div className="p-12 bg-surface-ivory rounded-md border border-border-subtle space-y-4">
              <p className="font-medium text-text-ink">{developerOrg.tradingName || developerOrg.name}</p>
              {developerOrg.website && (
                <p className="text-micro text-brand-deep">{developerOrg.website}</p>
              )}
            </div>
          ) : (
            <p className="text-small text-text-muted">{labels['admin.project360.no_developer']}</p>
          )}

          <h3 className="font-semibold text-small text-text-ink mt-12">
            {labels['admin.project360.org_roles_title']}
          </h3>
          <div className="space-y-4 text-small">
            {orgRoles.map((role) => (
              <div
                key={role.id}
                className="flex justify-between items-center p-8 bg-surface-neutral rounded"
              >
                <span className="font-medium">{role.organization.name}</span>
                <span className="text-micro px-8 py-2 bg-brand-sand text-text-ink rounded">
                  {role.roleKey}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Facilities */}
      <div className="p-16 bg-surface-white border border-border-subtle rounded-md space-y-12">
        <h2 className="font-semibold text-subtitle text-text-ink">
          {labels['admin.project360.facilities_title']}
        </h2>
        {project.facilities.length > 0 ? (
          <div className="flex flex-wrap gap-8">
            {project.facilities.map((fac) => (
              <span
                key={fac}
                className="px-12 py-6 bg-surface-ivory border border-border-subtle text-small text-text-ink rounded"
              >
                {fac}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-small text-text-muted">{labels['admin.project360.no_facilities']}</p>
        )}
      </div>
    </div>
  );
}
