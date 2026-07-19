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
    'provider.portal.title': 'Provider Portal',
    'provider.portal.nav_orders': 'Orders',
    'provider.portal.nav_services': 'My Services',
  });

  return (
    <div className="min-h-screen bg-surface-background">
      <div className="max-w-4xl mx-auto px-24 py-32">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-12 mb-24">
          <h1 className="text-heading-2 font-bold text-text-ink">
            {labels['provider.portal.title']}
          </h1>
          {isMember && (
            <nav className="flex gap-16">
              <Link
                href="/provider"
                className="text-body text-brand-andaman hover:underline"
              >
                {labels['provider.portal.nav_orders']}
              </Link>
              <Link
                href="/provider/services"
                className="text-body text-brand-andaman hover:underline"
              >
                {labels['provider.portal.nav_services']}
              </Link>
            </nav>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
