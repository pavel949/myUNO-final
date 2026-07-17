import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import BookingsAdminClient from './bookings-client';

export const dynamic = 'force-dynamic';

export default async function AdminBookingsPage() {
  const bookings = await prisma.booking.findMany({
    include: {
      unit: { select: { name: true } },
      guestIdentity: { select: { firstName: true, lastName: true } },
      payments: {
        where: { status: 'succeeded', purpose: 'stay' },
        select: { id: true, method: true, receiptRef: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const labels = await getLabels({
    'admin.bookings.title': 'Bookings',
    'admin.bookings.empty': 'No bookings yet.',
    'admin.bookings.paid': 'Paid',
    'admin.bookings.record_cash': 'Record cash',
    'admin.bookings.receipt_placeholder': 'Receipt / чек №',
    'admin.bookings.cancel': 'Cancel',
    'admin.bookings.approve': 'Approve request',
    'admin.bookings.decline': 'Decline request',
    'admin.bookings.cancel_confirm': 'Cancel this booking (policy refund applies)?',
    'admin.bookings.error_generic': 'Action failed. Please try again.',
  });

  return (
    <div>
      <h1 className="text-heading-1 font-bold text-text-ink mb-24">
        {labels['admin.bookings.title']}
      </h1>
      <BookingsAdminClient
        bookings={bookings.map((b) => ({
          id: b.id,
          status: b.status,
          startDate: b.startDate.toISOString(),
          endDate: b.endDate.toISOString(),
          totalThb: b.totalThb,
          unitName: b.unit?.name || '—',
          guestName: b.guestIdentity
            ? `${b.guestIdentity.firstName} ${b.guestIdentity.lastName}`
            : '—',
          paid: b.payments.length > 0,
          receiptRef: b.payments[0]?.receiptRef || null,
        }))}
        labels={labels}
      />
    </div>
  );
}
