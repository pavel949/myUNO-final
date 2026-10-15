import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { CONTENT_PROPOSAL_EDITOR_KEYS, CONTENT_PROPOSAL_EDITOR_DRAFTS } from '@/modules/content/content-proposal-editor.seed';
import ContentProposalEditor from './content-client';

export const dynamic = 'force-dynamic';
export default async function PropertyContentPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=' + encodeURIComponent('/property/content'));
  const locale = getRequestLocale();
  const labels = await getLabels(Object.fromEntries(CONTENT_PROPOSAL_EDITOR_KEYS.map(row => [row.key, row.en])), locale, CONTENT_PROPOSAL_EDITOR_DRAFTS);
  return <ContentProposalEditor labels={labels} initialLocale={locale} />;
}
