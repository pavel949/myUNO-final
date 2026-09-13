'use client';

import Link from 'next/link';
import React from 'react';

interface DeveloperProjectRelationship {
  id: string;
  roleKey: string;
  isPrimary: boolean;
  provenance?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  project: {
    id: string;
    name: string;
    slug: string;
    status: string;
    city?: string | null;
    developmentLifecycleStatus?: string | null;
    unitsCount: number;
    bookingsCount: number;
    categoryCount: number;
    ratePlanCount: number;
  };
}

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
    yearEstablished?: number | null;
    developerVerification?: string | null;
    developerTrackRecord?: {
      completedProjects?: number;
      activeProjects?: number;
      plannedProjects?: number;
      totalUnitsDelivered?: number;
    } | null;
  };
  completeness: number;
  credentialSummary: {
    total: number;
    active: number;
    verified: number;
  };
  projectRelationships: DeveloperProjectRelationship[];
  labels: Record<string, string>;
}

function valueOrDash(value: React.ReactNode) {
  return value === null || value === undefined || value === '' ? '—' : value;
}

export default function Developer360Client({
  organization,
  completeness,
  credentialSummary,
  projectRelationships,
  labels,
}: Developer360ClientProps) {
  const trackRecord = organization.developerTrackRecord || {};

  return (
    <div className="space-y-24">
      <div className="p-16 bg-surface-paper border border-border-line rounded-lg flex flex-col md:flex-row md:justify-between md:items-center gap-16">
        <div>
          <p className="text-small text-text-secondary">{labels['admin.dev360.score_label']}</p>
          <div className="flex items-center gap-8 mt-4">
            <div className="w-128 bg-surface-ivory h-8 rounded-full overflow-hidden">
              <div
                className="bg-brand-andaman h-full rounded-full"
                style={{ width: `${completeness}%` }}
              />
            </div>
            <span className="font-semibold text-text-ink">{completeness}%</span>
          </div>
        </div>
        <div className="flex items-center gap-8 flex-wrap">
          <span className="px-12 py-4 text-small bg-brand-sand text-text-ink rounded-full uppercase font-medium">
            {organization.developerVerification || 'unverified'}
          </span>
          <span className="px-12 py-4 text-small bg-surface-ivory border border-border-line text-text-ink rounded-full">
            {credentialSummary.verified}/{credentialSummary.total} credentials verified
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
        <section className="p-16 bg-surface-paper border border-border-line rounded-lg space-y-12">
          <h2 className="font-semibold text-subtitle text-text-ink">
            {labels['admin.dev360.identity_title']}
          </h2>
          <dl className="space-y-8 text-small">
            <div className="border-b border-border-line pb-6">
              <dt className="text-text-secondary">{labels['admin.dev360.legal_name']}</dt>
              <dd className="font-medium text-text-ink">{valueOrDash(organization.legalName || organization.name)}</dd>
            </div>
            <div className="border-b border-border-line pb-6">
              <dt className="text-text-secondary">{labels['admin.dev360.trading_name']}</dt>
              <dd className="font-medium text-text-ink">{valueOrDash(organization.tradingName)}</dd>
            </div>
            <div className="border-b border-border-line pb-6">
              <dt className="text-text-secondary">{labels['admin.dev360.registration_no']}</dt>
              <dd className="font-medium text-text-ink">{valueOrDash(organization.registrationNumber)}</dd>
            </div>
            <div className="border-b border-border-line pb-6">
              <dt className="text-text-secondary">Established</dt>
              <dd className="font-medium text-text-ink">{valueOrDash(organization.yearEstablished)}</dd>
            </div>
            <div>
              <dt className="text-text-secondary">{labels['admin.dev360.hq']}</dt>
              <dd className="font-medium text-text-ink">
                {valueOrDash([organization.officeAddress, organization.hqCountry].filter(Boolean).join(', '))}
              </dd>
            </div>
          </dl>
        </section>

        <section className="p-16 bg-surface-paper border border-border-line rounded-lg space-y-12">
          <h2 className="font-semibold text-subtitle text-text-ink">Contact & verification</h2>
          <dl className="space-y-8 text-small">
            <div className="border-b border-border-line pb-6">
              <dt className="text-text-secondary">Email</dt>
              <dd className="font-medium text-text-ink">{valueOrDash(organization.contactEmail)}</dd>
            </div>
            <div className="border-b border-border-line pb-6">
              <dt className="text-text-secondary">Phone</dt>
              <dd className="font-medium text-text-ink">{valueOrDash(organization.contactPhone)}</dd>
            </div>
            <div className="border-b border-border-line pb-6">
              <dt className="text-text-secondary">Website</dt>
              <dd className="font-medium text-text-ink break-all">{valueOrDash(organization.website)}</dd>
            </div>
            <div>
              <dt className="text-text-secondary">Active credentials</dt>
              <dd className="font-medium text-text-ink">{credentialSummary.active}</dd>
            </div>
          </dl>
        </section>

        <section className="p-16 bg-surface-paper border border-border-line rounded-lg space-y-12">
          <h2 className="font-semibold text-subtitle text-text-ink">Track record</h2>
          <div className="grid grid-cols-2 gap-8">
            {[
              ['Completed', trackRecord.completedProjects],
              ['Active', trackRecord.activeProjects],
              ['Planned', trackRecord.plannedProjects],
              ['Units delivered', trackRecord.totalUnitsDelivered],
            ].map(([label, value]) => (
              <div key={String(label)} className="p-12 rounded-md bg-surface-ivory border border-border-line">
                <p className="text-micro text-text-secondary">{label}</p>
                <p className="font-display text-title font-semibold text-text-ink">{valueOrDash(value as React.ReactNode)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="p-16 bg-surface-paper border border-border-line rounded-lg space-y-12">
        <div className="flex items-center justify-between gap-12">
          <h2 className="font-semibold text-subtitle text-text-ink">
            {labels['admin.dev360.portfolio_title']}
          </h2>
          <p className="text-small text-text-secondary">
            {labels['admin.dev360.linked_projects_count']}: <span className="font-semibold text-text-ink">{projectRelationships.length}</span>
          </p>
        </div>

        {projectRelationships.length === 0 ? (
          <p className="text-small text-text-muted">{labels['admin.dev360.no_projects']}</p>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
            {projectRelationships.map((relationship) => (
              <Link
                key={relationship.id}
                href={`/app/admin/projects/${relationship.project.id}`}
                className="block p-16 bg-surface-ivory border border-border-line rounded-md hover:border-brand-andaman transition-colors"
              >
                <div className="flex items-start justify-between gap-12 mb-12">
                  <div>
                    <p className="font-semibold text-text-ink">{relationship.project.name}</p>
                    <p className="text-small text-text-secondary">
                      {[relationship.project.city, relationship.project.developmentLifecycleStatus]
                        .filter(Boolean)
                        .join(' · ') || relationship.project.slug}
                    </p>
                  </div>
                  <div className="flex gap-6 flex-wrap justify-end">
                    {relationship.isPrimary ? (
                      <span className="text-micro px-8 py-2 bg-brand-andaman text-on-dark-text rounded-full">Primary</span>
                    ) : null}
                    <span className="text-micro px-8 py-2 bg-brand-sand text-text-ink rounded-full">
                      {relationship.roleKey.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-8 text-center">
                  <div><p className="text-micro text-text-secondary">Units</p><p className="font-semibold">{relationship.project.unitsCount}</p></div>
                  <div><p className="text-micro text-text-secondary">Categories</p><p className="font-semibold">{relationship.project.categoryCount}</p></div>
                  <div><p className="text-micro text-text-secondary">Rate plans</p><p className="font-semibold">{relationship.project.ratePlanCount}</p></div>
                  <div><p className="text-micro text-text-secondary">Bookings</p><p className="font-semibold">{relationship.project.bookingsCount}</p></div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
