import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { listSavedUnits } from '@/modules/browse';
import { getLabels } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function SavedPage() {
  const user = await getCurrentUser();
  const labels = await getLabels({
    'saved.title': 'Saved Villas',
    'saved.signin_prompt': 'Sign in to view and manage your saved homes and trip shortlists.',
    'saved.signin_button': 'Sign In',
    'saved.empty_title': 'You have no saved villas yet.',
    'saved.empty_hint': 'Save villas while exploring to compare and plan your trip.',
    'saved.search_button': 'Search Villas',
    'saved.per_night': '/ night',
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-surface-ivory p-32">
        <div className="max-w-3xl mx-auto text-center bg-surface-paper border border-border-line rounded-lg p-32">
          <h1 className="font-display text-display font-semibold text-text-ink mb-16">
            {labels['saved.title']}
          </h1>
          <p className="text-body text-text-secondary mb-24">
            {labels['saved.signin_prompt']}
          </p>
          <Link
            href="/login?next=/saved"
            className="inline-flex items-center justify-center h-48 px-24 bg-brand-andaman text-surface-ivory rounded-sm font-semibold hover:opacity-90 transition"
          >
            {labels['saved.signin_button']}
          </Link>
        </div>
      </div>
    );
  }

  const savedEntries = await listSavedUnits(prisma, user.identityId);

  return (
    <div className="min-h-screen bg-surface-ivory p-24 md:p-32">
      <div className="max-w-6xl mx-auto">
        <h1 className="font-display text-display-xl font-semibold text-text-ink mb-24">
          {labels['saved.title']}
        </h1>

        {savedEntries.length === 0 ? (
          <div className="bg-surface-paper border border-border-line rounded-lg p-32 text-center">
            <p className="text-body text-text-ink mb-16">{labels['saved.empty_title']}</p>
            <p className="text-small text-text-secondary mb-24">
              {labels['saved.empty_hint']}
            </p>
            <Link
              href="/search"
              className="inline-flex items-center justify-center h-48 px-24 bg-brand-andaman text-surface-ivory rounded-sm font-semibold hover:opacity-90 transition"
            >
              {labels['saved.search_button']}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-24">
            {savedEntries.map((entry) => (
              <Link
                key={entry.id}
                href={`/units/${entry.unit.id}`}
                className="bg-surface-paper border border-border-line rounded-lg overflow-hidden hover:shadow-card transition-shadow"
              >
                <div className="aspect-video bg-gradient-to-br from-brand-andaman to-brand-andaman-dark flex items-center justify-center p-16">
                  <span className="text-surface-ivory font-display font-medium text-center">{entry.unit.name}</span>
                </div>
                <div className="p-16">
                  <h3 className="text-subtitle font-semibold text-text-ink mb-8">
                    {entry.unit.name}
                  </h3>
                  <p className="font-display text-title font-semibold text-brand-andaman tabular-nums">
                    ฿{entry.unit.baseNightlyThb?.toLocaleString()} {labels['saved.per_night']}
                  </p>
                  {entry.note && (
                    <p className="text-small text-text-secondary mt-8 italic">{entry.note}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
