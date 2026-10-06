import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { hasProjectDepartmentAccess } from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { getUnitReadinessMap } from '@/modules/ops';
import CheckInWizard from './check-in-wizard';

export const dynamic = 'force-dynamic';

export default async function CheckInPage({ params }: { params: { bookingId: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/ops/stays/'+params.bookingId+'/check-in');

  const booking = await prisma.booking.findUnique({
    where: { id: params.bookingId },
    select: {
      id: true, status: true, projectId: true, unitId: true,
      adults: true, children: true, infants: true,
      verificationStatus: true,
      project: { select: { name: true } },
      unit: { select: { name: true } },
      _count: { select: { guests: true } },
    },
  });
  if (!booking) notFound();
  if (!(await hasProjectDepartmentAccess(user, booking.projectId, 'front_desk'))) notFound();

  const readiness = (await getUnitReadinessMap(prisma, [booking.unitId]))[booking.unitId]?.state ?? 'ready';
  const labels = await getLabels({
    'staff.checkin.back': 'Stay 360',
    'staff.checkin.kicker': 'Front Desk',
    'staff.checkin.title': 'Guided check-in',
    'staff.checkin.subtitle': 'Verify the party and property condition, then record the canonical check-in.',
    'staff.checkin.step.booking': 'Booking',
    'staff.checkin.step.guests': 'Guests & passports',
    'staff.checkin.step.property': 'Property readiness',
    'staff.checkin.step.confirm': 'Check in',
    'staff.checkin.condition_kicker': 'Condition baseline',
    'staff.checkin.condition_title': 'Walk the property before handover',
    'staff.checkin.item.entry': 'Entry & access',
    'staff.checkin.item.living': 'Living areas',
    'staff.checkin.item.kitchen': 'Kitchen',
    'staff.checkin.item.bedrooms': 'Bedrooms',
    'staff.checkin.item.bathrooms': 'Bathrooms',
    'staff.checkin.item.appliances': 'Appliances',
    'staff.checkin.notes': 'Condition notes',
    'staff.checkin.party': 'Registered party',
    'staff.checkin.verification': 'Guest verification',
    'staff.checkin.readiness': 'Property readiness',
    'staff.checkin.confirm': 'Confirm check-in',
    'staff.checkin.working': 'Checking in…',
    'staff.checkin.note': 'The existing booking state machine, readiness gate, TM30 creation and condition-report writer remain authoritative.',
    'staff.checkin.error': 'Check-in could not be completed.',
  });

  return (
    <main className="stitch-workspace p-16 md:p-32">
      <div className="mx-auto max-w-6xl space-y-20">
        <Link href={'/ops/stays/'+encodeURIComponent(booking.id)} className="text-small font-semibold text-brand-andaman">
          ← {labels['staff.checkin.back']}
        </Link>
        <header className="stitch-hero">
          <p className="stitch-kicker">{labels['staff.checkin.kicker']}</p>
          <h1 className="mt-8 font-display text-display-xl font-semibold">{labels['staff.checkin.title']}</h1>
          <p className="mt-8 text-body text-text-secondary">
            {booking.project.name} · {booking.unit.name} · {labels['staff.checkin.subtitle']}
          </p>
        </header>
        <CheckInWizard
          bookingId={booking.id}
          guestCount={booking._count.guests}
          expectedGuests={booking.adults + booking.children + booking.infants}
          verificationStatus={booking.verificationStatus}
          readiness={readiness}
          labels={labels}
        />
      </div>
    </main>
  );
}
