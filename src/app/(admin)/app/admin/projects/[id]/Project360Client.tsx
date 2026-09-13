'use client';

import Link from 'next/link';
import React from 'react';

export interface Project360ClientProps {
  project: {
    id: string;
    slug: string;
    name: string;
    address: string;
    status: string;
    projectType?: string | null;
    developmentLifecycleStatus?: string | null;
    constructionStatus?: string | null;
    city?: string | null;
    region?: string | null;
    country?: string | null;
    totalUnits?: number | null;
    totalBuildings?: number | null;
    floors?: number | null;
    landAreaSqm?: number | null;
    completionYear?: number | null;
    expectedCompletion?: string | null;
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
    isPrimary: boolean;
    provenance?: string | null;
    organization: {
      id: string;
      name: string;
      orgType: string;
    };
  }[];
  canonicalInventory: {
    categories: Array<{
      id: string;
      categoryKey: string;
      name: string;
      bedrooms: number;
      bathrooms: number;
      maxGuests: number;
      baseNightlyThb: number;
      minNights: number;
      status: string;
      unitCount: number;
    }>;
    ratePlans: Array<{
      id: string;
      code: string;
      name: string;
      status: string;
      categoryId?: string | null;
      unitId?: string | null;
      adjustmentType?: string | null;
      adjustmentValue?: string | null;
      minNights?: number | null;
    }>;
    linkedUnits: number;
    legacyCategoryOnlyUnits: number;
    uncategorizedUnits: number;
    bookingsCount: number;
    ledgerEntriesCount: number;
    openWorkItemsCount: number;
  };
  completenessScore: number;
  labels: Record<string, string>;
}

function text(value: React.ReactNode) {
  return value === null || value === undefined || value === '' ? '—' : value;
}

