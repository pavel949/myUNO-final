import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import { listSavedUnits } from '@/modules/browse';
import BuyingClient from './buying-client';

export const dynamic = 'force-dynamic';

/**
 * The buyer's surface (doc 07 F-BUY; journey audit "buyer").
 *
 * Doc 07 defers the buyer-facing surfaces to phase two (Q1) and the founder has
 * overridden that, so this is built — but built to the part of the journey the
 * platform can honestly serve today: **watch units, and get a person to talk
 * to**. The transaction itself runs with Ignatev Capital off-platform, which is
 * a business decision, not a missing screen.
 *
 * What it deliberately does **not** do is answer "can I own this, and how".
 * Q41 is open: there is no title identifier, no freehold/leasehold distinction,
 * no lease term, no foreign-quota position anywhere in the schema — and for a
 * Russian-speaking buyer in Thailand that is *the* question. Rendering a
 * confident answer the system does not hold would make the platform the system
 * of record for a claim nobody verified. So the page says plainly that the
 * structure is confirmed in writing during due diligence, and routes the
 * question to the people who can answer it.
 */
export default async function BuyingPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/buying');
  }

  const saved = await listSavedUnits(prisma, user.identityId);

  const projects = await prisma.project.findMany({
    where: { id: { in: [...new Set(saved.map((s) => s.unit.projectId))] } },
    select: { id: true, name: true },
  });
  const projectName = new Map(projects.map((p) => [p.id, p.name]));

  const labels = await getLabels({
    'buying.title': 'Buying',
    'buying.subtitle':
      'The homes you are watching, and a direct line to the team who handle purchases.',
    'buying.watching': 'Homes you are watching',
    'buying.watching_empty':
      'You have not saved any homes yet. Save one while you browse and it will appear here.',
    'buying.browse': 'Browse homes',
    'buying.project': 'Project',
    'buying.bedrooms': 'bedrooms',
    'buying.ask_title': 'Ask about buying',
    'buying.ask_intro':
      'Tell us what you are looking for — a particular home, a budget, or just a question. Someone from the team replies in your messages.',
    'buying.ask_unit': 'About a particular home (optional)',
    'buying.ask_unit_none': 'Not about a specific home',
    'buying.ask_message': 'Your message',
    'buying.ask_submit': 'Send to the team',
    'buying.ask_sending': 'Sending…',
    'buying.ask_sent':
      'Sent. The team will reply in your messages — you will get a notification.',
    'buying.ask_error': 'That did not send. Please try again.',
    'buying.ask_view_thread': 'Open the conversation',
    'buying.how_title': 'How buying works here',
    'buying.how_body':
      'myUNO operates the homes. The purchase itself is handled by Ignatev Capital, who take you through due diligence and the contract.',
    'buying.structure_title': 'About ownership structure',
    'buying.structure_body':
      'How a particular home can be owned — freehold, a company, a lease and its term — is confirmed in writing during due diligence, against the title documents. We do not display it here, because a figure on a screen is not a legal position and we will not have you rely on one.',
    'buying.messages': 'My messages',
  });

  return (
    <main className="min-h-screen bg-surface-background p-24 md:p-32">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-heading-1 font-bold text-text-ink mb-8">{labels['buying.title']}</h1>
        <p className="text-body text-text-secondary mb-32">{labels['buying.subtitle']}</p>

        <section className="mb-32">
          <div className="flex items-baseline justify-between mb-12">
            <h2 className="text-heading-3 font-semibold text-text-ink">
              {labels['buying.watching']}
            </h2>
            <Link
              href="/search"
              className="text-small text-brand-andaman font-semibold hover:underline"
            >
              {labels['buying.browse']}
            </Link>
          </div>

          {saved.length === 0 ? (
            <p className="text-body text-text-secondary">{labels['buying.watching_empty']}</p>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {saved.map((entry) => (
                <li key={entry.id}>
                  <Link
                    href={`/units/${entry.unit.id}`}
                    className="block p-16 bg-surface-paper border border-border-line rounded-lg hover:border-brand-andaman transition-colors"
                  >
                    <p className="text-body font-semibold text-text-ink">{entry.unit.name}</p>
                    <p className="text-small text-text-secondary">
                      {`${projectName.get(entry.unit.projectId) ?? '—'} · ${
                        entry.unit.bedrooms
                      } ${labels['buying.bedrooms']}`}
                    </p>
                    {entry.note ? (
                      <p className="text-xsmall text-text-secondary mt-4">{entry.note}</p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <BuyingClient
          units={saved.map((entry) => ({ id: entry.unit.id, name: entry.unit.name }))}
          labels={labels}
        />

        <section className="mt-32 pt-24 border-t border-border-line">
          <h2 className="text-heading-3 font-semibold text-text-ink mb-8">
            {labels['buying.how_title']}
          </h2>
          <p className="text-body text-text-secondary mb-24">{labels['buying.how_body']}</p>

          <h2 className="text-heading-3 font-semibold text-text-ink mb-8">
            {labels['buying.structure_title']}
          </h2>
          <p className="text-body text-text-secondary">{labels['buying.structure_body']}</p>
        </section>
      </div>
    </main>
  );
}
