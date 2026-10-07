import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import { AdminNavLinks, NavSection } from './AdminNavLinks';

export const dynamic = 'force-dynamic';

/** Stitch-aligned admin shell: compact rail, progressive disclosure, canonical routes unchanged. */
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
    'admin.nav.mobile_menu': 'Open admin navigation',
    'admin.nav.dashboard': 'Dashboard',
    'admin.nav.processes': 'Operations map',
    'admin.nav.section.grow': 'Grow',
    'admin.nav.crm': 'CRM & Pipeline',
    'admin.nav.signals': 'Signals',
    'admin.nav.attribution': 'Attribution',
    'admin.nav.prospecting': 'Prospecting',
    'admin.nav.section.inventory': 'Inventory',
    'admin.nav.projects': 'Projects',
    'admin.nav.portfolio_os': 'Managed Portfolio OS',
    'admin.projects.manage_areas': 'Manage areas',
    'admin.nav.units': 'Units',
    'admin.nav.people': 'People & Roles',
    'admin.nav.organizations': 'Organizations',
    'admin.nav.bookings': 'Bookings',
    'admin.nav.stay_calendar': 'Live stay calendar',
    'admin.nav.layantara': 'Layan Tara Villas',
    'admin.nav.config': 'Pricing & Config',
    'admin.nav.kpis': 'Operational KPIs',
    'admin.nav.compliance': 'Compliance',
    'admin.nav.checklists': 'Checklists',
    'admin.nav.section.supply_content': 'Supply & Content',
    'admin.nav.providers': 'Provider Vetting',
    'admin.nav.services': 'Service Submissions',
    'admin.nav.service_orders': 'Service orders',
    'admin.nav.announcements': 'Announcements',
    'admin.nav.content': 'Content',
    'admin.nav.tickets': 'Tickets',
    'admin.nav.incidents': 'Incidents',
    'admin.nav.section.money_record': 'Money & Record',
    'admin.nav.ledger': 'Ledger',
    'admin.nav.contracts': 'Contracts',
    'admin.nav.statements': 'Statements',
    'admin.nav.payouts': 'Payouts',
    'admin.nav.reconciliation': 'Reconciliation',
    'admin.nav.claims': 'Damage claims',
    'admin.nav.disputes': 'Disputes',
    'admin.nav.audit': 'Audit trail',
    'admin.nav.integrations': 'Integrations',
    'admin.nav.scheduler': 'Scheduler',
    'admin.nav.back_to_site': '← Back to site',
  });

  const sections: NavSection[] = [
    {
      items: [
        { href: '/app/admin', label: labels['admin.nav.dashboard'] },
        { href: '/app/admin/processes', label: labels['admin.nav.processes'] },
      ],
    },
    {
      title: labels['admin.nav.section.grow'],
      items: [
        { href: '/app/admin/crm', label: labels['admin.nav.crm'] },
        { href: '/app/admin/signals', label: labels['admin.nav.signals'] },
        { href: '/app/admin/reports/attribution', label: labels['admin.nav.attribution'] },
        { href: '/app/admin/prospecting', label: labels['admin.nav.prospecting'] },
      ],
    },
    {
      title: labels['admin.nav.section.inventory'],
      items: [
        { href: '/mc/portfolio', label: labels['admin.nav.portfolio_os'] },
        { href: '/app/admin/projects', label: labels['admin.nav.projects'] },
        { href: '/app/admin/property-submissions', label: 'Property applications' },
        { href: '/app/admin/areas', label: labels['admin.projects.manage_areas'] },
        { href: '/app/admin/units', label: labels['admin.nav.units'] },
        { href: '/app/admin/people', label: labels['admin.nav.people'] },
        { href: '/app/admin/organizations', label: labels['admin.nav.organizations'] },
        { href: '/app/admin/bookings', label: labels['admin.nav.bookings'] },
        { href: '/ops/calendar/board', label: labels['admin.nav.stay_calendar'] },
        { href: '/app/admin/layantara', label: labels['admin.nav.layantara'] },
        { href: '/app/admin/config', label: labels['admin.nav.config'] },
        { href: '/app/admin/operational-kpis', label: labels['admin.nav.kpis'] },
        { href: '/app/admin/compliance', label: labels['admin.nav.compliance'] },
        { href: '/app/admin/compliance-checklists', label: labels['admin.nav.checklists'] },
      ],
    },
    {
      title: labels['admin.nav.section.supply_content'],
      items: [
        { href: '/app/admin/providers', label: labels['admin.nav.providers'] },
        { href: '/app/admin/services', label: labels['admin.nav.services'] },
        { href: '/app/admin/service-orders', label: labels['admin.nav.service_orders'] },
        { href: '/app/admin/announcements', label: labels['admin.nav.announcements'] },
        { href: '/app/admin/content', label: labels['admin.nav.content'] },
        { href: '/app/admin/tickets', label: labels['admin.nav.tickets'] },
        { href: '/app/admin/incidents', label: labels['admin.nav.incidents'] },
      ],
    },
    {
      title: labels['admin.nav.section.money_record'],
      items: [
        { href: '/app/admin/ledger', label: labels['admin.nav.ledger'] },
        { href: '/app/admin/contracts', label: labels['admin.nav.contracts'] },
        { href: '/app/admin/statements', label: labels['admin.nav.statements'] },
        { href: '/app/admin/payouts', label: labels['admin.nav.payouts'] },
        { href: '/admin/finance/reconciliation', label: labels['admin.nav.reconciliation'] },
        { href: '/app/admin/claims', label: labels['admin.nav.claims'] },
        { href: '/app/admin/disputes', label: labels['admin.nav.disputes'] },
        { href: '/app/admin/audit', label: labels['admin.nav.audit'] },
        { href: '/app/admin/integrations', label: labels['admin.nav.integrations'] },
        { href: '/app/admin/scheduler', label: labels['admin.nav.scheduler'] },
      ],
    },
  ];

  return (
    <div className="pms-touch stitch-workspace flex min-h-screen flex-col md:flex-row">
      <aside className="sticky top-64 z-30 shrink-0 border-r border-console-border bg-console-deep text-on-dark-text shadow-float md:h-[calc(100dvh-64px)] md:w-[256px]">
        <div className="flex h-full flex-col p-12 md:p-16">
          <p className="mb-12 font-sans text-subtitle font-semibold md:mb-16">{labels['admin.nav.title']}</p>
          <details className="md:hidden">
            <summary className="cursor-pointer rounded-md border border-on-dark-muted px-12 py-12 text-small font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-sun">
              {labels['admin.nav.mobile_menu']}
            </summary>
            <div className="mt-12 max-h-[65vh] overflow-y-auto overscroll-contain pb-12">
              <AdminNavLinks sections={sections} />
            </div>
          </details>
          <div className="hidden min-h-0 flex-1 overflow-y-auto overscroll-contain pr-4 md:block">
            <AdminNavLinks sections={sections} />
          </div>
          <p className="mt-12 hidden shrink-0 border-t border-white/10 pt-12 md:block">
            <Link href="/" className="text-small text-on-dark-muted hover:text-on-dark-text hover:underline">
              {labels['admin.nav.back_to_site']}
            </Link>
          </p>
        </div>
      </aside>
      <div className="min-w-0 flex-1 bg-surface-mint p-20 md:p-32">
        <div className="stitch-admin-content mx-auto w-full max-w-[1500px]">{children}</div>
      </div>
    </div>
  );
}
