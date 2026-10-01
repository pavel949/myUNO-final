/* eslint-disable local-rules/no-literal-ui-text */
import Link from 'next/link';
import ManagedGallery from '@/components/property/ManagedGallery';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { canWriteUnitListing, resolveUnitCommercialAuthority } from '@/modules/core';
import ManagedUnitEditor from './managed-unit-editor';
export const dynamic = 'force-dynamic';

export default async function EditManagedUnitPage({ params }: { params: { unitId: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/ops/units');
  const unit = await prisma.unit.findUnique({ where: { id: params.unitId }, select: {
    id: true, name: true, projectId: true, bedrooms: true, bathrooms: true, maxGuests: true,
    sizeSqm: true, floor: true, addressSupplement: true, inventoryCategoryId: true, status: true,
    project: { select: { name: true } },
  } });
  if (!unit) notFound();
  const identity = await prisma.identity.findUnique({ where: { id: user.identityId } });
  if (!identity) notFound();
  const allowed = await canWriteUnitListing(prisma, identity, unit.id, unit.projectId);
  if (!allowed) notFound();
  const authority = await resolveUnitCommercialAuthority(prisma, unit.id);
  const ownerDirect = authority?.mode === 'owner' && authority.ownerIdentityId === user.identityId;
  const mcManaged = authority?.mode === 'management_company' && user.roles.some((role) => role.role === 'mc_member');
  const backHref = ownerDirect
    ? `/owner/units/${unit.id}`
    : mcManaged
      ? `/mc/units/${unit.id}`
      : `/ops/calendar/${unit.id}`;
  return <main className="min-h-screen bg-surface-ivory px-16 py-32 md:px-32"><div className="mx-auto max-w-4xl">
    <Link href={backHref} className="text-brand-andaman">← Property workspace</Link>
    <h1 className="mt-12 font-display text-display-xl text-text-ink">Edit {unit.name}</h1>
    <p className="mt-8 text-text-secondary">{unit.project.name} · {unit.status} · Canonical physical record</p>
    <ManagedUnitEditor unit={unit}/><ManagedGallery scope="unit" id={unit.id}/>
  </div></main>;
}
