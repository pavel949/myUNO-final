import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

/**
 * The orders a person has placed (doc 08 §5, `/app/orders`).
 *
 * Order *detail* existed and the list did not, so an order was reachable only
 * if you still had the link from the moment you placed it — close the tab and
 * the cleaner you booked for Thursday was gone. This is the list that was
 * missing, and it is now in the main menu for everyone.
 */

/** Anything still going to happen, so it can be shown first. */
const LIVE_STATUSES = new Set(['placed', 'paid', 'accepted']);

export default async function ServiceOrdersPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/services/orders');
  }

  const orders = await prisma.serviceOrder.findMany({
    where: { orderer_identity_id: user.identityId },
    select: {
      id: true,
      status: true,
      scheduled_start: true,
      total_thb: true,
      service: { select: { title: true } },
      provider: { select: { name: true } },
    },
    orderBy: { scheduled_start: 'desc' },
    take: 100,
  });

  const labels = await getLabels({
    'orders.title': 'My orders',
    'orders.subtitle': 'Services you have ordered — upcoming first, then everything past.',
    'orders.empty': 'You have not ordered anything yet.',
    'orders.browse': 'Browse services',
    'orders.upcoming': 'Coming up',
    'orders.past': 'Past',
    'orders.when': 'When',
    'orders.provider': 'Provider',
    'orders.total': 'Total',
    'orders.status.placed': 'Placed',
    'orders.status.paid': 'Paid',
    'orders.status.accepted': 'Accepted',
    'orders.status.declined': 'Declined',
    'orders.status.expired': 'Expired',
    'orders.status.fulfilled': 'Completed',
    'orders.status.cancelled': 'Cancelled',
  });

  const baht = (satang: number) =>
    `฿${(satang / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const live = orders.filter((o) => LIVE_STATUSES.has(o.status));
  const past = orders.filter((o) => !LIVE_STATUSES.has(o.status));

  const statusLabel = (status: string) =>
    (labels as Record<string, string>)[`orders.status.${status}`] ?? status;

  const section = (title: string, list: typeof orders) =>
    list.length === 0 ? null : (
      <section className="mb-32">
        <h2 className="text-heading-3 font-semibold text-text-ink mb-12">{title}</h2>
        <ul className="flex flex-col gap-12">
          {list.map((order) => (
            <li key={order.id}>
              <Link
                href={`/services/orders/${order.id}`}
                className="block p-16 bg-surface-paper border border-border-line rounded-lg hover:border-brand-andaman transition-colors"
              >
                <div className="flex flex-wrap items-baseline gap-8 mb-4">
                  <p className="text-body font-semibold text-text-ink">{order.service.title}</p>
                  <span className="px-8 py-4 bg-brand-andaman/10 text-brand-andaman rounded text-small font-semibold">
                    {statusLabel(order.status)}
                  </span>
                </div>
                <p className="text-small text-text-secondary">
                  {`${labels['orders.when']}: ${order.scheduled_start.toLocaleString('sv-SE')} · ${
                    labels['orders.provider']
                  }: ${order.provider?.name ?? '—'} · ${labels['orders.total']}: ${baht(
                    order.total_thb
                  )}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );

  return (
    <main className="min-h-screen bg-surface-background p-24 md:p-32">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-heading-1 font-bold text-text-ink mb-8">{labels['orders.title']}</h1>
        <p className="text-body text-text-secondary mb-24">{labels['orders.subtitle']}</p>

        {orders.length === 0 ? (
          <div className="p-24 bg-surface-paper border border-border-line rounded-lg text-center">
            <p className="text-body text-text-secondary mb-16">{labels['orders.empty']}</p>
            <Link href="/services" className="text-brand-andaman font-semibold hover:underline">
              {labels['orders.browse']}
            </Link>
          </div>
        ) : (
          <>
            {section(labels['orders.upcoming'], live)}
            {section(labels['orders.past'], past)}
          </>
        )}
      </div>
    </main>
  );
}
