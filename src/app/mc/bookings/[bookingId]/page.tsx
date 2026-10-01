import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { hasManagedUnitMcAccess } from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import StayActions from '@/components/ops/StayActions';

export const dynamic = 'force-dynamic';

export default async function MCBookingPage({
  params,
}: {
  params: { bookingId: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/mc/bookings/${params.bookingId}`);

  const booking = await prisma.booking.findUnique({
    where: { id: params.bookingId },
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      totalThb: true,
      balanceDueThb: true,
      channel: true,
      projectId: true,
      unitId: true,
      guestNote: true,
      adults: true,
      children: true,
      unit: {
        select: {
          name: true,
          inventoryCategory: { select: { name: true } },
        },
      },
      project: { select: { name: true } },
      guestIdentity: { select: { firstName: true, lastName: true } },
      changes: {
        select: { id: true, changeType: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });
  if (!booking) notFound();

  const allowed = await hasManagedUnitMcAccess(user, {
    projectId: booking.projectId,
    unitId: booking.unitId,
  });
  if (!allowed) notFound();

  const labels = await getLabels({
    'mc.booking.title': 'Reservation',
    'mc.booking.back': 'Portfolio calendar',
    'mc.booking.guest': 'Guest',
    'mc.booking.status': 'Status',
    'mc.booking.channel': 'Channel',
    'mc.booking.dates': 'Stay dates',
    'mc.booking.guests': 'Guests',
    'mc.booking.total': 'Booking total',
    'mc.booking.balance': 'Balance due',
    'mc.booking.note': 'Guest note',
    'mc.booking.history': 'Change history',
    'mc.booking.no_history': 'No booking changes recorded.',
    'staff.stay_360.request': 'Approve request',
    'staff.stay_360.cash': 'Record cash payment',
    'staff.stay_360.receipt': 'Receipt reference',
    'staff.stay_360.check_in': 'Check in',
    'staff.stay_360.check_out': 'Check out',
    'staff.stay_360.error': 'Action failed; check the booking and retry.',
    'staff.stay_360.success': 'Booking updated.',
    'staff.stay_360.no_actions': 'No available status transition.',
    'staff.stay_360.actions': 'Next action',
    'staff.stay_360.warning': 'Payment or refund changes require a verified financial transaction.',
  });

  const amount = (value: number) =>
    '฿' +
    (value / 100).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <main className="min-h-screen bg-surface-ivory p-16 md:p-32">
      <div className="mx-auto max-w-4xl space-y-24">
        <Link
          href={`/mc/calendar?projectId=${encodeURIComponent(booking.projectId)}`}
          className="text-small font-semibold text-brand-andaman"
        >
          ← {labels['mc.booking.back']}
        </Link>

        <header className="rounded-lg border border-border-line bg-surface-paper p-24">
          <p className="text-kicker font-semibold tracking-widest text-brand-andaman">
            {labels['mc.booking.title']} · {booking.id}
          </p>
          <h1 className="mt-8 font-display text-display-xl font-semibold text-text-ink">
            {booking.project.name} · {booking.unit.name}
          </h1>
          {booking.unit.inventoryCategory?.name ? (
            <p className="mt-6 text-small text-text-secondary">
              {booking.unit.inventoryCategory.name}
            </p>
          ) : null}
        </header>

        <div className="grid gap-16 md:grid-cols-[1fr_320px]">
          <section className="rounded-lg border border-border-line bg-surface-paper p-20">
            <dl className="grid gap-16 sm:grid-cols-2">
              <div>
                <dt className="text-small text-text-secondary">{labels['mc.booking.status']}</dt>
                <dd className="mt-4 font-semibold text-text-ink">{booking.status.replace(/_/g, ' ')}</dd>
              </div>
              <div>
                <dt className="text-small text-text-secondary">{labels['mc.booking.channel']}</dt>
                <dd className="mt-4 font-semibold text-text-ink">{booking.channel.replace(/_/g, ' ')}</dd>
              </div>
              <div>
                <dt className="text-small text-text-secondary">{labels['mc.booking.guest']}</dt>
                <dd className="mt-4 font-semibold text-text-ink">
                  {[booking.guestIdentity.firstName, booking.guestIdentity.lastName].filter(Boolean).join(' ')}
                </dd>
              </div>
              <div>
                <dt className="text-small text-text-secondary">{labels['mc.booking.dates']}</dt>
                <dd className="mt-4 font-semibold text-text-ink">
                  {booking.startDate.toISOString().slice(0, 10)} — {booking.endDate.toISOString().slice(0, 10)}
                </dd>
              </div>
              <div>
                <dt className="text-small text-text-secondary">{labels['mc.booking.guests']}</dt>
                <dd className="mt-4 font-semibold text-text-ink">
                  {booking.adults + booking.children}
                </dd>
              </div>
              <div>
                <dt className="text-small text-text-secondary">{labels['mc.booking.total']}</dt>
                <dd className="mt-4 font-display font-semibold text-text-ink">{amount(booking.totalThb)}</dd>
              </div>
              <div>
                <dt className="text-small text-text-secondary">{labels['mc.booking.balance']}</dt>
                <dd className="mt-4 font-display font-semibold text-text-ink">{amount(booking.balanceDueThb)}</dd>
              </div>
            </dl>
            {booking.guestNote ? (
              <div className="mt-20 border-t border-border-line pt-16">
                <p className="text-small text-text-secondary">{labels['mc.booking.note']}</p>
                <p className="mt-4 whitespace-pre-wrap text-body text-text-ink">{booking.guestNote}</p>
              </div>
            ) : null}
          </section>

          <StayActions
            id={booking.id}
            status={booking.status}
            balanceSatang={0}
            canRecordMoney={false}
            canManageReservations
            canManageFrontDesk
            labels={labels}
          />
        </div>

        <section className="rounded-lg border border-border-line bg-surface-paper p-20">
          <h2 className="text-subtitle font-semibold text-text-ink">{labels['mc.booking.history']}</h2>
          {booking.changes.length === 0 ? (
            <p className="mt-12 text-small text-text-secondary">{labels['mc.booking.no_history']}</p>
          ) : (
            <ul className="mt-12 space-y-8">
              {booking.changes.map((change) => (
                <li key={change.id} className="border-b border-border-line py-8 text-small">
                  {change.createdAt.toISOString().slice(0, 16)} · {change.changeType}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
