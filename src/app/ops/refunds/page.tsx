import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { formatDate } from '@/lib/date';
import { getRequestLocale } from '@/lib/i18n';
import { resolveOpsProjectContext } from '@/app/libs/opsProjectContext';
import RefundsClient from './refunds-client';

export const dynamic = 'force-dynamic';

/**
 * Refunds waiting to be handed back (cash / bank transfer). Cancellation
 * creates them as `requested`; staff settle them here once the money is paid.
 */
export default async function OpsRefundsPage() {
  const user = await getCurrentUser();
  if (!user?.identityId) redirect('/login?next=/ops/refunds');
  const context = resolveOpsProjectContext(user, null);
  if (!context.isAdmin && context.staffProjectIds.length === 0) redirect('/');

  const refunds = await prisma.refund.findMany({
    where: {
      status: 'requested',
      payment: {
        method: { not: 'card_provider' },
        ...(context.queryProjectIds ? { booking: { projectId: { in: context.queryProjectIds } } } : {}),
      },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      amountThb: true,
      createdAt: true,
      payment: {
        select: {
          method: true,
          receiptRef: true,
          booking: {
            select: {
              unit: { select: { name: true } },
              guestIdentity: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });

  const locale = getRequestLocale();
  const labels = await getLabels({
    'staff.refunds.title': 'Refunds to pay back',
    'staff.refunds.hint': 'Cancelled stays paid in cash or by transfer. Hand the money back, then mark it paid so the books and the guest see it.',
    'staff.refunds.empty': 'No refunds are waiting.',
    'staff.refunds.mark_paid': 'Mark refund paid',
    'staff.refunds.confirm': 'Confirm ฿{amount} was paid back to the guest',
    'staff.refunds.error': 'Could not record the refund. Please try again.',
    'staff.refunds.original_receipt': 'Original receipt',
  });

  return (
    <main className="stitch-workspace p-20 md:p-32">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 font-display text-display-xl font-semibold text-text-ink">{labels['staff.refunds.title']}</h1>
        <p className="mb-24 text-body text-text-secondary">{labels['staff.refunds.hint']}</p>
        <RefundsClient
          labels={labels}
          refunds={refunds.map((refund) => ({
            id: refund.id,
            amountThb: Math.round(refund.amountThb / 100),
            createdAt: formatDate(refund.createdAt, locale),
            method: refund.payment.method,
            receiptRef: refund.payment.receiptRef,
            unitName: refund.payment.booking?.unit?.name ?? '—',
            guestName: refund.payment.booking?.guestIdentity
              ? `${refund.payment.booking.guestIdentity.firstName} ${refund.payment.booking.guestIdentity.lastName}`
              : '—',
          }))}
        />
      </div>
    </main>
  );
}
