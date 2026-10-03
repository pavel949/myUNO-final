import { listAgentWorkspaces } from '@/modules/agents';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { RoleType } from '@prisma/client';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getActiveStayId } from '@/app/actions/getActiveStay';
import { getLabels } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { availableSurfaces } from '@/modules/core';
import { getOwnerPortfolioShape, singleOwnerUnitId } from '@/modules/projects';

export const dynamic = 'force-dynamic';

const reasonLabelKey = {
  active_stay: 'myuno.context.stay',
  admin: 'myuno.context.admin',
  agent: 'nav.agent_portal',
  staff: 'myuno.context.operations',
  management_company: 'myuno.context.portfolio',
  juristic: 'myuno.context.residence',
  provider: 'myuno.context.provider',
  owner: 'myuno.context.owner',
  resident: 'myuno.context.resident',
  buyer: 'myuno.context.buying',
  guest: 'myuno.context.trips',
  public: 'myuno.context.explore',
} as const;

export default async function MyUnoPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/app');

  const activeBookingId = await getActiveStayId();
  const isOwner = user.roles.some((role) => role.role === 'owner');
  let ownerUnitId: string | null = null;

  if (isOwner) {
    const shape = await getOwnerPortfolioShape(prisma, user.identityId);
    if (!shape.isPortfolio) {
      const units = await prisma.unit.findMany({
        where: { ownerIdentityId: user.identityId },
        select: { id: true },
        orderBy: { name: 'asc' },
        take: 2,
      });
      ownerUnitId = singleOwnerUnitId(shape, units);
    }
  }

  const surfaces = availableSurfaces({
    isAdmin: user.isAdmin,
    hasAgentWorkspace: (await listAgentWorkspaces(prisma,user.identityId)).length > 0,
    roles: user.roles.map((role) => role.role as RoleType),
    activeBookingId,
    ownerUnitId,
  });

  const labels = await getLabels({
    'myuno.kicker': 'MY UNO',
    'nav.agent_portal': 'Agent HomeSpace',
    'myuno.title': 'Everything connected to you.',
    'myuno.subtitle': 'Trips, homes, orders, ownership and work in one relationship hub. Only the parts relevant to you are shown.',
    'myuno.continue': 'Continue',
    'myuno.personal.title': 'Personal',
    'myuno.personal.trips': 'Trips',
    'myuno.personal.trips_body': 'Upcoming and previous stays, arrival details and Home Space.',
    'myuno.personal.saved': 'Saved',
    'myuno.personal.saved_body': 'Homes and searches you want to return to.',
    'myuno.personal.orders': 'Orders',
    'myuno.personal.orders_body': 'Services, payments and fulfilment status.',
    'myuno.personal.messages': 'Messages',
    'myuno.personal.messages_body': 'Conversations connected to stays, homes, orders and support.',
    'myuno.property.title': 'Property',
    'myuno.property.homes': 'My homes',
    'myuno.property.homes_body': 'Ownership, bookings, condition, money, documents and decisions.',
    'myuno.property.listings': 'List or manage a property',
    'myuno.property.listings_body': 'Continue a submission or connect another property.',
    'myuno.context.title': 'Your workspaces',
    'myuno.context.stay': 'My stay',
    'myuno.context.admin': 'Control plane',
    'myuno.context.operations': 'Operations',
    'myuno.context.portfolio': 'Managed portfolio',
    'myuno.context.residence': 'Residence',
    'myuno.context.provider': 'Provider workspace',
    'myuno.context.owner': 'Owner workspace',
    'myuno.context.resident': 'Resident workspace',
    'myuno.context.buying': 'Buying',
    'myuno.context.trips': 'Trips',
    'myuno.context.explore': 'Explore',
    'myuno.discover.title': 'What do you want to do next?',
    'myuno.discover.stay': 'Find a stay',
    'myuno.discover.buy': 'Buy a home',
    'myuno.discover.own': 'Own a property',
    'myuno.discover.services': 'Book a service',
  });

  const personal = [
    { href: '/trips', title: labels['myuno.personal.trips'], body: labels['myuno.personal.trips_body'] },
    { href: '/saved', title: labels['myuno.personal.saved'], body: labels['myuno.personal.saved_body'] },
    { href: '/services/orders', title: labels['myuno.personal.orders'], body: labels['myuno.personal.orders_body'] },
    { href: '/messages', title: labels['myuno.personal.messages'], body: labels['myuno.personal.messages_body'] },
  ];

  return (
    <main className="min-h-screen bg-surface-ivory">
      <section className="border-b border-border-line bg-surface-paper">
        <div className="mx-auto max-w-7xl px-20 py-48 md:px-32 md:py-64">
          <p className="text-kicker font-semibold uppercase tracking-[0.18em] text-brand-andaman">
            {labels['myuno.kicker']}
          </p>
          <h1 className="mt-12 max-w-4xl font-display text-display-xl font-semibold text-text-ink">
            {labels['myuno.title']}
          </h1>
          <p className="mt-12 max-w-3xl text-body text-text-secondary">
            {labels['myuno.subtitle']}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-56 px-20 py-48 md:px-32 md:py-64">
        {surfaces.length ? (
          <section>
            <h2 className="font-display text-heading-2 font-semibold text-text-ink">
              {labels['myuno.context.title']}
            </h2>
            <div className="mt-20 grid gap-12 md:grid-cols-2 lg:grid-cols-3">
              {surfaces.map((surface) => (
                <Link
                  key={surface.path}
                  href={surface.path}
                  className="group rounded-2xl border border-border-line bg-surface-paper p-20 transition hover:border-brand-andaman/40 hover:shadow-card"
                >
                  <p className="font-display text-title font-semibold text-text-ink">
                    {labels[reasonLabelKey[surface.reason]]}
                  </p>
                  <p className="mt-12 text-small font-semibold text-brand-andaman">
                    {labels['myuno.continue']} →
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <h2 className="font-display text-heading-2 font-semibold text-text-ink">
            {labels['myuno.personal.title']}
          </h2>
          <div className="mt-20 grid gap-12 md:grid-cols-2 lg:grid-cols-4">
            {personal.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-2xl border border-border-line bg-surface-paper p-20">
                <h3 className="font-display text-title font-semibold text-text-ink">{item.title}</h3>
                <p className="mt-8 text-small leading-relaxed text-text-secondary">{item.body}</p>
              </Link>
            ))}
          </div>
        </section>

        {isOwner ? (
          <section>
            <h2 className="font-display text-heading-2 font-semibold text-text-ink">
              {labels['myuno.property.title']}
            </h2>
            <div className="mt-20 grid gap-12 md:grid-cols-2">
              <Link href="/owner" className="rounded-2xl border border-border-line bg-surface-paper p-24">
                <h3 className="font-display text-title font-semibold text-text-ink">{labels['myuno.property.homes']}</h3>
                <p className="mt-8 text-body text-text-secondary">{labels['myuno.property.homes_body']}</p>
              </Link>
              <Link href="/property/listings" className="rounded-2xl border border-border-line bg-surface-paper p-24">
                <h3 className="font-display text-title font-semibold text-text-ink">{labels['myuno.property.listings']}</h3>
                <p className="mt-8 text-body text-text-secondary">{labels['myuno.property.listings_body']}</p>
              </Link>
            </div>
          </section>
        ) : null}

        <section>
          <h2 className="font-display text-heading-2 font-semibold text-text-ink">
            {labels['myuno.discover.title']}
          </h2>
          <div className="mt-20 flex flex-wrap gap-12">
            <Link href="/search" className="rounded-full bg-brand-andaman px-20 py-12 font-semibold text-white">{labels['myuno.discover.stay']}</Link>
            <Link href="/homes?intent=buy" className="rounded-full border border-border-line bg-surface-paper px-20 py-12 font-semibold text-text-ink">{labels['myuno.discover.buy']}</Link>
            <Link href="/owners" className="rounded-full border border-border-line bg-surface-paper px-20 py-12 font-semibold text-text-ink">{labels['myuno.discover.own']}</Link>
            <Link href="/services" className="rounded-full border border-border-line bg-surface-paper px-20 py-12 font-semibold text-text-ink">{labels['myuno.discover.services']}</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
