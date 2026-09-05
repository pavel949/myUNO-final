import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import OwnerStatementsClient from './statements-client';

export const dynamic = 'force-dynamic';

/**
 * All owner statements across units (doc 07 F-OWN-3).
 * Wired to GET /api/owner/statements — fixes breadcrumb from statement detail.
 */
export default async function OwnerStatementsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/owner/statements');
  }

  const isOwner = user.roles.some((role) => role.role === 'owner');
  if (!isOwner) {
    redirect('/');
  }

  const labels = await getLabels({
    'owner.statements.title': 'Your statements',
    'owner.statements.subtitle':
      'Monthly owner statements across all your units — published figures only.',
    'owner.statements.back': '← Owner dashboard',
    'owner.statements.loading': 'Loading statements…',
    'owner.statements.empty': 'No statements yet.',
    'owner.statements.error': 'Could not load statements.',
    'owner.statements.col_period': 'Period',
    'owner.statements.col_unit': 'Unit',
    'owner.statements.col_noi': 'NOI',
    'owner.statements.col_share': 'Your share',
    'owner.statements.col_status': 'Status',
    'owner.statements.view': 'View',
    'owner.statements.status.draft': 'Draft',
    'owner.statements.status.published': 'Published',
    'owner.statements.status.superseded': 'Superseded',
    'owner.statements.status.pending_owner_review': 'Awaiting your review',
    'owner.statements.status.signed_off': 'Signed off',
    'owner.statements.status.distributed': 'Distributed',
  });

  return (
    <main className="min-h-screen bg-surface-ivory p-24 md:p-32">
      <div className="max-w-4xl mx-auto">
        <p className="mb-8">
          <Link href="/owner" className="text-brand-andaman font-semibold hover:underline">
            {labels['owner.statements.back']}
          </Link>
        </p>
        <h1 className="font-display text-display-xl font-semibold text-text-ink mb-8">{labels['owner.statements.title']}</h1>
        <p className="text-body text-text-secondary mb-24">{labels['owner.statements.subtitle']}</p>
        <OwnerStatementsClient labels={labels} />
      </div>
    </main>
  );
}
