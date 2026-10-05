import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

/**
 * S13 provider portal shell (doc 06 §4, doc 08 §5). Login-gated; the
 * member nav (orders / services) only shows for identities holding an
 * active provider_member role — applicants see their status page instead.
 */
export default async function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/provider');
  }

  const isMember = user.roles.some(
    (r) => r.role === 'provider_member' && r.providerId
  );

  const labels = await getLabels({
    'provider.portal.title': 'Provider workspace',
    'provider.portal.nav_orders': 'My Orders',
    'provider.portal.nav_services': 'My Services',
    'provider.portal.nav_remittances': 'Remittances',
  });

  const navClass =
    'block rounded-xl px-12 py-8 text-small text-on-dark-text transition-colors duration-micro hover:bg-brand-andaman/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-sun';

  return (
    <div className="stitch-workspace flex min-h-screen flex-col md:flex-row">
      <aside className="shrink-0 border-b border-white/10 bg-brand-deep p-16 text-on-dark-text shadow-float md:min-h-screen md:w-64 md:border-b-0 md:border-r md:p-20">
        <p className="font-display text-subtitle font-bold">{labels['provider.portal.title']}</p>
        {isMember && (
          <nav className="mt-12 flex flex-row flex-wrap gap-4 md:mt-24 md:flex-col">
            <Link href="/provider" className={navClass}>
              {labels['provider.portal.nav_orders']}
            </Link>
            <Link href="/provider/services" className={navClass}>
              {labels['provider.portal.nav_services']}
            </Link>
            <Link href="/provider/remittances" className={navClass}>
              {labels['provider.portal.nav_remittances']}
            </Link>
          </nav>
        )}
      </aside>
      <div className="min-w-0 flex-1 p-20 md:p-32">
        <div className="mx-auto max-w-5xl">{children}</div>
      </div>
    </div>
  );
}
