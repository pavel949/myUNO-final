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
    'admin.nav.attribution': 'Attribution',
    'admin.nav.prospecting': 'Prospecting',
    'admin.nav.kpis': 'Operational KPIs',
    'admin.nav.units': 'Projects & Units',
    'admin.nav.projects': 'Projects',
    'admin.nav.config': 'Pricing & Config',
    'admin.nav.bookings': 'Bookings',
    'admin.nav.service_orders': 'Service orders',
    'admin.nav.providers': 'Provider Vetting',
    'admin.nav.services': 'Service Submissions',
    'admin.nav.announcements': 'Announcements',
    'admin.nav.tickets': 'Tickets',
    'admin.nav.incidents': 'Incidents',
    'admin.nav.compliance': 'Compliance',
    'admin.nav.checklists': 'Checklists',
    'admin.nav.content': 'Content',
    'admin.nav.signals': 'Signals',
    'admin.nav.people': 'People & Roles',
    'admin.nav.organizations': 'Organizations',
    'admin.nav.ledger': 'Ledger',
    'admin.nav.contracts': 'Contracts',
    'admin.nav.statements': 'Statements',
    'admin.nav.payouts': 'Payouts',
    'admin.nav.reconciliation': 'Reconciliation',
    'admin.nav.claims': 'Damage claims',
    'admin.nav.disputes': 'Disputes',
    'admin.nav.audit': 'Audit trail',
    'admin.nav.integrations': 'Integrations',
    'admin.nav.back_to_site': '← Back to site',
    'admin.nav.group_grow': 'Grow',
    'admin.nav.group_inventory': 'Inventory',
    'admin.nav.group_supply': 'Supply & content',
    'admin.nav.group_money': 'Money & record',
  });

  const dashboardItem = { href: '/app/admin', label: labels['admin.nav.dashboard'] };

  // Four named sections (CURSOR_PROMPT phase 2 / canvas board 19) in place of
  // one flat list of destinations. The canvas named "Grow / Inventory / Supply
  // & content / Money & record" against a 20-item sidebar; the product has
  // since grown past that list, so each item added since is placed in the
  // group its subject matter is closest to, rather than inventing a fifth
  // section.
  const groups: { label: string; items: { href: string; label: string }[] }[] = [
    {
      label: labels['admin.nav.group_grow'],
      items: [
        { href: '/app/admin/crm', label: labels['admin.nav.crm'] },
        { href: '/app/admin/reports/attribution', label: labels['admin.nav.attribution'] },
        { href: '/app/admin/prospecting', label: labels['admin.nav.prospecting'] },
        { href: '/app/admin/signals', label: labels['admin.nav.signals'] },
      ],
    },
    {
      label: labels['admin.nav.group_inventory'],
      items: [
        { href: '/app/admin/projects', label: labels['admin.nav.projects'] },
        { href: '/app/admin/units', label: labels['admin.nav.units'] },
        { href: '/app/admin/people', label: labels['admin.nav.people'] },
        { href: '/app/admin/organizations', label: labels['admin.nav.organizations'] },
        { href: '/app/admin/config', label: labels['admin.nav.config'] },
        { href: '/app/admin/bookings', label: labels['admin.nav.bookings'] },
        { href: '/app/admin/operational-kpis', label: labels['admin.nav.kpis'] },
        { href: '/app/admin/tickets', label: labels['admin.nav.tickets'] },
        { href: '/app/admin/incidents', label: labels['admin.nav.incidents'] },
        { href: '/app/admin/compliance', label: labels['admin.nav.compliance'] },
        { href: '/app/admin/compliance-checklists', label: labels['admin.nav.checklists'] },
      ],
    },
    {
      label: labels['admin.nav.group_supply'],
      items: [
        { href: '/app/admin/providers', label: labels['admin.nav.providers'] },
        { href: '/app/admin/services', label: labels['admin.nav.services'] },
        { href: '/app/admin/service-orders', label: labels['admin.nav.service_orders'] },
        { href: '/app/admin/announcements', label: labels['admin.nav.announcements'] },
        { href: '/app/admin/content', label: labels['admin.nav.content'] },
      ],
    },
    {
      label: labels['admin.nav.group_money'],
      items: [
        { href: '/app/admin/ledger', label: labels['admin.nav.ledger'] },
        { href: '/app/admin/contracts', label: labels['admin.nav.contracts'] },
        { href: '/app/admin/statements', label: labels['admin.nav.statements'] },
        { href: '/app/admin/payouts', label: labels['admin.nav.payouts'] },
        // Moved inside the (admin) route group this same phase — it used to
        // render bare, with no sidebar, at /admin/finance/reconciliation.
        { href: '/app/admin/finance/reconciliation', label: labels['admin.nav.reconciliation'] },
        { href: '/app/admin/claims', label: labels['admin.nav.claims'] },
        { href: '/app/admin/disputes', label: labels['admin.nav.disputes'] },
        { href: '/app/admin/audit', label: labels['admin.nav.audit'] },
        { href: '/app/admin/integrations', label: labels['admin.nav.integrations'] },
      ],
    },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-surface-background">
      <aside className="md:w-56 shrink-0 bg-brand-deep text-on-dark-text p-16 md:min-h-screen overflow-y-auto" style={{ minWidth: '220px' }}>
        <p className="text-subtitle font-bold mb-24">{labels['admin.nav.title']}</p>
        <nav className="flex flex-col gap-8">
          <Link
            href={dashboardItem.href}
            className="block px-12 py-8 rounded-md text-small hover:bg-brand-andaman transition-colors"
          >
            {dashboardItem.label}
          </Link>
          {groups.map((group) => (
            <div key={group.label} className="pt-16">
              <p className="px-12 pb-8 text-small font-medium text-brand-sun-soft uppercase tracking-wide">
                {group.label}
              </p>
              <div className="flex flex-col gap-8">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block px-12 py-8 rounded-md text-small hover:bg-brand-andaman transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
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
