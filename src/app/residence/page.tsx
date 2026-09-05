import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { t } from '@/modules/content';
import { getResidences } from '@/modules/projects';

export const dynamic = 'force-dynamic';

/**
 * The resident's home (doc 07 F-RES; S6 without the stay card).
 *
 * A resident had no surface at all. The role could be granted, the permission
 * matrix had a column for it, and the person had nowhere to go afterwards —
 * someone living in a myUNO building could not read an announcement, open the
 * handbook, or order a service.
 *
 * Deliberately not the guest home space with the stay bits hidden. A resident is
 * not mid-stay: there is no check-out, no door code, no extension. What they
 * have is a building, and that is what this shows.
 */
export default async function ResidencePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/residence');
  }

  const residences = await getResidences(prisma, user.identityId);

  const labels = await getLabels({
    'residence.title': 'My residence',
    'residence.subtitle': 'Your building: what is happening, who to ask, and what you can order.',
    'residence.none':
      'You are not registered as a resident of any building yet. If that looks wrong, message the team and they will put it right.',
    'residence.none_action': 'Message the team',
    'residence.your_home': 'Your home',
    'residence.announcements': 'Announcements',
    'residence.announcements_empty': 'Nothing has been announced here yet.',
    'residence.pinned': 'Pinned',
    'residence.important': 'Important',
    'residence.posted_by.myuno': 'from myUNO',
    'residence.posted_by.management_company': 'from the management company',
    'residence.posted_by.juristic_person': 'from the juristic person',
    'residence.handbook': 'Building handbook',
    'residence.handbook_empty': 'No handbook has been published for this building yet.',
    'residence.services': 'Services here',
    'residence.services_empty': 'No services are available in this building yet.',
    'residence.services_all': 'See all services',
    'residence.from': 'from',
    'residence.quote': 'Priced on request',
    'residence.actions': 'Anything else',
    'residence.raise_ticket': 'Report a problem',
    'residence.messages': 'Messages',
    'residence.my_tickets': 'My requests',
  });

  if (residences.length === 0) {
    return (
      <main className="min-h-screen bg-surface-ivory p-24 md:p-32">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-display text-display-xl font-semibold text-text-ink mb-16">
            {labels['residence.title']}
          </h1>
          <div className="p-24 bg-surface-paper border border-border-line rounded-lg">
            <p className="text-body text-text-secondary mb-16">{labels['residence.none']}</p>
            <Link href="/messages" className="text-brand-andaman font-semibold hover:underline">
              {labels['residence.none_action']}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const locale = getRequestLocale();

  // The handbook is a content key per project, so it is edited in the admin
  // panel like every other piece of copy rather than being a field somebody has
  // to remember to fill in twice.
  const handbooks = await Promise.all(
    residences.map(async (residence) => {
      try {
        const value = await t(prisma, residence.handbookKey, undefined, locale);
        return value && value !== residence.handbookKey && value !== '—' ? value : '';
      } catch {
        return '';
      }
    })
  );

  const baht = (satang: number) =>
    `฿${(satang / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <main className="min-h-screen bg-surface-ivory p-24 md:p-32">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-display text-display-xl font-semibold text-text-ink mb-8">{labels['residence.title']}</h1>
        <p className="text-body text-text-secondary mb-32">{labels['residence.subtitle']}</p>

        {residences.map((residence, index) => (
          <section key={residence.projectId} className="mb-40">
            <div className="mb-24">
              <h2 className="font-display text-display font-semibold text-text-ink">
                {residence.projectName}
              </h2>
              {residence.units.length > 0 ? (
                <p className="text-small text-text-secondary mt-4">
                  {`${labels['residence.your_home']}: ${residence.units
                    .map((u) => u.name)
                    .join(', ')}`}
                </p>
              ) : null}
            </div>

            <h3 className="font-display text-title font-semibold text-text-ink mb-12">
              {labels['residence.announcements']}
            </h3>
            {residence.announcements.length === 0 ? (
              <p className="text-body text-text-secondary mb-24">
                {labels['residence.announcements_empty']}
              </p>
            ) : (
              <ul className="flex flex-col gap-12 mb-24">
                {residence.announcements.map((announcement) => (
                  <li
                    key={announcement.id}
                    className="p-16 bg-surface-paper border border-border-line rounded-lg shadow-card"
                  >
                    <div className="flex flex-wrap items-baseline gap-8 mb-4">
                      <p className="font-display text-title font-semibold text-text-ink">
                        {announcement.title}
                      </p>
                      {announcement.isPinned ? (
                        <span className="text-small text-brand-andaman font-semibold">
                          {labels['residence.pinned']}
                        </span>
                      ) : null}
                      {announcement.isImportant ? (
                        <span className="text-small text-state-warning font-semibold">
                          {labels['residence.important']}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-small text-text-stone whitespace-pre-wrap mb-8">
                      {announcement.body}
                    </p>
                    <p className="text-small text-text-stone">
                      {`${
                        (labels as Record<string, string>)[
                          `residence.posted_by.${announcement.postedAs}`
                        ] ?? ''
                      }${
                        announcement.organizationName ? ` · ${announcement.organizationName}` : ''
                      } · ${announcement.createdAt.toLocaleDateString(locale)}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <h3 className="font-display text-title font-semibold text-text-ink mb-12">
              {labels['residence.handbook']}
            </h3>
            <div className="p-16 bg-surface-paper border border-border-line rounded-lg mb-24">
              {handbooks[index] ? (
                // Rendered as text, never as HTML: it is admin-editable content
                // out of the database, and injecting it would put whatever an
                // editor typed into every resident's page as markup.
                <p className="text-small text-text-ink whitespace-pre-wrap">{handbooks[index]}</p>
              ) : (
                <p className="text-small text-text-secondary">
                  {labels['residence.handbook_empty']}
                </p>
              )}
            </div>

            <div className="flex items-baseline justify-between mb-12">
              <h3 className="font-display text-title font-semibold text-text-ink">
                {labels['residence.services']}
              </h3>
              <Link
                href="/services"
                className="text-small text-brand-andaman font-semibold hover:underline"
              >
                {labels['residence.services_all']}
              </Link>
            </div>
            {residence.services.length === 0 ? (
              <p className="text-body text-text-secondary">{labels['residence.services_empty']}</p>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-12">
                {residence.services.map((service) => (
                  <li key={service.id}>
                    <Link
                      href={`/services/${service.id}`}
                      className="block p-16 bg-surface-paper border border-border-line rounded-lg hover:border-brand-andaman transition-colors"
                    >
                      <p className="text-body font-semibold text-text-ink">{service.title}</p>
                      <p className="text-small text-text-secondary">
                        {service.priceModel === 'quote' || service.basePriceThb === null
                          ? labels['residence.quote']
                          : `${labels['residence.from']} ${baht(service.basePriceThb)}`}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <section className="pt-24 border-t border-border-line">
          <h3 className="font-display text-title font-semibold text-text-ink mb-12">
            {labels['residence.actions']}
          </h3>
          <div className="flex flex-wrap gap-16">
            <Link
              href="/tickets/new"
              className="px-16 py-8 rounded-lg bg-brand-deep text-on-dark-text text-small font-semibold"
            >
              {labels['residence.raise_ticket']}
            </Link>
            <Link href="/tickets" className="text-small text-brand-andaman hover:underline py-8">
              {labels['residence.my_tickets']}
            </Link>
            <Link href="/messages" className="text-small text-brand-andaman hover:underline py-8">
              {labels['residence.messages']}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
