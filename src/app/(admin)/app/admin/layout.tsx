import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

/** S14 admin shell: deep sidebar, admin-gated (doc 06 §S14, doc 08 §6). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/app/admin');
  }
  if (!user.isAdmin) {
    redirect('/');
  }

  const labels = await getLabels({
    'admin.nav.title': 'myUNO Admin',
    'admin.nav.dashboard': 'Dashboard',
    'admin.nav.units': 'Projects & Units',
    'admin.nav.bookings': 'Bookings',
    'admin.nav.providers': 'Provider Vetting',
    'admin.nav.services': 'Service Submissions',
    'admin.nav.content': 'Content',
    'admin.nav.signals': 'Signals',
    'admin.nav.integrations': 'Integrations',
    'admin.nav.back_to_site': '← Back to site',
  });

  const items = [
    { href: '/app/admin', label: labels['admin.nav.dashboard'] },
    { href: '/app/admin/units', label: labels['admin.nav.units'] },
    { href: '/app/admin/bookings', label: labels['admin.nav.bookings'] },
    { href: '/app/admin/providers', label: labels['admin.nav.providers'] },
    { href: '/app/admin/services', label: labels['admin.nav.services'] },
    { href: '/app/admin/content', label: labels['admin.nav.content'] },
    { href: '/app/admin/signals', label: labels['admin.nav.signals'] },
    { href: '/app/admin/integrations', label: labels['admin.nav.integrations'] },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-surface-background">
      <aside className="md:w-56 shrink-0 bg-brand-deep text-on-dark-text p-16 md:min-h-screen" style={{ minWidth: '220px' }}>
        <p className="text-subtitle font-bold mb-24">{labels['admin.nav.title']}</p>
        <nav className="flex md:flex-col gap-8 flex-wrap">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-12 py-8 rounded-md text-small hover:bg-brand-andaman transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <p className="mt-24">
          <Link href="/" className="text-small text-on-dark-muted hover:underline">
            {labels['admin.nav.back_to_site']}
          </Link>
        </p>
      </aside>
      <div className="flex-1 p-24">{children}</div>
    </div>
  );
}
