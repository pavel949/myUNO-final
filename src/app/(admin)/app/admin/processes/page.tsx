import Link from 'next/link';
import { getLabels } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { getProcessState } from './process-state';

export const dynamic = 'force-dynamic';

type Destination = { label: string; href: string };
type Process = { number: string; title: string; description: string; steps: string[]; primary: Destination; secondary?: Destination[] };

const processes: Process[] = [
  { number: '01', title: 'Identity & access', description: 'Invite people, assign responsibilities and manage access.', steps: ['Invite', 'Assign roles', 'Grant access'], primary: { label: 'People & roles', href: '/app/admin/people' }, secondary: [{ label: 'Organizations', href: '/app/admin/organizations' }] },
  { number: '02', title: 'Property onboarding', description: 'One project and inventory record, with ownership, content and commercial offers attached.', steps: ['Project', 'Categories & units', 'Ownership & content', 'Review'], primary: { label: 'Add a property', href: '/app/admin/properties/new' }, secondary: [{ label: 'All projects', href: '/app/admin/projects' }, { label: 'All units', href: '/app/admin/units' }] },
  { number: '03', title: 'Inventory & availability', description: 'Manage the physical portfolio and its sellable inventory without duplicate unit records.', steps: ['Project', 'Unit', 'Availability'], primary: { label: 'Manage units', href: '/app/admin/units' }, secondary: [{ label: 'Projects', href: '/app/admin/projects' }] },
  { number: '04', title: 'Pricing & rules', description: 'Keep rates, booking conditions and financial configuration together.', steps: ['Base rate', 'Rules', 'Quote'], primary: { label: 'Pricing & config', href: '/app/admin/config' } },
  { number: '05', title: 'Reservations', description: 'Follow enquiries and bookings through the existing booking record.', steps: ['Request', 'Confirmation', 'Payment'], primary: { label: 'Manage bookings', href: '/app/admin/bookings' } },
  { number: '06', title: 'Stay operations', description: 'Coordinate arrival, stay and departure without making a second reservation record.', steps: ['Pre-arrival', 'Check-in', 'In-house', 'Check-out'], primary: { label: 'Bookings', href: '/app/admin/bookings' }, secondary: [{ label: 'Operations & tickets', href: '/app/admin/tickets' }] },
  { number: '07', title: 'Property operations', description: 'Organize housekeeping, maintenance, incidents and checklists.', steps: ['Request', 'Assignment', 'Resolution'], primary: { label: 'Tickets', href: '/app/admin/tickets' }, secondary: [{ label: 'Checklists', href: '/app/admin/compliance-checklists' }, { label: 'Incidents', href: '/app/admin/incidents' }] },
  { number: '08', title: 'Sales & CRM', description: 'Manage prospects and property sales separately from rental reservations.', steps: ['Lead', 'Qualification', 'Deal'], primary: { label: 'CRM & pipeline', href: '/app/admin/crm' }, secondary: [{ label: 'Prospecting', href: '/app/admin/prospecting' }] },
  { number: '09', title: 'Owners', description: 'Keep contracts, statements and owner-facing records linked to the portfolio.', steps: ['Owner', 'Contract', 'Statement'], primary: { label: 'Contracts', href: '/app/admin/contracts' }, secondary: [{ label: 'Statements', href: '/app/admin/statements' }, { label: 'Owner portal', href: '/owner' }] },
  { number: '10', title: 'Partners & agents', description: 'Manage providers and booking attribution through existing surfaces.', steps: ['Partner', 'Referral', 'Attribution'], primary: { label: 'Providers', href: '/app/admin/providers' }, secondary: [{ label: 'Attribution', href: '/app/admin/reports/attribution' }] },
  { number: '11', title: 'Concierge services', description: 'Track service supply and fulfillment alongside property stays.', steps: ['Catalogue', 'Order', 'Fulfillment'], primary: { label: 'Service orders', href: '/app/admin/service-orders' }, secondary: [{ label: 'Service submissions', href: '/app/admin/services' }] },
  { number: '12', title: 'Finance & governance', description: 'Use the ledger as the financial record, with reconciliation and audit.', steps: ['Payment', 'Ledger', 'Settlement'], primary: { label: 'Ledger', href: '/app/admin/ledger' }, secondary: [{ label: 'Payouts', href: '/app/admin/payouts' }, { label: 'Audit trail', href: '/app/admin/audit' }] },
];

const lanes = [
  { title: 'Build the portfolio', description: 'Set up the physical asset once, then activate the appropriate offers.', items: processes.slice(0, 4) },
  { title: 'Run the business', description: 'Follow a guest or customer from initial request through completion.', items: processes.slice(4, 8) },
  { title: 'Connect the ecosystem', description: 'Owners, partners, services and money share the same operational context.', items: processes.slice(8) },
];

