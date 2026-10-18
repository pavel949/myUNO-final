import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { CONTENT_PROPOSAL_EDITOR_KEYS, CONTENT_PROPOSAL_EDITOR_DRAFTS } from '@/modules/content/content-proposal-editor.seed';
import PropertyWorkspaceNav from '@/app/property/workspace-nav';
import ContentProposalEditor from './content-client';

const CURRENT_WORKSPACE = 'content';
export const dynamic = 'force-dynamic';
export default async function PropertyContentPage({ searchParams }: { searchParams?: { scope?: string; targetId?: string; proposalId?: string } }) {
  const initialTarget = (searchParams?.scope === 'unit' || searchParams?.scope === 'project') && typeof searchParams.targetId === 'string' && searchParams.targetId.length > 0
    ? { scope: searchParams.scope as 'unit' | 'project', id: searchParams.targetId } : undefined;
  const params = new URLSearchParams();
  if (initialTarget) { params.set('scope', initialTarget.scope); params.set('targetId', initialTarget.id); }
  if (typeof searchParams?.proposalId === 'string') params.set('proposalId', searchParams.proposalId);
  const next = `/property/content${params.size ? `?${params}` : ''}`;
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=' + encodeURIComponent(next));
  // The unscoped employee picker deliberately has no admin assignments.
  // Follow the same active-admin routing pattern as /property/access.
  // Keep explicit target/proposal links intact for existing review workflows.
  if (!initialTarget && !searchParams?.proposalId) {
    const actor = await prisma.identity.findUnique({
      where: { id: user.identityId }, select: { status: true, isAdmin: true },
    });
    if (actor?.status === 'active' && actor.isAdmin) redirect('/app/admin/projects');
  }
  const locale = getRequestLocale();
  const labels = await getLabels(Object.fromEntries(CONTENT_PROPOSAL_EDITOR_KEYS.map(row => [row.key, row.en])), locale, CONTENT_PROPOSAL_EDITOR_DRAFTS);
  return <><PropertyWorkspaceNav identityId={user.identityId} current={CURRENT_WORKSPACE} /><ContentProposalEditor labels={labels} initialLocale={locale} initialTarget={initialTarget} initialProposalId={searchParams?.proposalId} /></>;
}
