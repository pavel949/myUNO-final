import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import { AdminNavLinks } from './AdminNavLinks';

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
    'admin.nav.scheduler': 'Scheduler',
    'admin.nav.group.grow': 'Grow',
    'admin.nav.group.inventory': 'Inventory',
    'admin.nav.group.supply': 'Supply & content',
    'admin.nav.group.money': 'Money & record',
    'admin.nav.back_to_site': '← Back to site',
  });

  // Board 03 names four sections and the nineteen destinations that belong to
  // them. The product has thirty-one, so eleven have no home on the canvas:
  // attribution, prospecting, organizations, service-orders, tickets,
  // incidents, compliance, compliance-checklists, operational-kpis, scheduler
  // and signals. They are placed with the nearest named section by kind rather
  // than left loose — a destination outside every group reads as an oversight —
  // but the placement is ours, not the canvas's.
  //
  // TODO(design): confirm where those eleven belong, or whether the canvas
  // wants a fifth section for operations. Do not invent one here.
  const groups = [
    {
      label: labels['admin.nav.group.grow'],
      items: [
        { href: '/app/admin/crm', label: labels['admin.nav.crm'] },
        { href: '/app/admin/reports/attribution', label: labels['admin.nav.attribution'] },
        { href: '/app/admin/prospecting', label: labels['admin.nav.prospecting'] },
        { href: '/app/admin/signals', label: labels['admin.nav.signals'] },
      ],
    },
    {
      label: labels['admin.nav.group.inventory'],
      items: [
        { href: '/app/admin/projects', label: labels['admin.nav.projects'] },
        { href: '/app/admin/units', label: labels['admin.nav.units'] },
        { href: '/app/admin/people', label: labels['admin.nav.people'] },
        { href: '/app/admin/organizations', label: labels['admin.nav.organizations'] },
        { href: '/app/admin/bookings', label: labels['admin.nav.bookings'] },
        { href: '/app/admin/config', label: labels['admin.nav.config'] },
      ],
    },
    {
      label: labels['admin.nav.group.supply'],
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
      label: labels['admin.nav.group.money'],
      items: [
        { href: '/app/admin/ledger', label: labels['admin.nav.ledger'] },
        { href: '/app/admin/contracts', label: labels['admin.nav.contracts'] },
        { href: '/app/admin/statements', label: labels['admin.nav.statements'] },
        { href: '/app/admin/payouts', label: labels['admin.nav.payouts'] },
        { href: '/app/admin/reconciliation', label: labels['admin.nav.reconciliation'] },
        { href: '/app/admin/claims', label: labels['admin.nav.claims'] },
        { href: '/app/admin/disputes', label: labels['admin.nav.disputes'] },
        { href: '/app/admin/compliance', label: labels['admin.nav.compliance'] },
        { href: '/app/admin/compliance-checklists', label: labels['admin.nav.checklists'] },
        { href: '/app/admin/operational-kpis', label: labels['admin.nav.kpis'] },
        { href: '/app/admin/audit', label: labels['admin.nav.audit'] },
        { href: '/app/admin/integrations', label: labels['admin.nav.integrations'] },
        { href: '/app/admin/scheduler', label: labels['admin.nav.scheduler'] },
      ],
    },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-surface-ivory">
      <aside className="md:w-56 shrink-0 bg-brand-deep text-on-dark-text p-16 md:min-h-screen">
        <p className="font-display text-subtitle font-bold mb-24">{labels['admin.nav.title']}</p>
        <AdminNavLinks
          dashboard={{ href: '/app/admin', label: labels['admin.nav.dashboard'] }}
          groups={groups}
        />
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
