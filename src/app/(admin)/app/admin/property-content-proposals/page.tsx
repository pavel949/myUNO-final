import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { CONTENT_PROPOSAL_REVIEW_KEYS, CONTENT_PROPOSAL_REVIEW_DRAFTS } from '@/modules/content/content-proposal-review.seed';
import { CONTENT_PROPOSAL_EDITOR_KEYS, CONTENT_PROPOSAL_EDITOR_DRAFTS } from '@/modules/content/content-proposal-editor.seed';
import ContentProposalReview from './review-client';

export const dynamic = 'force-dynamic';
export default async function PropertyContentReviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=' + encodeURIComponent('/app/admin/property-content-proposals'));
  if (!user.isAdmin) redirect('/');
  const labels = await getLabels(Object.fromEntries([...CONTENT_PROPOSAL_REVIEW_KEYS, ...CONTENT_PROPOSAL_EDITOR_KEYS].map(row => [row.key, row.en])), getRequestLocale(), { ...CONTENT_PROPOSAL_REVIEW_DRAFTS, ...CONTENT_PROPOSAL_EDITOR_DRAFTS });
  return <main className="max-w-5xl"><h1 className="font-display text-display-xl font-semibold">{labels['property.content.review.title']}</h1><p className="mb-24 mt-8 text-text-secondary">{labels['property.content.review.intro']}</p><ContentProposalReview labels={labels} /></main>;
}
