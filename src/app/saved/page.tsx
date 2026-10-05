import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { listSavedUnits } from '@/modules/browse';
import { getLabels } from '@/lib/i18n';
import SavedList from './saved-list';

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
    'saved.remove': 'Remove from saved',
    'saved.removing': 'Removing…',
    'saved.remove_failed': 'Could not remove this home. Please try again.',
    'saved.default_list': 'Saved homes',
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-surface-mint p-32">
        <div className="max-w-3xl mx-auto text-center bg-surface-paper border border-border-line rounded-lg shadow-card p-32">
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
    <div className="min-h-screen bg-surface-mint p-24 md:p-32">
      <div className="max-w-6xl mx-auto">
        <h1 className="font-display text-display-xl font-semibold text-brand-andaman md:text-display-hero-lg mb-24">
          {labels['saved.title']}
        </h1>

        <SavedList entries={savedEntries} labels={{
          emptyTitle: labels['saved.empty_title'],
          emptyHint: labels['saved.empty_hint'],
          searchButton: labels['saved.search_button'],
          perNight: labels['saved.per_night'],
          remove: labels['saved.remove'],
          removing: labels['saved.removing'],
          removeFailed: labels['saved.remove_failed'],
          defaultList: labels['saved.default_list'],
        }} />
      </div>
    </div>
  );
}
