/* eslint-disable local-rules/no-literal-ui-text */
import Link from 'next/link';
import { PageHeading } from '@/components/premium/StitchPage';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getProjectAmenityOpsActor } from '@/app/libs/projectExperienceGuard';
import { prisma } from '@/lib/prisma';
import ProjectWorkspaceNav from '@/components/projects/ProjectWorkspaceNav';
import AmenityReservationsClient from './amenity-reservations-client';

export const dynamic = 'force-dynamic';

export default async function AmenityReservationsPage({ params }: { params: { id: string; amenityId: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=' + encodeURIComponent(`/app/admin/projects/${params.id}/amenities/${params.amenityId}/reservations`));
  const actor = await getProjectAmenityOpsActor(params.id);
  if (!actor) redirect('/');

  const amenity = await prisma.projectAmenity.findFirst({
    where: { id: params.amenityId, projectId: params.id },
    select: { id: true, name: true, project: { select: { id: true, name: true } } },
  });
  if (!amenity) notFound();

  const rows = await prisma.projectAmenityReservation.findMany({
    where: { amenityId: amenity.id },
    orderBy: [{ startAt: 'asc' }, { createdAt: 'asc' }],
    include: {
      identity: { select: { firstName: true, lastName: true, email: true } },
      booking: { select: { id: true, unit: { select: { name: true } } } },
    },
    take: 500,
  });

  const reservations = rows.map(row => ({
    id: row.id,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    partySize: row.partySize,
    status: row.status,
    note: row.note,
    identity: row.identity,
    booking: row.booking,
  }));

  return <main className="mx-auto max-w-6xl p-24 md:p-32">
    <ProjectWorkspaceNav projectId={amenity.project.id} active={'experience'} contentOnly={!actor.isAdmin} />
    <Link href={`/app/admin/projects/${amenity.project.id}/experience`} className="text-small font-semibold text-brand-andaman underline">← Project Experience</Link>
    <p className="mt-12 text-kicker uppercase text-brand-andaman">Amenity reservations</p>
    <PageHeading title={amenity.name} />
    <p className="mt-8 mb-24 text-body text-text-secondary">{amenity.project.name} · upcoming and historical requests from guests/residents.</p>
    <AmenityReservationsClient reservations={reservations} />
  </main>;
}
