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
    'admin.nav.crm': 'CRM & Pipeline',
    'admin.nav.units': 'Projects & Units',
    'admin.nav.projects': 'Projects',
    'admin.nav.config': 'Pricing & Config',
    'admin.nav.bookings': 'Bookings',
    'admin.nav.providers': 'Provider Vetting',
    'admin.nav.services': 'Service Submissions',
    'admin.nav.announcements': 'Announcements',
    'admin.nav.tickets': 'Tickets',
    'admin.nav.compliance': 'Compliance',
    'admin.nav.content': 'Content',
    'admin.nav.signals': 'Signals',
    'admin.nav.people': 'People & Roles',
    'admin.nav.ledger': 'Ledger',
    'admin.nav.statements': 'Statements',
    'admin.nav.payouts': 'Payouts',
    'admin.nav.reconciliation': 'Reconciliation',
    'admin.nav.claims': 'Damage claims',
    'admin.nav.disputes': 'Disputes',
    'admin.nav.audit': 'Audit trail',
    'admin.nav.integrations': 'Integrations',
    'admin.nav.back_to_site': '← Back to site',
  });

  const items = [
    { href: '/app/admin', label: labels['admin.nav.dashboard'] },
    { href: '/app/admin/crm', label: labels['admin.nav.crm'] },
    { href: '/app/admin/projects', label: labels['admin.nav.projects'] },
    { href: '/app/admin/units', label: labels['admin.nav.units'] },
    { href: '/app/admin/people', label: labels['admin.nav.people'] },
    { href: '/app/admin/config', label: labels['admin.nav.config'] },
    { href: '/app/admin/bookings', label: labels['admin.nav.bookings'] },
    { href: '/app/admin/providers', label: labels['admin.nav.providers'] },
    { href: '/app/admin/services', label: labels['admin.nav.services'] },
    { href: '/app/admin/announcements', label: labels['admin.nav.announcements'] },
    { href: '/app/admin/tickets', label: labels['admin.nav.tickets'] },
    { href: '/app/admin/compliance', label: labels['admin.nav.compliance'] },
    { href: '/app/admin/content', label: labels['admin.nav.content'] },
    { href: '/app/admin/signals', label: labels['admin.nav.signals'] },
    { href: '/app/admin/ledger', label: labels['admin.nav.ledger'] },
    { href: '/app/admin/statements', label: labels['admin.nav.statements'] },
    { href: '/app/admin/payouts', label: labels['admin.nav.payouts'] },
    // Sits outside the admin group at /admin/finance/reconciliation and was
    // therefore reachable only by typing it. Linked rather than moved: the
    // route is in use and changing it would break anyone's bookmark.
    { href: '/admin/finance/reconciliation', label: labels['admin.nav.reconciliation'] },
    { href: '/app/admin/claims', label: labels['admin.nav.claims'] },
    { href: '/app/admin/disputes', label: labels['admin.nav.disputes'] },
    { href: '/app/admin/audit', label: labels['admin.nav.audit'] },
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
