import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { AdministrationError, workspaceAdministrator } from '@/modules/core/administration.service';
import { getAdministrationLabels } from '@/modules/core/administration-labels';
import ManagedAccountForm from '@/components/ops/ManagedAccountForm';

export const dynamic = 'force-dynamic';
export default async function WorkspaceAdministrationPage(props: { params: Promise<{ spaceId: string }>; searchParams?: Promise<{ offset?: string }> }) {
  const user = await getCurrentUser(); if (!user) redirect('/login');
  const { spaceId } = await props.params;
  const { actor, space } = await workspaceAdministrator(prisma, user.identityId, spaceId).catch(error => {
    if (error instanceof AdministrationError) notFound(); throw error;
  });
  const offset = Number((await props.searchParams)?.offset ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000) notFound();
  const members = await prisma.operatingSpaceMember.findMany({ where: { operatingSpaceId: spaceId }, take: 100, skip: offset,
    orderBy: { id: 'asc' }, include: { identity: { select: { firstName: true, lastName: true, isAdmin: true, isSuperAdmin: true } } } });
  const labels = await getAdministrationLabels();
  return <main className="stitch-workspace p-16 md:p-32"><div className="mx-auto max-w-3xl space-y-16">
    <Link href={'/ops/spaces/' + encodeURIComponent(spaceId)}>{labels.back}</Link>
    <h1 className="font-display text-heading-1">{space.name} · {labels.title}</h1>
    {members.map(member => <ManagedAccountForm key={member.id} kind={'workspace'} labels={labels}
      endpoint={`/api/ops/spaces/${encodeURIComponent(spaceId)}/people/${encodeURIComponent(member.identityId)}`}
      initial={{ ...member.identity, displayName: member.displayName, active: member.active, updatedAt: member.updatedAt.toISOString() }}
      canManage={actor.isSuperAdmin || !(member.identity.isAdmin || member.identity.isSuperAdmin || member.isAdministrator)}
      canDisable={member.identityId !== actor.id} />)}
    {members.length === 100 && offset < 10000 && <Link href={`?offset=${offset + 100}`}>{labels.more}</Link>}
  </div></main>;
}