export default async function ProcessesPage() {
  // Localized heading fallbacks; process definitions are intentionally centralized here
  // instead of duplicating routes in dashboard cards and separate process pages.
  const [labels, state] = await Promise.all([getLabels({
    'admin.processes.title': 'Operations map',
    'admin.processes.kicker': 'myUNO · Operations',
    'admin.processes.add': '+ Add property',
    'admin.processes.bookings': 'Manage bookings',
    'admin.processes.finance': 'Financial overview',
    'admin.processes.model': 'One connected operating model',
    'admin.processes.model_hint': 'This map links existing workflows. It does not change booking, pricing or payment records.',
    'admin.processes.attention': 'Needs attention:',
    'admin.processes.subtitle': 'Live workflow states from your operational records. Start with an exception or continue a process.',
  }), getProcessState(prisma)]);
  return (
    <main className="mx-auto max-w-7xl space-y-24 pb-40">
      <header className="stitch-panel p-24 md:p-32">
        <p className="stitch-kicker mb-8">{labels['admin.processes.kicker']}</p>
        <h1 className="font-display text-display-xl font-semibold text-text-ink mb-8">{labels['admin.processes.title']}</h1>
        <p className="text-body text-text-secondary max-w-3xl">{labels['admin.processes.subtitle']}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 mt-24">
          <Link href="/app/admin/properties/new" className="rounded-lg bg-brand-andaman p-16 text-on-dark-text font-semibold hover:opacity-90 transition-opacity">{labels['admin.processes.add']} <span aria-hidden="true">→</span></Link>
          <Link href="/app/admin/bookings" className="rounded-lg border border-border-line p-16 font-semibold text-text-ink hover:border-brand-andaman transition-colors">{labels['admin.processes.bookings']} <span aria-hidden="true">→</span></Link>
          <Link href="/app/admin/ledger" className="rounded-lg border border-border-line p-16 font-semibold text-text-ink hover:border-brand-andaman transition-colors">{labels['admin.processes.finance']} <span aria-hidden="true">→</span></Link>
        </div>
      </header>
      <section aria-label="One source of truth" className="stitch-panel p-16 md:p-24">
        <h2 className="font-display text-title font-semibold text-text-ink mb-12">{labels['admin.processes.model']}</h2>
        <div className="flex flex-wrap items-center gap-8 text-small">
          {['One property record', 'Commercial offers', 'Availability & rates', 'One booking record', 'Operations & ledger'].map((step, i) => (
            <span key={step} className="inline-flex items-center gap-8">
              {i > 0 && <span className="text-brand-andaman" aria-hidden="true">→</span>}
              <span className="rounded-full bg-surface-ivory border border-border-line px-12 py-8 text-text-ink">{step}</span>
            </span>
          ))}
        </div>
        <p className="mt-12 text-small text-text-secondary">{labels['admin.processes.model_hint']}</p>
      </section>
      {lanes.map((lane) => (
        <section key={lane.title} aria-label={lane.title} className="space-y-16">
          <div>
            <h2 className="font-display text-title font-semibold text-text-ink">{lane.title}</h2>
            <p className="text-small text-text-secondary mt-4">{lane.description}</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            {lane.items.map((process) => (
              <article key={process.number} className="stitch-panel flex flex-col p-20 md:p-24">
                <div className="flex items-start gap-12">
                  <span className="shrink-0 rounded-md bg-surface-ivory px-12 py-8 text-small font-semibold text-brand-andaman tabular-nums">{process.number}</span>
                  <div>
                    <h3 className="font-display text-subtitle font-semibold text-text-ink">{process.title}</h3>
                    <p className="text-small text-text-secondary mt-4">{process.description}</p>
                  </div>
                </div>
                <div className="stitch-panel-soft mt-16 p-12" aria-live="polite">
                  <p className="text-small font-semibold text-text-ink">{state[process.number as keyof typeof state].summary}</p>
                  {state[process.number as keyof typeof state].attention && <p className="text-small text-state-warning mt-4">{labels['admin.processes.attention']} {state[process.number as keyof typeof state].attention}</p>}
                </div>
                <ol className="flex flex-wrap items-center gap-8 my-20 text-small text-text-secondary" aria-label={process.title + ' stages'}>
                  {process.steps.map((step, i) => <li key={step} className="flex items-center gap-8">{i > 0 && <span aria-hidden="true">→</span>}<span className="rounded-md bg-surface-ivory px-8 py-4">{step}</span></li>)}
                </ol>
                <div className="mt-auto flex flex-wrap items-center gap-x-16 gap-y-12 border-t border-border-line pt-16">
                  <Link href={process.primary.href} className="rounded-md bg-brand-andaman px-12 py-8 text-small font-semibold text-on-dark-text hover:opacity-90 transition-opacity">{process.primary.label} →</Link>
                  {process.secondary?.map((link) => <Link key={link.href} href={link.href} className="text-small text-brand-andaman underline underline-offset-4 hover:no-underline">{link.label}</Link>)}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