export default function Project360Client({
  project,
  developerOrg,
  orgRoles,
  canonicalInventory,
  completenessScore,
  labels,
}: Project360ClientProps) {
  const canonicalCoverage =
    canonicalInventory.linkedUnits + canonicalInventory.legacyCategoryOnlyUnits + canonicalInventory.uncategorizedUnits;
  const canonicalCoveragePct = canonicalCoverage > 0
    ? Math.round((canonicalInventory.linkedUnits / canonicalCoverage) * 100)
    : 100;
  const replace = (template: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce(
      (result, [key, value]) => result.replace(`{${key}}`, String(value)),
      template
    );

  return (
    <div className="space-y-24">
      <div className="p-16 bg-surface-paper border border-border-line rounded-lg flex flex-col md:flex-row md:justify-between md:items-center gap-16">
        <div>
          <p className="text-small text-text-secondary">{labels['admin.project360.score_label']}</p>
          <div className="flex items-center gap-8 mt-4">
            <div className="w-128 bg-surface-ivory h-8 rounded-full overflow-hidden">
              <div
                className="bg-brand-andaman h-full rounded-full"
                style={{ width: `${completenessScore}%` }}
              />
            </div>
            <span className="font-semibold text-text-ink">{completenessScore}%</span>
          </div>
        </div>
        <div className="flex gap-8 flex-wrap">
          <span className="px-12 py-4 text-small bg-brand-deep text-on-dark-text rounded-full">
            {project.projectType || labels['admin.project360.type_unspecified']}
          </span>
          <span className="px-12 py-4 text-small bg-surface-ivory border border-border-line text-text-ink rounded-full">
            {project.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-16">
        <section className="p-16 bg-surface-paper border border-border-line rounded-lg space-y-12">
          <h2 className="font-semibold text-subtitle text-text-ink">
            {labels['admin.project360.development_facts_title']}
          </h2>
          <dl className="space-y-8 text-small">
            <div className="border-b border-border-line pb-6"><dt className="text-text-secondary">{labels['admin.project360.status']}</dt><dd className="font-medium">{text(project.developmentLifecycleStatus)}</dd></div>
            <div className="border-b border-border-line pb-6"><dt className="text-text-secondary">{labels['admin.project360.construction']}</dt><dd className="font-medium">{text(project.constructionStatus)}</dd></div>
            <div className="border-b border-border-line pb-6"><dt className="text-text-secondary">{labels['admin.project360.location']}</dt><dd className="font-medium">{text([project.city, project.region, project.country].filter(Boolean).join(', '))}</dd></div>
            <div className="border-b border-border-line pb-6"><dt className="text-text-secondary">{labels['admin.project360.total_units']}</dt><dd className="font-medium">{text(project.totalUnits)}</dd></div>
            <div className="border-b border-border-line pb-6"><dt className="text-text-secondary">{labels['admin.project360.buildings']}</dt><dd className="font-medium">{text(project.totalBuildings)}</dd></div>
            <div className="border-b border-border-line pb-6"><dt className="text-text-secondary">{labels['admin.project360.floors']}</dt><dd className="font-medium">{text(project.floors)}</dd></div>
            <div><dt className="text-text-secondary">{labels['admin.project360.completion']}</dt><dd className="font-medium">{text(project.completionYear || project.expectedCompletion)}</dd></div>
          </dl>
        </section>

        <section className="p-16 bg-surface-paper border border-border-line rounded-lg space-y-12">
          <h2 className="font-semibold text-subtitle text-text-ink">
            {labels['admin.project360.developer_title']}
          </h2>
          {developerOrg ? (
            <Link
              href={`/app/admin/developers/${developerOrg.id}`}
              className="block p-12 bg-surface-ivory rounded-md border border-border-line hover:border-brand-andaman transition-colors"
            >
              <p className="font-medium text-text-ink">{developerOrg.tradingName || developerOrg.name}</p>
              {developerOrg.website ? <p className="text-micro text-text-secondary break-all">{developerOrg.website}</p> : null}
              <p className="text-small text-brand-andaman mt-6">{labels['admin.project360.open_developer']} →</p>
            </Link>
          ) : (
            <p className="text-small text-text-muted">{labels['admin.project360.no_developer']}</p>
          )}

          <h3 className="font-semibold text-small text-text-ink mt-12">
            {labels['admin.project360.org_roles_title']}
          </h3>
          <div className="space-y-4 text-small">
            {orgRoles.map((role) => (
              <div key={role.id} className="flex justify-between items-center gap-12 p-8 bg-surface-ivory rounded">
                <div>
                  <span className="font-medium">{role.organization.name}</span>
                  {role.provenance ? <p className="text-micro text-text-secondary">{role.provenance}</p> : null}
                </div>
                <div className="flex gap-4 items-center">
                  {role.isPrimary ? <span className="text-micro px-6 py-2 bg-brand-andaman text-on-dark-text rounded">{labels['admin.project360.primary']}</span> : null}
                  <span className="text-micro px-8 py-2 bg-brand-sand text-text-ink rounded">
                    {role.roleKey.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="p-16 bg-surface-paper border border-border-line rounded-lg space-y-12">
          <h2 className="font-semibold text-subtitle text-text-ink">{labels['admin.project360.operational_title']}</h2>
          <div className="grid grid-cols-2 gap-8">
            {[
              [labels['admin.project360.metric_bookings'], canonicalInventory.bookingsCount],
              [labels['admin.project360.metric_ledger'], canonicalInventory.ledgerEntriesCount],
              [labels['admin.project360.metric_tickets'], canonicalInventory.openWorkItemsCount],
              [labels['admin.project360.metric_canonical_coverage'], `${canonicalCoveragePct}%`],
            ].map(([label, value]) => (
              <div key={String(label)} className="p-12 bg-surface-ivory border border-border-line rounded-md">
                <p className="text-micro text-text-secondary">{label}</p>
                <p className="font-display text-title font-semibold text-text-ink">{value}</p>
              </div>
            ))}
          </div>
          {canonicalInventory.legacyCategoryOnlyUnits > 0 || canonicalInventory.uncategorizedUnits > 0 ? (
            <div className="p-12 rounded-md bg-state-warning-soft border border-state-warning text-small text-text-ink">
              <p className="font-semibold">{labels['admin.project360.migration_required']}</p>
              <p>{replace(labels['admin.project360.migration_summary'], {
                legacy: canonicalInventory.legacyCategoryOnlyUnits,
                uncategorized: canonicalInventory.uncategorizedUnits,
              })}</p>
            </div>
          ) : null}
        </section>
      </div>

      <section className="p-16 bg-surface-paper border border-border-line rounded-lg space-y-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div>
            <h2 className="font-semibold text-subtitle text-text-ink">{labels['admin.project360.categories_title']}</h2>
            <p className="text-small text-text-secondary">{labels['admin.project360.categories_hint']}</p>
          </div>
          <span className="text-small text-text-secondary">
            {replace(labels['admin.project360.categories_count'], {
              categories: canonicalInventory.categories.length,
              units: canonicalInventory.linkedUnits,
            })}
          </span>
        </div>

        {canonicalInventory.categories.length === 0 ? (
          <p className="text-small text-text-muted">{labels['admin.project360.categories_empty']}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-small">
              <thead>
                <tr className="text-left text-text-secondary border-b border-border-line">
                  <th className="py-8 pr-12">{labels['admin.project360.col_category']}</th>
                  <th className="py-8 pr-12">{labels['admin.project360.col_units']}</th>
                  <th className="py-8 pr-12">{labels['admin.project360.col_beds_baths']}</th>
                  <th className="py-8 pr-12">{labels['admin.project360.col_guests']}</th>
                  <th className="py-8 pr-12">{labels['admin.project360.col_base_rate']}</th>
                  <th className="py-8">{labels['admin.project360.col_min_stay']}</th>
                </tr>
              </thead>
              <tbody>
                {canonicalInventory.categories.map((category) => (
                  <tr key={category.id} className="border-b border-border-line last:border-0">
                    <td className="py-10 pr-12"><p className="font-medium text-text-ink">{category.name}</p><p className="text-micro text-text-secondary">{category.categoryKey}</p></td>
                    <td className="py-10 pr-12">{category.unitCount}</td>
                    <td className="py-10 pr-12">{category.bedrooms} / {category.bathrooms}</td>
                    <td className="py-10 pr-12">{category.maxGuests}</td>
                    <td className="py-10 pr-12">฿{category.baseNightlyThb.toLocaleString()}</td>
                    <td className="py-10">{replace(labels['admin.project360.nights'], { count: category.minNights })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="p-16 bg-surface-paper border border-border-line rounded-lg space-y-12">
        <div>
          <h2 className="font-semibold text-subtitle text-text-ink">{labels['admin.project360.rate_plans_title']}</h2>
          <p className="text-small text-text-secondary">{labels['admin.project360.rate_plans_hint']}</p>
        </div>
        {canonicalInventory.ratePlans.length === 0 ? (
          <p className="text-small text-text-muted">{labels['admin.project360.rate_plans_empty']}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {canonicalInventory.ratePlans.map((plan) => (
              <div key={plan.id} className="p-12 bg-surface-ivory border border-border-line rounded-md">
                <div className="flex justify-between gap-8"><p className="font-medium text-text-ink">{plan.name}</p><span className="text-micro text-text-secondary">{plan.status}</span></div>
                <p className="text-micro text-text-secondary mt-2">{plan.code}</p>
                <p className="text-small mt-8 text-text-ink">
                  {plan.unitId
                    ? labels['admin.project360.scope_unit']
                    : plan.categoryId
                      ? labels['admin.project360.scope_category']
                      : labels['admin.project360.scope_project']}
                  {plan.adjustmentType && plan.adjustmentValue ? ` · ${plan.adjustmentType} ${plan.adjustmentValue}` : ''}
                  {plan.minNights ? ` · ${replace(labels['admin.project360.min_nights_inline'], { count: plan.minNights })}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="p-16 bg-surface-paper border border-border-line rounded-lg space-y-12">
        <h2 className="font-semibold text-subtitle text-text-ink">
          {labels['admin.project360.facilities_title']}
        </h2>
        {project.facilities.length > 0 ? (
          <div className="flex flex-wrap gap-8">
            {project.facilities.map((facility) => (
              <span key={facility} className="px-12 py-6 bg-surface-ivory border border-border-line text-small text-text-ink rounded">
                {facility}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-small text-text-muted">{labels['admin.project360.no_facilities']}</p>
        )}
      </section>
    </div>
  );
}
