import React from 'react';

interface LegalEntityBlockProps {
  /** Resolved `legal.entity.*` values and their labels, from the content layer. */
  labels: Record<string, string>;
  /**
   * Whether to name the entity as the PDPA data controller (doc 12) — true on
   * the privacy policy, false in the footer and on the terms page.
   */
  asDataController?: boolean;
}

/**
 * The operating entity's public facts (doc 08 §2, Q16 — answered 2026-07).
 *
 * These are the same six facts wherever they appear — footer, terms, privacy —
 * so they live in one component reading one set of content keys. A visitor who
 * needs to know who they are dealing with, or where to send a PDPA request,
 * finds the identical answer in every place the platform states it.
 */
export const LegalEntityBlock: React.FC<LegalEntityBlockProps> = ({
  labels,
  asDataController = false,
}) => {
  const rows: Array<[string, string]> = [
    [labels['legal.entity.label.name'], labels['legal.entity.name']],
    [labels['legal.entity.label.dbd_registration'], labels['legal.entity.dbd_registration']],
    [labels['legal.entity.label.address'], labels['legal.entity.address']],
    [labels['legal.entity.label.director'], labels['legal.entity.director']],
    [labels['legal.entity.label.email'], labels['legal.entity.email']],
    [labels['legal.entity.label.phone'], labels['legal.entity.phone']],
  ];

  return (
    <section className="bg-surface-paper border border-border-line rounded-md p-32">
      <h2 className="text-heading-3 font-bold text-text-ink mb-8">
        {asDataController
          ? labels['legal.entity.controller_title']
          : labels['legal.entity.title']}
      </h2>

      {asDataController ? (
        <p className="text-body text-text-secondary mb-20">
          {labels['legal.entity.controller_body']}
        </p>
      ) : null}

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-16">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-4">
            <dt className="text-small text-text-secondary">{label}</dt>
            <dd className="text-body text-text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};
