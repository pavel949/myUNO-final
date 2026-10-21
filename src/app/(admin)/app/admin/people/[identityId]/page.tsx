import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { AdministrationError, platformAccountAuthority } from '@/modules/core/administration.service';
import { getAdministrationLabels } from '@/modules/core/administration-labels';
import ManagedAccountForm from '@/components/ops/ManagedAccountForm';

export const dynamic = 'force-dynamic';
export default async function ManagedPersonPage(props: { params: Promise<{ identityId: string }> }) {
  const user = await getCurrentUser(); if (!user) redirect('/login');
  const { identityId } = await props.params;
  const { target } = await platformAccountAuthority(prisma, user.identityId, identityId).catch(error => {
    if (error instanceof AdministrationError) notFound(); throw error;
  });
  const labels = await getAdministrationLabels();
  return <main className="stitch-workspace p-16 md:p-32"><div className="mx-auto max-w-2xl space-y-16">
    <Link href="/app/admin/people">{labels.back}</Link><h1 className="font-display text-heading-1">{labels.title}</h1>
    <ManagedAccountForm kind={'platform'} labels={labels} endpoint={`/api/admin/people/${encodeURIComponent(identityId)}/manage`}
      initial={{ firstName: target.firstName, lastName: target.lastName, preferredLocale: target.preferredLocale,
        status: target.status, updatedAt: target.updatedAt.toISOString() }} canDisable={target.id !== user.identityId} />
  </div></main>;
}
