'use client';

import React from 'react';

export interface Developer360ClientProps {
  organization: {
    id: string;
    name: string;
    legalName?: string | null;
    tradingName?: string | null;
    website?: string | null;
    contactEmail: string;
    contactPhone: string;
    hqCountry?: string | null;
    officeAddress?: string | null;
    registrationNumber?: string | null;
    developerVerification?: string | null;
  };
  completeness: number;
  projects: {
    id: string;
    name: string;
    slug: string;
  }[];
  labels: Record<string, string>;
}

export default function Developer360Client({
  organization,
  completeness,
  projects,
  labels,
}: Developer360ClientProps) {
  return (
    <div className="space-y-24">
      {/* Header & Verification */}
      <div className="p-16 bg-surface-white border border-border-subtle rounded-md flex justify-between items-center">
        <div>
          <p className="text-small text-text-secondary">{labels['admin.dev360.score_label']}</p>
          <div className="flex items-center gap-8 mt-4">
            <div className="w-128 bg-surface-neutral h-8 rounded-full overflow-hidden">
              <div
                className="bg-brand-andaman h-full rounded-full"
                style={{ width: `${completeness}%` }}
              />
            </div>
            <span className="font-semibold text-text-ink">{completeness}%</span>
          </div>
        </div>
        <div>
          <span className="px-12 py-4 text-small bg-brand-sand text-text-ink rounded-full uppercase font-medium">
            {organization.developerVerification || 'unverified'}
          </span>
        </div>
      </div>

      {/* Grid view */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
        {/* Core Identity */}
        <div className="p-16 bg-surface-white border border-border-subtle rounded-md space-y-12">
          <h2 className="font-semibold text-subtitle text-text-ink">
            {labels['admin.dev360.identity_title']}
          </h2>
          <div className="space-y-8 text-small">
            <div className="flex justify-between border-b border-border-subtle pb-4">
              <span className="text-text-secondary">{labels['admin.dev360.legal_name']}:</span>
              <span className="font-medium">{organization.legalName || organization.name}</span>
            </div>
            <div className="flex justify-between border-b border-border-subtle pb-4">
              <span className="text-text-secondary">{labels['admin.dev360.trading_name']}:</span>
              <span className="font-medium">{organization.tradingName || '—'}</span>
            </div>
            <div className="flex justify-between border-b border-border-subtle pb-4">
              <span className="text-text-secondary">{labels['admin.dev360.registration_no']}:</span>
              <span className="font-medium">{organization.registrationNumber || '—'}</span>
            </div>
            <div className="flex justify-between pb-4">
              <span className="text-text-secondary">{labels['admin.dev360.hq']}:</span>
              <span className="font-medium">{organization.hqCountry || '—'}</span>
            </div>
          </div>
        </div>

        {/* Contact & Portfolio */}
        <div className="p-16 bg-surface-white border border-border-subtle rounded-md space-y-12">
          <h2 className="font-semibold text-subtitle text-text-ink">
            {labels['admin.dev360.portfolio_title']}
          </h2>
          <div className="space-y-8 text-small">
            <p className="text-text-secondary">
              {labels['admin.dev360.linked_projects_count']}: <span className="font-semibold text-text-ink">{projects.length}</span>
            </p>
            <div className="space-y-4">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="p-8 bg-surface-ivory border border-border-subtle rounded flex justify-between items-center"
                >
                  <span className="font-medium text-text-ink">{p.name}</span>
                  <span className="text-micro text-text-muted">{p.slug}</span>
                </div>
              ))}
              {projects.length === 0 && (
                <p className="text-small text-text-muted">{labels['admin.dev360.no_projects']}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
