import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import PropertyWorkspaceNav from '@/app/property/workspace-nav';
import { getPropertyWorkspaces } from '@/modules/core/property-workspaces';
import { PROPERTY_WORKSPACE_LABELS, PROPERTY_WORKSPACE_DRAFTS } from '@/modules/content/property-workspace.seed';
import { PROPERTY_DELEGATION_LABELS, PROPERTY_DELEGATION_DRAFTS } from '@/modules/content/property-delegation.seed';
import PropertyAccessClient from './access-client';
export const dynamic = 'force-dynamic';
const WORKSPACE = 'access' as const;
export default async function PropertyAccessPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=%2Fproperty%2Faccess');
  const actor = await prisma.identity.findUnique({ where: { id: user.identityId }, select: { status: true, isAdmin: true } });
  if (actor?.status === 'active' && actor.isAdmin) redirect('/app/admin/people');
  if (!(await getPropertyWorkspaces(prisma, user.identityId)).includes('access')) redirect('/property');
  const labels = await getLabels({ ...PROPERTY_WORKSPACE_LABELS, ...PROPERTY_DELEGATION_LABELS }, undefined,
    { ...PROPERTY_WORKSPACE_DRAFTS, ...PROPERTY_DELEGATION_DRAFTS });
  return <main className="stitch-workspace mx-auto max-w-4xl px-16 py-32">
    <PropertyWorkspaceNav identityId={user.identityId} current={WORKSPACE} />
    <h1 className="font-display text-display-xl">{labels['property.delegation.title']}</h1>
    <p className="mt-12 text-text-secondary">{labels['property.delegation.intro']}</p>
    <PropertyAccessClient labels={labels} />
  </main>;
}
