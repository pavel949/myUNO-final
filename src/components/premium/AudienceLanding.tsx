import type { ReactNode } from 'react';
import Link from 'next/link';
import { StitchMain, PublicHero, Panel, LinkButton } from './StitchPage';

/**
 * The Stitch audience landing (guests, buyers, providers, management
 * companies, developers): hero, how-it-works steps, value points, trust line
 * and the page's own extra content (lead form). Copy always comes from the
 * page's content keys.
 */
export function AudienceLanding({
  kicker, title, subtitle, cta, stepsTitle, steps = [], valuesTitle, values = [], trust, children,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  cta?: { href: string; label: ReactNode };
  stepsTitle?: ReactNode;
  steps?: Array<{ title: ReactNode; body: ReactNode }>;
  valuesTitle?: ReactNode;
  values?: ReactNode[];
  trust?: { body: ReactNode; href?: string; link?: ReactNode };
  children?: ReactNode;
}) {
  return (
    <StitchMain>
      <PublicHero
        dark
        kicker={kicker}
        title={title}
        body={subtitle}
        actions={cta ? <LinkButton href={cta.href} variant="light">{cta.label} →</LinkButton> : undefined}
      />

      {steps.length || values.length ? (
        <div className="grid gap-24 lg:grid-cols-2">
          {steps.length ? (
            <Panel title={stepsTitle}>
              <ol className="space-y-20">
                {steps.map((step, i) => (
                  <li key={i} className="flex gap-16">
                    <span className="flex h-40 w-40 shrink-0 items-center justify-center rounded-full bg-brand-andaman/10 font-display text-title font-semibold text-brand-andaman">
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="font-display text-title font-semibold text-text-ink">{step.title}</h3>
                      <p className="mt-4 text-body text-text-secondary">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>
          ) : null}
          {values.length ? (
            <Panel title={valuesTitle} soft>
              <ul className="space-y-16">
                {values.map((point, i) => (
                  <li key={i} className="flex gap-12 text-body">
                    <span aria-hidden="true" className="font-semibold text-brand-andaman">✓</span>
                    <span className="text-text-secondary">{point}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      ) : null}

      {trust ? (
        <Panel soft className="flex flex-col gap-12 md:flex-row md:items-center md:justify-between">
          <p className="max-w-3xl text-body text-text-secondary">{trust.body}</p>
          {trust.href && trust.link ? (
            <Link href={trust.href} className="shrink-0 font-semibold text-brand-andaman hover:underline">{trust.link}</Link>
          ) : null}
        </Panel>
      ) : null}

      {children}
    </StitchMain>
  );
}
