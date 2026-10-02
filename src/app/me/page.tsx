import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { RoleType } from '@prisma/client';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getActiveStayId } from '@/app/actions/getActiveStay';
import { availableSurfaces, resolveLanding } from '@/modules/core';
import { getOwnerPortfolioShape, singleOwnerUnitId } from '@/modules/projects';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { EmptyState } from '@/components/premium/PremiumPrimitives';

export const dynamic = 'force-dynamic';

export default async function MyUnoHubPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/me');
  }

  const activeBookingId = await getActiveStayId();
  const isOwner = user.roles.some((r) => r.role === 'owner');
  let ownerUnitId: string | null = null;
  if (isOwner) {
    const shape = await getOwnerPortfolioShape(prisma, user.identityId);
    if (!shape.isPortfolio) {
      const unit = await prisma.unit.findFirst({
        where: { ownerIdentityId: user.identityId },
        select: { id: true },
        orderBy: { name: 'asc' },
      });
      ownerUnitId = singleOwnerUnitId(shape, unit ? [unit] : []);
    }
  }

  const context = {
    isAdmin: user.isAdmin,
    roles: user.roles.map((r) => r.role as RoleType),
    activeBookingId,
    ownerUnitId,
  };
  const landing = resolveLanding(context);
  const workspaces = availableSurfaces(context);

  const labels = await getLabels({
    'me.kicker': 'MY MYUNO',
    'me.title': 'Your myUNO',
    'me.body': 'Only the workspaces that belong to this account are listed.',
    'me.continue': 'Continue to your primary workspace',
    'me.personal': 'Personal',
    'me.work': 'Workspaces',
    'me.empty_work': 'No operating workspace is attached to this account yet.',
    'nav.my_trips': 'My trips',
    'nav.saved': 'Saved',
    'nav.orders': 'My orders',
    'nav.messages': 'Messages',
    'nav.tickets': 'My requests',
    'nav.account': 'Account',
    'nav.my_listings': 'My listings',
    'nav.stay': 'My stay',
    'nav.admin': 'Admin',
    'nav.ops': 'Ops',
    'nav.mc_portal': 'MC portal',
    'nav.juristic_portal': 'Juristic portal',
    'nav.provider_portal': 'Provider portal',
    'nav.owner_dashboard': 'Owner dashboard',
    'nav.residence': 'My residence',
    'nav.buying': 'Buying',
    'nav.find_stay': 'Find a stay',
  });

  const personal = [
    { href: '/trips', label: labels['nav.my_trips'] },
    { href: '/saved', label: labels['nav.saved'] },
    { href: '/services/orders', label: labels['nav.orders'] },
    { href: '/messages', label: labels['nav.messages'] },
    { href: '/tickets', label: labels['nav.tickets'] },
    { href: '/property/listings', label: labels['nav.my_listings'] },
    { href: '/account', label: labels['nav.account'] },
  ];

  const workspaceLabel: Record<string, string> = {
    active_stay: labels['nav.stay'],
    admin: labels['nav.admin'],
    staff: labels['nav.ops'],
    management_company: labels['nav.mc_portal'],
    juristic: labels['nav.juristic_portal'],
    provider: labels['nav.provider_portal'],
    owner: labels['nav.owner_dashboard'],
    resident: labels['nav.residence'],
    buyer: labels['nav.buying'],
    guest: labels['nav.my_trips'],
    public: labels['nav.find_stay'],
  };

  return (
    <main className="min-h-screen bg-surface-ivory">
      <section className="mx-auto max-w-content px-20 py-56 md:px-32">
        <p className="text-kicker uppercase text-brand-andaman">{labels['me.kicker']}</p>
        <h1 className="mt-12 font-display text-display-xl font-semibold text-text-ink">{labels['me.title']}</h1>
        <p className="mt-12 max-w-2xl text-body text-text-secondary">{labels['me.body']}</p>
        <Link
          href={landing.path}
          className="mt-24 inline-flex min-h-44 items-center rounded-lg bg-brand-andaman px-24 py-12 font-semibold text-surface-ivory"
        >
          {labels['me.continue']} →
        </Link>

        <h2 className="mt-48 font-display text-heading-2 font-semibold text-text-ink">{labels['me.personal']}</h2>
        <ul className="mt-16 grid gap-12 md:grid-cols-2">
          {personal.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex min-h-64 items-center rounded-xl border border-border-line bg-surface-paper px-20 py-16 font-semibold text-brand-andaman"
              >
                {item.label} →
              </Link>
            </li>
          ))}
        </ul>

        <h2 className="mt-48 font-display text-heading-2 font-semibold text-text-ink">{labels['me.work']}</h2>
        {workspaces.length ? (
          <ul className="mt-16 grid gap-12 md:grid-cols-2">
            {workspaces.map((surface) => (
              <li key={`${surface.reason}:${surface.path}`}>
                <Link
                  href={surface.path}
                  className="flex min-h-64 items-center rounded-xl border border-border-line bg-surface-paper px-20 py-16 font-semibold text-brand-andaman"
                >
                  {workspaceLabel[surface.reason]} →
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-16">
            <EmptyState title={labels['me.empty_work']} />
          </div>
        )}
      </section>
    </main>
  );
}
