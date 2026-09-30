import Link from 'next/link';

export type ProjectEditorial = {
  eyebrow: string;
  headline: string;
  lead: string;
  benefitsTitle: string;
  benefits: Array<{ title: string; body: string }>;
  locationTitle: string;
  locationBody: string;
  areaName: string;
  areaDescription: string;
  groupsTitle: string;
  groupsBody: string;
  groupsCta: string;
};

/** Project-neutral, translated editorial sections. Source copy lives in content_key/translation. */
export default function ProjectEditorialSections({ editorial, projectId }: {
  editorial: ProjectEditorial; projectId: string;
}) {
  const benefits = editorial.benefits.filter(item => item.title && item.body);
  const hasIntro = Boolean(editorial.headline || editorial.lead);
  return <>
    {hasIntro && <section className="bg-surface-paper px-24 py-48 md:py-64">
      <div className="mx-auto max-w-5xl">
        {editorial.eyebrow && <p className="mb-12 text-kicker font-semibold text-brand-andaman">{editorial.eyebrow}</p>}
        {editorial.headline && <h2 className="font-display text-display-xl font-semibold text-text-ink">{editorial.headline}</h2>}
        {editorial.lead && <p className="mt-16 max-w-3xl whitespace-pre-line text-body text-text-secondary">{editorial.lead}</p>}
      </div>
    </section>}
    {benefits.length > 0 && <section className="bg-surface-ivory px-24 py-48 md:py-64">
      <div className="mx-auto max-w-6xl">
        {editorial.benefitsTitle && <h2 className="mb-24 font-display text-heading-2 font-semibold text-text-ink">{editorial.benefitsTitle}</h2>}
        <div className="grid gap-16 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((benefit, index) => <article key={index} className="rounded-xl border border-border-line bg-surface-paper p-24">
            <h3 className="font-display text-heading-3 font-semibold text-text-ink">{benefit.title}</h3>
            <p className="mt-12 text-small leading-relaxed text-text-secondary">{benefit.body}</p>
          </article>)}
        </div>
      </div>
    </section>}
    {(editorial.locationBody || editorial.areaDescription) && <section className="bg-surface-paper px-24 py-48 md:py-64">
      <div className="mx-auto max-w-5xl">
        {editorial.areaName && <p className="mb-12 text-kicker text-brand-andaman">{editorial.areaName}</p>}
        {editorial.locationTitle && <h2 className="font-display text-heading-2 font-semibold text-text-ink">{editorial.locationTitle}</h2>}
        {editorial.locationBody && <p className="mt-12 text-body text-text-secondary">{editorial.locationBody}</p>}
        {editorial.areaDescription && <p className="mt-12 text-small text-text-secondary">{editorial.areaDescription}</p>}
      </div>
    </section>}
    {(editorial.groupsTitle || editorial.groupsBody) && <section className="bg-surface-ivory px-24 py-48 md:py-64">
      <div className="mx-auto max-w-5xl rounded-2xl border border-border-line bg-surface-paper p-24 md:p-40">
        {editorial.groupsTitle && <h2 className="font-display text-heading-2 font-semibold text-text-ink">{editorial.groupsTitle}</h2>}
        {editorial.groupsBody && <p className="mt-12 text-body text-text-secondary">{editorial.groupsBody}</p>}
        {editorial.groupsCta && <Link href={`/search?projectId=${encodeURIComponent(projectId)}`} className="mt-24 inline-flex min-h-44 items-center rounded-lg bg-brand-andaman px-20 py-10 font-semibold text-white">{editorial.groupsCta}</Link>}
      </div>
    </section>}
  </>;
}
