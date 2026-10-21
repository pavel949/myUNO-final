import { unitEditorReturn } from '@/lib/property-editor-return';
import { getLabels } from '@/lib/i18n';
import {
  PROPERTY_EDITOR_DEFAULTS,
  PROPERTY_EDITOR_DRAFTS,
  editorLabel,
} from '@/modules/content/property-editor.seed';
import ManagedSleepingSpaces from '@/components/property/ManagedSleepingSpaces';
import { hasSelfListingAccess } from '@/app/libs/supplierListingAccess';
import Link from 'next/link';
import ManagedGallery from '@/components/property/ManagedGallery';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { hasManagedUnitMcAccess } from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';
import ManagedUnitEditor from './managed-unit-editor';
export const dynamic = 'force-dynamic';

export default async function EditManagedUnitPage(props: {
  params: Promise<{ unitId: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=' + encodeURIComponent('/ops/units/' + params.unitId + '/edit'));
  const unit = await prisma.unit.findUnique({
    where: { id: params.unitId },
    select: {
      id: true,
      name: true,
      projectId: true,
      bedrooms: true,
      bathrooms: true,
      maxGuests: true,
      sizeSqm: true,
      updatedAt: true,
      usableAreaSqm: true,
      grossAreaSqm: true,
      outdoorAreaSqm: true,
      plotAreaSqm: true,
      floor: true,
      addressSupplement: true,
      inventoryCategoryId: true,
      status: true,
      project: { select: { name: true } },
    },
  });
  if (!unit) notFound();
  const staff = user.roles.some(
    (role) =>
      role.role === 'staff_ops' &&
      role.projectId === unit.projectId &&
      (!role.unitId || role.unitId === unit.id)
  );
  const mc = await hasManagedUnitMcAccess(user, { projectId: unit.projectId, unitId: unit.id });
  const selfListing = await hasSelfListingAccess(user.identityId, unit.id);
  if (!user.isAdmin && !staff && !mc && !selfListing) notFound();
  const copy = await getLabels(PROPERTY_EDITOR_DEFAULTS, undefined, PROPERTY_EDITOR_DRAFTS);
  const l = (key: string) => editorLabel(copy, key);
  const rooms = user.isAdmin
    ? await prisma.sleepingSpace.findMany({
        where: { unitId: unit.id },
        include: { beds: true },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      })
    : [];
  const requestedReturnTo = typeof searchParams?.returnTo === 'string' ? searchParams.returnTo : '';
  const backHref = unitEditorReturn({
    unitId: unit.id,
    requested: requestedReturnTo,
    selfListing,
    mc,
    staff,
    admin: user.isAdmin,
  });
  return (
    <main className="stitch-workspace px-16 py-32 md:px-32">
      <div className="mx-auto max-w-4xl">
        <Link href={backHref} className="text-brand-andaman">
          {l('back')}
        </Link>
        <h1 className="mt-12 font-display text-display-xl text-text-ink">
          {l('edit').replace('{name}', unit.name)}
        </h1>
        <p className="mt-8 text-text-secondary">{unit.project.name}</p>
        <ManagedUnitEditor
          unit={{
            ...unit,
            updatedAt: unit.updatedAt.toISOString(),
            usableAreaSqm: unit.usableAreaSqm === null ? null : Number(unit.usableAreaSqm),
            grossAreaSqm: unit.grossAreaSqm === null ? null : Number(unit.grossAreaSqm),
            outdoorAreaSqm: unit.outdoorAreaSqm === null ? null : Number(unit.outdoorAreaSqm),
            plotAreaSqm: unit.plotAreaSqm === null ? null : Number(unit.plotAreaSqm),
          }}
          copy={copy}
        />
        <ManagedGallery scope="unit" id={unit.id} copy={copy} />
        {user.isAdmin ? (
          <ManagedSleepingSpaces
            unitId={unit.id}
            copy={copy}
            rooms={rooms.map((room) => ({ ...room, updatedAt: room.updatedAt.toISOString() }))}
          />
        ) : (
          <p className="mt-16 text-small text-text-secondary">{l('sleeping_admin')}</p>
        )}
      </div>
    </main>
  );
}
