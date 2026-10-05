import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { getPublicProjectPassport, type PassportEvidenceStatus } from '@/modules/projects';
import { RecordPageHeader, StatusChip, SourceChip, EmptyState } from '@/components/premium/PremiumPrimitives';

export const dynamic = 'force-dynamic';

const humanize = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

function tone(status: PassportEvidenceStatus) {
  if (status === 'documented') return 'done' as const;
  if (status === 'partial') return 'waiting' as const;
  return 'neutral' as const;
}

export default async function ProjectPassportPage({ params }: { params: { slug: string } }) {
  const passport = await getPublicProjectPassport(prisma, params.slug);
  if (!passport) notFound();

  const locale = getRequestLocale();
  const labels = await getLabels({
    'passport.back': 'Back to project',
    'passport.kicker': 'PUBLIC PROJECT PASSPORT',
    'passport.title': '{project} · evidence snapshot',
    'passport.body':
      'This page shows only evidence currently present in myUNO canonical records. Missing evidence is shown as not publicly evidenced and is never treated as a pass.',
    'passport.disclaimer':
      'This is not legal due diligence, title advice, a valuation, or a warranty. Independent professional checks remain necessary before a transaction.',
    'passport.status.documented': 'Documented',
    'passport.status.partial': 'Partial evidence',
    'passport.status.not_evidenced': 'Not publicly evidenced',
    'passport.facts.title': 'Canonical project facts',
    'passport.facts.address': 'Address',
    'passport.facts.type': 'Project type',
    'passport.facts.completion': 'Completion year',
    'passport.facts.total_units': 'Declared total units',
    'passport.facts.live_units': 'Live public units',
    'passport.facts.location': 'Canonical coordinates',
    'passport.developer.title': 'Developer provenance',
    'passport.developer.empty':
      'No currently active developer or co-developer role with verified provenance is available for public display.',
    'passport.regulatory.title': 'Regulatory evidence',
    'passport.regulatory.empty':
      'No project-level regulatory credential is currently available for public display.',
    'passport.regulatory.current': 'Current verified record',
    'passport.regulatory.other': 'Recorded, but not current verified evidence',
    'passport.regulatory.verified': 'Verified',
    'passport.regulatory.expires': 'Expires {date}',
    'passport.regulatory.verified_at': 'Verified {date}',
    'passport.commercial.title': 'Active commercial coverage',
    'passport.commercial.empty': 'No active public commercial offering is recorded.',
    'passport.commercial.units': '{count} units',
    'passport.compliance.title': 'Unit compliance coverage',
    'passport.compliance.empty':
      'No confirmed unit compliance record is currently available for public display.',
    'passport.compliance.coverage': '{confirmed} of {total} live units',
    'passport.generated': 'Snapshot generated {date}',
    'passport.source.canonical': 'Canonical myUNO records',
    'passport.source.credentials': 'RegulatoryCredential',
    'passport.source.compliance': 'ComplianceRecord',
    'passport.source.offerings': 'CommercialOffering',
  });

  const statusLabel = (status: PassportEvidenceStatus) =>
    labels[`passport.status.${status}`] ?? status;

  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const number = new Intl.NumberFormat(locale);

  return (
    <main className="min-h-screen bg-surface-ivory">
      <RecordPageHeader
        eyebrow={
          <Link href={`/projects/${passport.project.slug}`} className="hover:text-brand-andaman">
            ← {labels['passport.back']}
          </Link>
        }
        title={labels['passport.title'].replace('{project}', passport.project.name)}
        subtitle={labels['passport.body']}
        chips={
          <>
            <SourceChip source={labels['passport.source.canonical']} />
            <span className="text-small text-text-secondary">
              {labels['passport.generated'].replace(
                '{date}',
                date.format(new Date(passport.generatedAt))
              )}
            </span>
          </>
        }
      />

      <div className="mx-auto max-w-6xl space-y-24 px-20 py-48 md:px-32 md:py-64">
        <section className="rounded-md border border-border-line bg-surface-paper p-24">
          <div className="flex flex-wrap items-center justify-between gap-12">
            <div>
              <p className="text-kicker uppercase tracking-[0.18em] text-brand-andaman">
                {labels['passport.kicker']}
              </p>
              <h2 className="mt-8 font-display text-display font-semibold text-text-ink">
                {labels['passport.facts.title']}
              </h2>
            </div>
            <SourceChip source={labels['passport.source.canonical']} />
          </div>
          <dl className="mt-24 grid gap-16 sm:grid-cols-2 lg:grid-cols-3">
            {[
              [labels['passport.facts.address'], passport.project.address || '—'],
              [labels['passport.facts.type'], passport.project.projectType ? humanize(passport.project.projectType) : '—'],
              [labels['passport.facts.completion'], passport.project.completionYear ?? '—'],
              [labels['passport.facts.total_units'], passport.project.totalUnits ?? '—'],
              [labels['passport.facts.live_units'], number.format(passport.facts.liveUnits)],
              [
                labels['passport.facts.location'],
                passport.project.latitude !== null && passport.project.longitude !== null
                  ? `${passport.project.latitude.toFixed(5)}, ${passport.project.longitude.toFixed(5)}`
                  : '—',
              ],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt className="text-small text-text-secondary">{label}</dt>
                <dd className="mt-4 text-body font-semibold text-text-ink">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-md border border-border-line bg-surface-paper p-24">
          <div className="flex flex-wrap items-center justify-between gap-12">
            <h2 className="font-display text-title font-semibold text-text-ink">
              {labels['passport.developer.title']}
            </h2>
            <StatusChip tone={tone(passport.developer.status)}>
              {statusLabel(passport.developer.status)}
            </StatusChip>
          </div>
          {passport.developer.organizations.length ? (
            <div className="mt-20 space-y-12">
              {passport.developer.organizations.map((organization) => (
                <div key={`${organization.name}-${organization.roleKey}`} className="flex flex-wrap items-center justify-between gap-8 border-b border-border-line pb-12 last:border-0 last:pb-0">
                  <div>
                    <p className="text-body font-semibold text-text-ink">{organization.name}</p>
                    <p className="text-small text-text-secondary">{humanize(organization.roleKey)}</p>
                  </div>
                  <StatusChip tone={organization.verification === 'verified' ? 'done' : 'neutral'}>
                    {organization.verification === 'verified'
                      ? labels['passport.status.documented']
                      : labels['passport.status.not_evidenced']}
                  </StatusChip>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-16 text-body text-text-secondary">{labels['passport.developer.empty']}</p>
          )}
        </section>

        <section className="rounded-md border border-border-line bg-surface-paper p-24">
          <div className="flex flex-wrap items-center justify-between gap-12">
            <div className="flex items-center gap-8">
              <h2 className="font-display text-title font-semibold text-text-ink">
                {labels['passport.regulatory.title']}
              </h2>
              <SourceChip source={labels['passport.source.credentials']} />
            </div>
            <StatusChip tone={tone(passport.regulatory.status)}>
              {statusLabel(passport.regulatory.status)}
            </StatusChip>
          </div>
          {passport.regulatory.credentials.length ? (
            <div className="mt-20 space-y-12">
              {passport.regulatory.credentials.map((credential, index) => (
                <article key={`${credential.requirementKey}-${index}`} className="rounded-lg border border-border-line bg-surface-ivory p-16">
                  <div className="flex flex-wrap items-start justify-between gap-12">
                    <div>
                      <h3 className="text-body font-semibold text-text-ink">
                        {humanize(credential.credentialType)}
                      </h3>
                      <p className="mt-8 text-small text-text-secondary">
                        {humanize(credential.requirementKey)}
                        {credential.issuingAuthority ? ` · ${credential.issuingAuthority}` : ''}
                      </p>
                    </div>
                    <StatusChip tone={credential.current ? 'done' : 'neutral'}>
                      {credential.current
                        ? labels['passport.regulatory.current']
                        : labels['passport.regulatory.other']}
                    </StatusChip>
                  </div>
                  <div className="mt-12 flex flex-wrap gap-12 text-small text-text-secondary">
                    {credential.verifiedAt ? (
                      <span>
                        {labels['passport.regulatory.verified_at'].replace(
                          '{date}',
                          date.format(new Date(credential.verifiedAt))
                        )}
                      </span>
                    ) : null}
                    {credential.expiryDate ? (
                      <span>
                        {labels['passport.regulatory.expires'].replace(
                          '{date}',
                          date.format(new Date(credential.expiryDate))
                        )}
                      </span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-16 text-body text-text-secondary">{labels['passport.regulatory.empty']}</p>
          )}
        </section>

        <section className="grid gap-24 lg:grid-cols-2">
          <article className="rounded-md border border-border-line bg-surface-paper p-24">
            <div className="flex flex-wrap items-center justify-between gap-12">
              <div className="flex items-center gap-8">
                <h2 className="font-display text-title font-semibold text-text-ink">
                  {labels['passport.commercial.title']}
                </h2>
                <SourceChip source={labels['passport.source.offerings']} />
              </div>
            </div>
            {Object.keys(passport.facts.activeOfferingCounts).length ? (
              <div className="mt-20 space-y-12">
                {Object.entries(passport.facts.activeOfferingCounts).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between gap-16 border-b border-border-line pb-12 last:border-0 last:pb-0">
                    <span className="text-body text-text-ink">{humanize(type)}</span>
                    <span className="font-mono text-small tabular-nums text-text-secondary">
                      {labels['passport.commercial.units'].replace('{count}', number.format(count))}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-16 text-body text-text-secondary">{labels['passport.commercial.empty']}</p>
            )}
          </article>

          <article className="rounded-md border border-border-line bg-surface-paper p-24">
            <div className="flex flex-wrap items-center justify-between gap-12">
              <div className="flex items-center gap-8">
                <h2 className="font-display text-title font-semibold text-text-ink">
                  {labels['passport.compliance.title']}
                </h2>
                <SourceChip source={labels['passport.source.compliance']} />
              </div>
              <StatusChip tone={tone(passport.unitCompliance.status)}>
                {statusLabel(passport.unitCompliance.status)}
              </StatusChip>
            </div>
            {passport.unitCompliance.byType.length ? (
              <div className="mt-20 space-y-12">
                {passport.unitCompliance.byType.map((item) => (
                  <div key={item.type} className="flex items-center justify-between gap-16 border-b border-border-line pb-12 last:border-0 last:pb-0">
                    <span className="text-body text-text-ink">{humanize(item.type)}</span>
                    <span className="font-mono text-small tabular-nums text-text-secondary">
                      {labels['passport.compliance.coverage']
                        .replace('{confirmed}', number.format(item.confirmedUnits))
                        .replace('{total}', number.format(item.totalUnits))}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-16 text-body text-text-secondary">{labels['passport.compliance.empty']}</p>
            )}
          </article>
        </section>

        <EmptyState title={labels['passport.disclaimer']} />
      </div>
    </main>
  );
}
