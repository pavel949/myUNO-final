import { hasSelfListingAccess } from '@/app/libs/supplierListingAccess';
/* eslint-disable local-rules/no-literal-ui-text */
import Link from 'next/link';
import ManagedGallery from '@/components/property/ManagedGallery';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { hasManagedUnitMcAccess } from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';
import ManagedUnitEditor from './managed-unit-editor';
export const dynamic = 'force-dynamic';

export default async function EditManagedUnitPage({
  params,
  searchParams,
}: {
  params: { unitId: string };
  searchParams?: { returnTo?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/ops/units');
  const unit = await prisma.unit.findUnique({ where: { id: params.unitId }, select: {
    id: true, name: true, projectId: true, bedrooms: true, bathrooms: true, maxGuests: true,
    sizeSqm: true, floor: true, addressSupplement: true, inventoryCategoryId: true, status: true,
    project: { select: { name: true } },
  } });
  if (!unit) notFound();
  const staff = user.roles.some((role) => role.role === 'staff_ops' && role.projectId === unit.projectId && (!role.unitId || role.unitId === unit.id));
  const mc = await hasManagedUnitMcAccess(user, { projectId: unit.projectId, unitId: unit.id });
  const selfListing = await hasSelfListingAccess(user.identityId, unit.id);
  if (!user.isAdmin && !staff && !mc && !selfListing) notFound();
  const requestedReturnTo = typeof searchParams?.returnTo === 'string' ? searchParams.returnTo : '';
  const safeMcReturnTo =
    requestedReturnTo.startsWith(`/mc/properties/${encodeURIComponent(unit.id)}?`) ||
    requestedReturnTo === `/mc/properties/${encodeURIComponent(unit.id)}`
      ? requestedReturnTo
      : `/mc/properties/${encodeURIComponent(unit.id)}`;
  const backHref = selfListing
    ? `/property/listings/${unit.id}`
    : mc && !staff
      ? safeMcReturnTo
      : `/ops/calendar/${unit.id}`;
  return <main className="stitch-workspace px-16 py-32 md:px-32"><div className="mx-auto max-w-4xl">
    <Link href={backHref} className="text-brand-andaman">← Unit calendar</Link>
    <h1 className="mt-12 font-display text-display-xl text-text-ink">Edit {unit.name}</h1>
    <p className="mt-8 text-text-secondary">{unit.project.name} · {unit.status} · Canonical physical record</p>
    <ManagedUnitEditor unit={unit}/><ManagedGallery scope="unit" id={unit.id}/>
  </div></main>;
}
