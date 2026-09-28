/* eslint-disable local-rules/no-literal-ui-text -- operational diagnostic labels; localization is handled in a separate content pass */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const stages = [
  { label: 'Request / reservation', statuses: ['requested', 'pending_payment', 'confirmed', 'checked_in', 'checked_out', 'completed'] },
  { label: 'Payment confirmed', statuses: ['confirmed', 'checked_in', 'checked_out', 'completed'] },
  { label: 'Pre-arrival / confirmed', statuses: ['confirmed', 'checked_in', 'checked_out', 'completed'] },
  { label: 'Check-in', statuses: ['checked_in', 'checked_out', 'completed'] },
  { label: 'Check-out', statuses: ['checked_out', 'completed'] },
  { label: 'Stay completed', statuses: ['completed'] },
];

const money = (satang: number) => (satang / 100).toLocaleString('en-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function BookingJourneyPage({ params }: { params: { id: string } }) {
  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    select: {
      id: true, status: true, startDate: true, endDate: true, totalThb: true,
      balanceDueThb: true, refundAccruedThb: true, checkedInAt: true, checkedOutAt: true,
      project: { select: { id: true, name: true } },
      unit: { select: { id: true, name: true } },
      payments: {
        select: {
          id: true, purpose: true, method: true, status: true, amountThb: true,
          receiptRef: true, succeededAt: true,
          refunds: { select: { id: true, amountThb: true, status: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      ledgerEntries: {
        select: { id: true, entryType: true, amountThb: true, paymentId: true, refundId: true },
      },
      statementLines: {
        select: {
          id: true, category: true, amountTh: true,
          statement: { select: { id: true, status: true, periodStart: true, periodEnd: true } },
        },
      },
      depositPreauth: { select: { status: true, amountThb: true } },
      depositClaims: { select: { id: true, status: true, claimedAmountThb: true } },
    },
  });
  if (!booking) notFound();

  const received = booking.payments
    .filter(p => p.status === 'succeeded' && (p.purpose === 'stay' || p.purpose === 'stay_balance'))
    .reduce((sum, p) => sum + p.amountThb, 0);
  const revenueLedger = booking.ledgerEntries
    .filter(e => e.entryType === 'rental_revenue')
    .reduce((sum, e) => sum + e.amountThb, 0);
  const missingLedger = booking.payments.filter(p =>
    p.status === 'succeeded' &&
    (p.purpose === 'stay' || p.purpose === 'stay_balance') &&
    !booking.ledgerEntries.some(e => e.paymentId === p.id && e.entryType === 'rental_revenue')
  );
  const statements = [...new Map(booking.statementLines.map(line => [line.statement.id, line.statement])).values()];
  const outstandingRefunds = booking.payments.flatMap(p => p.refunds)
    .filter(r => r.status === 'requested' || r.status === 'processing');
  const isCancelled = ['cancelled', 'declined', 'expired'].includes(booking.status);
  const cashReconciled = received === revenueLedger && missingLedger.length === 0 && (booking.totalThb === 0 || received > 0);
  const stayClosed = booking.status === 'completed';
  const ownerRecorded = statements.length > 0;
  const ownerDistributed = statements.some(s => s.status === 'distributed');
  const checks = [
    { name: 'Payment / ledger reconciliation', good: cashReconciled, description: cashReconciled ? 'Successful rental receipts match the rental ledger.' : 'Payment and ledger need reconciliation.' },
    { name: 'Outstanding guest balance', good: booking.balanceDueThb === 0, description: `฿${money(booking.balanceDueThb)} outstanding` },
    { name: 'Refund obligations', good: booking.refundAccruedThb === 0 && outstandingRefunds.length === 0, description: `฿${money(booking.refundAccruedThb)} liability · ${outstandingRefunds.length} in flight` },
    { name: 'Stay operationally closed', good: stayClosed, description: `Booking status: ${booking.status.replace(/_/g, ' ')}` },
    { name: 'Owner statement', good: ownerRecorded, description: ownerRecorded ? `${statements.length} statement(s) linked` : 'No statement line linked yet.' },
    { name: 'Owner distribution', good: ownerDistributed, description: ownerDistributed ? 'A linked statement is distributed.' : 'Not distributed.' },
  ];
  return (
    <main className="max-w-6xl space-y-24 pb-40">
      <header className="rounded-xl border border-border-line bg-surface-paper p-24">
        <Link href="/app/admin/bookings" className="text-small text-brand-andaman underline">← All bookings</Link>
        <p className="text-kicker uppercase text-brand-andaman mt-16 mb-4">Canonical booking journey</p>
        <h1 className="font-display text-display-xl font-semibold text-text-ink">{booking.unit.name}</h1>
        <p className="text-text-secondary mt-4">{booking.project.name} · {booking.startDate.toISOString().slice(0, 10)} — {booking.endDate.toISOString().slice(0, 10)}</p>
        <p className="text-small text-text-secondary mt-8">Booking {booking.id} · {booking.status.replace(/_/g, ' ')}</p>
        <div className="flex flex-wrap gap-12 mt-16">
          <Link href={`/app/admin/units/${booking.unit.id}`} className="text-small text-brand-andaman underline">Physical home</Link>
          <Link href="/ops" className="text-small text-brand-andaman underline">Stay operations</Link>
          <Link href="/app/admin/ledger" className="text-small text-brand-andaman underline">Ledger</Link>
          <Link href="/app/admin/statements" className="text-small text-brand-andaman underline">Owner statements</Link>
        </div>
      </header>
      <section className="rounded-xl border border-border-line bg-surface-paper p-24">
        <h2 className="font-display text-title font-semibold text-text-ink mb-16">One booking · one lifecycle</h2>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">
          {stages.map((stage, i) => {
            const reached = stage.label === 'Payment confirmed' ? received > 0 : stage.statuses.includes(booking.status);
            return <li key={stage.label} className="rounded-lg border border-border-line p-16">
              <span className="text-kicker text-brand-andaman">{String(i + 1).padStart(2, '0')}</span>
              <p className="font-semibold text-text-ink mt-4">{stage.label}</p>
              <p className={reached ? 'text-small text-state-success mt-4' : 'text-small text-text-secondary mt-4'}>
                {isCancelled ? 'Stopped' : reached ? 'Reached' : 'Not reached'}
              </p>
            </li>;
          })}
        </ol>
        <p className="text-small text-text-secondary mt-16">Stages reflect the existing Booking status. Actions remain in the booking and operations screens; this view does not create another reservation.</p>
      </section>
      <section className="rounded-xl border border-border-line bg-surface-paper p-24">
        <h2 className="font-display text-title font-semibold text-text-ink mb-16">Financial closure</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 mb-20">
          <div className="rounded-lg bg-surface-ivory p-16"><p className="text-small text-text-secondary">Booking total</p><p className="font-display text-title font-semibold">฿{money(booking.totalThb)}</p></div>
          <div className="rounded-lg bg-surface-ivory p-16"><p className="text-small text-text-secondary">Successful rental receipts</p><p className="font-display text-title font-semibold">฿{money(received)}</p></div>
          <div className="rounded-lg bg-surface-ivory p-16"><p className="text-small text-text-secondary">Rental ledger</p><p className="font-display text-title font-semibold">฿{money(revenueLedger)}</p></div>
        </div>
        <div className="space-y-8">
          {checks.map(check => <div key={check.name} className="flex items-start gap-12 border-b border-border-line pb-8">
            <span className={check.good ? 'text-state-success font-semibold' : 'text-state-warning font-semibold'} aria-label={check.good ? 'Complete' : 'Needs review'}>{check.good ? '✓' : '!'}</span>
            <div><p className="font-semibold text-text-ink">{check.name}</p><p className="text-small text-text-secondary">{check.description}</p></div>
          </div>)}
        </div>
        <p className="text-small text-text-secondary mt-16">Operational completion and financial distribution are different milestones. A checked-out stay is not automatically financially closed.</p>
      </section>
      <section className="rounded-xl border border-border-line bg-surface-paper p-24">
        <h2 className="font-display text-title font-semibold text-text-ink mb-12">Linked evidence</h2>
        <p className="text-small text-text-secondary">{booking.payments.length} payments · {booking.ledgerEntries.length} ledger entries · {booking.depositClaims.length} deposit claims · {statements.length} owner statements</p>
        {booking.depositPreauth && <p className="text-small mt-8">Deposit authorization: {booking.depositPreauth.status} · ฿{money(booking.depositPreauth.amountThb)}</p>}
        {statements.map(statement => <p key={statement.id} className="text-small mt-8">Statement {statement.periodStart.toISOString().slice(0, 10)} — {statement.periodEnd.toISOString().slice(0, 10)} · {statement.status}</p>)}
      </section>
    </main>
  );
}
