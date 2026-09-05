'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Input } from '@/components/Input';
import BookingRequestRespondActions, {
  type DeclineReasonOption,
} from '@/components/booking/BookingRequestRespondActions';
import BookingRequestInboxDetails from '@/components/booking/BookingRequestInboxDetails';
import type { BookingRequestBreakdownLine } from '@/modules/booking';
import ArrivalPassportCaptureModal from '@/components/ops/ArrivalPassportCaptureModal';
import CheckInConditionReportModal from '@/components/ops/CheckInConditionReportModal';
import CheckOutConditionReportModal from '@/components/ops/CheckOutConditionReportModal';

interface OpsBooking {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  totalThb: number;
  party: number;
  verificationStatus: string | null;
  unitId: string | null;
  unitName: string;
  guestName: string;
  paid: boolean;
  requestExpiresAt: string | null;
}

interface OpsRequestBooking {
  id: string;
  startDate: string;
  endDate: string;
  totalThb: number;
  party: number;
  unitId: string;
  unitName: string;
  guestName: string;
  requestExpiresAt: string | null;
  nights: number;
  completedStayCount: number;
  breakdownLines: BookingRequestBreakdownLine[];
}

interface OpsServiceOrder {
  id: string;
  scheduledStart: string;
  totalThb: number;
  serviceTitle: string;
  ordererName: string;
}

interface OpsTicket {
  id: string;
  title: string;
  status: string;
  priority: string;
  slaDueAt: string | null;
  unitId: string | null;
  unitName: string;
  raisedByName: string;
  assigneeIdentityId: string | null;
  assigneeName: string | null;
}

type Labels = Record<string, string>;

function fill(template: string, params: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

function ticketNextStatus(status: string): string | null {
  if (status === 'open') return 'acknowledged';
  if (status === 'acknowledged') return 'in_progress';
  if (status === 'waiting_reporter') return 'in_progress';
  return null;
}

function ticketStatusLabel(status: string, labels: Labels): string {
  return labels[`tickets.status.${status}`] || status;
}

function ticketChipStatus(
  status: string
): 'requested' | 'checked_in' | 'confirmed' | 'closed' | 'default' {
  switch (status) {
    case 'open':
    case 'waiting_reporter':
      return 'requested';
    case 'acknowledged':
    case 'in_progress':
      return 'checked_in';
    case 'resolved':
      return 'confirmed';
    case 'closed':
    case 'cancelled':
      return 'closed';
    default:
      return 'default';
  }
}

const paidChip = 'confirmed' as const;
const unpaidChip = 'pending_payment' as const;
const verifiedChip = 'confirmed' as const;
const notVerifiedChip = 'requested' as const;
const chipStatusVariant = 'status' as const;

interface OpsMobilizationUnit {
  id: string;
  name: string;
  status: string;
  projectId: string;
  projectName: string;
  completedSteps: number;
  totalSteps: number;
  nextStep: string | null;
}

export default function OpsBoardClient({
  viewerIdentityId,
  activeProjectId,
  mobilizationUnits,
  arrivals,
  departures,
  pendingRequests,
  pendingPayment,
  pendingServiceOrders,
  openTickets,
  declineReasons,
  labels,
}: {
  viewerIdentityId: string;
  activeProjectId: string | null;
  mobilizationUnits: OpsMobilizationUnit[];
  arrivals: OpsBooking[];
  departures: OpsBooking[];
  pendingRequests: OpsRequestBooking[];
  pendingPayment: OpsBooking[];
  pendingServiceOrders: OpsServiceOrder[];
  openTickets: OpsTicket[];
  declineReasons: DeclineReasonOption[];
  labels: Labels;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [passportBooking, setPassportBooking] = useState<OpsBooking | null>(null);
  const [checkinBooking, setCheckinBooking] = useState<OpsBooking | null>(null);
  const [checkoutBooking, setCheckoutBooking] = useState<OpsBooking | null>(null);
  const [receipts, setReceipts] = useState<Record<string, string>>({});
  const [bankRefs, setBankRefs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const act = async (bookingId: string, path: string, body?: unknown) => {
    setBusyId(bookingId);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || labels['staff.ops.error_generic']);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['staff.ops.error_generic']);
    } finally {
      setBusyId(null);
    }
  };

  const recordServiceCash = async (order: OpsServiceOrder) => {
    const receiptRef = (receipts[order.id] || '').trim();
    if (!receiptRef) return;
    if (
      !window.confirm(
        fill(labels['staff.ops.confirm_cash'], {
          amount: order.totalThb.toLocaleString(),
        })
      )
    ) {
      return;
    }
    setBusyId(order.id);
    setError(null);
    try {
      const response = await fetch(`/api/service-orders/${order.id}/record-cash-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptRef }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || labels['staff.ops.error_generic']);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['staff.ops.error_generic']);
    } finally {
      setBusyId(null);
    }
  };

  const ticketAction = async (
    ticketId: string,
    path: 'assign' | 'status',
    body: Record<string, unknown> = {}
  ) => {
    setBusyId(ticketId);
    setError(null);
    try {
      const response = await fetch(`/api/tickets/${ticketId}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || labels['staff.ops.error_generic']);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['staff.ops.error_generic']);
    } finally {
      setBusyId(null);
    }
  };

  const runTicketStatusAction = (ticket: OpsTicket, newStatus: string) => {
    if (newStatus !== 'resolved') {
      void ticketAction(ticket.id, 'status', { newStatus });
      return;
    }
    const noteRaw = window.prompt(labels['staff.ops.ticket_resolve_note_prompt']) || '';
    const note = noteRaw.trim();
    if (!note) {
      setError(labels['staff.ops.ticket_resolve_note_required']);
      return;
    }
    void ticketAction(ticket.id, 'status', { newStatus, note });
  };

  const respondLabels = {
    approve: labels['staff.ops.approve_request'],
    decline: labels['staff.ops.decline_request'],
    decline_reason: labels['staff.ops.decline_reason'],
    decline_reason_required: labels['staff.ops.decline_reason_required'],
    confirm_decline: labels['staff.ops.confirm_decline_request'],
    error_generic: labels['staff.ops.error_generic'],
  };

  const RequestRow = ({ booking }: { booking: OpsRequestBooking }) => (
    <div className="flex flex-col lg:flex-row lg:items-start gap-16 py-16 border-b border-border-line last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className="text-body font-semibold text-text-ink">
          {booking.guestName}
          <span className="text-text-secondary font-normal">
            {' · '}
            <Link
              href={`/ops/calendar/${booking.unitId}`}
              className="text-brand-andaman hover:underline"
            >
              {booking.unitName}
            </Link>
          </span>
        </p>
        <p className="text-small text-text-secondary mt-4">
          {new Date(booking.startDate).toLocaleDateString()} —{' '}
          {new Date(booking.endDate).toLocaleDateString()} · {booking.party}{' '}
          {labels['staff.ops.guest'].toLowerCase()}
        </p>
        {booking.requestExpiresAt ? (
          <p className="text-small text-state-warning mt-4">
            {labels['staff.ops.request_expires']}:{' '}
            {new Date(booking.requestExpiresAt).toLocaleString()}
          </p>
        ) : null}
        <BookingRequestInboxDetails
          nights={booking.nights}
          completedStayCount={booking.completedStayCount}
          breakdownLines={booking.breakdownLines}
          labels={labels}
        />
      </div>
      <BookingRequestRespondActions
        bookingId={booking.id}
        labels={respondLabels}
        declineReasons={declineReasons}
      />
    </div>
  );

  const Row = ({
    booking,
    action,
  }: {
    booking: OpsBooking;
    action: React.ReactNode;
  }) => (
    <div className="flex flex-col md:flex-row md:items-center gap-12 py-16 border-b border-border-line last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className="text-body font-semibold text-text-ink">
          {booking.guestName}
          <span className="text-text-secondary font-normal">
            {' · '}
            {booking.unitId ? (
              <Link
                href={`/ops/calendar/${booking.unitId}`}
                className="text-brand-andaman hover:underline"
              >
                {booking.unitName}
              </Link>
            ) : (
              booking.unitName
            )}
          </span>
        </p>
        <p className="text-small text-text-secondary">
          {new Date(booking.startDate).toLocaleDateString()} —{' '}
          {new Date(booking.endDate).toLocaleDateString()} · {booking.party}{' '}
          {labels['staff.ops.guest'].toLowerCase()} · ฿{booking.totalThb.toLocaleString()}
        </p>
        <div className="flex flex-wrap gap-8 mt-8">
          <Chip
            variant={chipStatusVariant}
            status={booking.paid ? paidChip : unpaidChip}
          >
            {booking.paid ? labels['staff.ops.paid'] : labels['staff.ops.unpaid']}
          </Chip>
          <Chip
            variant={chipStatusVariant}
            status={
              booking.verificationStatus === 'passports_received'
                ? verifiedChip
                : notVerifiedChip
            }
          >
            {booking.verificationStatus === 'passports_received'
              ? labels['staff.ops.verified']
              : labels['staff.ops.not_verified']}
          </Chip>
        </div>
      </div>
      <div className="flex items-center gap-8">{action}</div>
    </div>
  );

  const Section = ({
    title,
    bookings,
    action,
  }: {
    title: string;
    bookings: OpsBooking[];
    action: (booking: OpsBooking) => React.ReactNode;
  }) => (
    <section className="bg-surface-paper border border-border-line rounded-lg shadow-card p-24 mb-24">
      <h2 className="font-display text-title font-semibold text-text-ink mb-8">{title}</h2>
      {bookings.length === 0 ? (
        <p className="text-body text-text-secondary py-8">{labels['staff.ops.empty']}</p>
      ) : (
        bookings.map((booking) => (
          <Row key={booking.id} booking={booking} action={action(booking)} />
        ))
      )}
    </section>
  );

  return (
    <div>
      {error && (
        <div className="bg-state-error-soft border border-state-error rounded-lg p-16 mb-24">
          <p className="text-body text-state-error">{error}</p>
        </div>
      )}

      {mobilizationUnits.length > 0 && (
        <section className="bg-surface-paper border border-border-line rounded-lg shadow-card p-24 mb-24">
          <h2 className="font-display text-title font-semibold text-text-ink mb-16">
            {labels['staff.ops.mobilization_title']}
          </h2>
          <ul className="space-y-12">
            {mobilizationUnits.map((unit) => {
              const href = activeProjectId
                ? `/ops/mobilization/${unit.id}?projectId=${encodeURIComponent(activeProjectId)}`
                : `/ops/mobilization/${unit.id}`;
              return (
                <li
                  key={unit.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-8 py-12 border-b border-border-line last:border-b-0"
                >
                  <div>
                    <p className="text-body font-semibold text-text-ink">{unit.name}</p>
                    <p className="text-small text-text-secondary">
                      {unit.projectName} ·{' '}
                      {fill(labels['staff.ops.mobilization_progress'], {
                        completed: unit.completedSteps,
                        total: unit.totalSteps,
                      })}
                      {unit.nextStep
                        ? ` · ${labels['staff.ops.mobilization_next']}: ${unit.nextStep}`
                        : ''}
                    </p>
                  </div>
                  <Link
                    href={href}
                    className="text-small font-semibold text-brand-andaman hover:underline shrink-0"
                  >
                    {labels['staff.ops.mobilization_open']}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="bg-surface-paper border border-border-line rounded-lg shadow-card p-24 mb-24">
        <div className="flex items-center justify-between gap-16 mb-8">
          <h2 className="font-display text-title font-semibold text-text-ink">
            {labels['staff.ops.booking_requests']}
          </h2>
          <Link
            href={
              activeProjectId
                ? `/ops/requests?projectId=${encodeURIComponent(activeProjectId)}`
                : '/ops/requests'
            }
            className="text-small font-semibold text-brand-andaman hover:underline shrink-0"
          >
            {labels['staff.ops.requests_open_inbox']}
          </Link>
        </div>
        {pendingRequests.length === 0 ? (
          <p className="text-body text-text-secondary py-8">{labels['staff.ops.requests_empty']}</p>
        ) : (
          pendingRequests.map((booking) => (
            <RequestRow key={booking.id} booking={booking} />
          ))
        )}
      </section>

      <Section
        title={labels['staff.ops.arrivals']}
        bookings={arrivals}
        action={(booking) => (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-8">
            {booking.verificationStatus !== 'passports_received' ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPassportBooking(booking)}
              >
                {labels['staff.ops.capture_passports']}
              </Button>
            ) : null}
            <Button
              size="sm"
              onClick={() => setCheckinBooking(booking)}
              isLoading={busyId === booking.id}
              disabled={!booking.paid}
            >
              {labels['staff.ops.check_in']}
            </Button>
          </div>
        )}
      />

      <ArrivalPassportCaptureModal
        bookingId={passportBooking?.id ?? null}
        guestName={passportBooking?.guestName ?? ''}
        labels={labels}
        onClose={() => setPassportBooking(null)}
        onComplete={() => router.refresh()}
      />

      <CheckInConditionReportModal
        bookingId={checkinBooking?.id ?? null}
        guestName={checkinBooking?.guestName ?? ''}
        unitName={checkinBooking?.unitName ?? ''}
        labels={labels}
        onClose={() => setCheckinBooking(null)}
        onComplete={() => router.refresh()}
      />

      <CheckOutConditionReportModal
        bookingId={checkoutBooking?.id ?? null}
        guestName={checkoutBooking?.guestName ?? ''}
        unitName={checkoutBooking?.unitName ?? ''}
        labels={labels}
        onClose={() => setCheckoutBooking(null)}
        onComplete={() => router.refresh()}
      />

      <Section
        title={labels['staff.ops.departures']}
        bookings={departures}
        action={(booking) => (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setCheckoutBooking(booking)}
              isLoading={busyId === booking.id}
            >
              {labels['staff.ops.check_out']}
            </Button>
        )}
      />

      <Section
        title={labels['staff.ops.pending_cash']}
        bookings={pendingPayment}
        action={(booking) => (
          <div className="flex items-center gap-8">
            <Input
              type="text"
              value={receipts[booking.id] || ''}
              onChange={(e) =>
                setReceipts((prev) => ({ ...prev, [booking.id]: e.target.value }))
              }
              placeholder={labels['staff.ops.receipt_placeholder']}
              className="w-[160px]"
            />
            <Button
              size="sm"
              variant="sun"
              onClick={() => {
                const receiptRef = (receipts[booking.id] || '').trim();
                if (!receiptRef) return;
                if (
                  window.confirm(
                    fill(labels['staff.ops.confirm_cash'], {
                      amount: booking.totalThb.toLocaleString(),
                    })
                  )
                ) {
                  act(booking.id, 'record-cash-payment', { receiptRef });
                }
              }}
              isLoading={busyId === booking.id}
              disabled={!(receipts[booking.id] || '').trim()}
            >
              {labels['staff.ops.record_cash']}
            </Button>
            <Input
              type="text"
              value={bankRefs[booking.id] || ''}
              onChange={(e) =>
                setBankRefs((prev) => ({ ...prev, [booking.id]: e.target.value }))
              }
              placeholder={labels['staff.ops.bank_ref_placeholder']}
              className="w-[160px]"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const bankReference = (bankRefs[booking.id] || '').trim();
                if (!bankReference) return;
                act(booking.id, 'record-transfer', {
                  amountThb: Math.round(booking.totalThb * 100),
                  bankReference,
                });
              }}
              isLoading={busyId === booking.id}
              disabled={!(bankRefs[booking.id] || '').trim()}
            >
              {labels['staff.ops.record_transfer']}
            </Button>
          </div>
        )}
      />

      <section className="bg-surface-paper border border-border-line rounded-lg shadow-card p-24 mb-24">
        <h2 className="font-display text-title font-semibold text-text-ink mb-8">
          {labels['staff.ops.service_pending_cash']}
        </h2>
        {pendingServiceOrders.length === 0 ? (
          <p className="text-body text-text-secondary py-8">{labels['staff.ops.empty']}</p>
        ) : (
          pendingServiceOrders.map((order) => (
            <div
              key={order.id}
              className="flex flex-col md:flex-row md:items-center gap-12 py-16 border-b border-border-line last:border-b-0"
            >
              <div className="flex-1 min-w-0">
                <p className="text-body font-semibold text-text-ink">
                  {order.serviceTitle}
                  <span className="text-text-secondary font-normal"> · {order.ordererName}</span>
                </p>
                <p className="text-small text-text-secondary">
                  {new Date(order.scheduledStart).toLocaleString()} · ฿
                  {order.totalThb.toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-8">
                <Input
                  type="text"
                  value={receipts[order.id] || ''}
                  onChange={(e) =>
                    setReceipts((prev) => ({ ...prev, [order.id]: e.target.value }))
                  }
                  placeholder={labels['staff.ops.receipt_placeholder']}
                  className="w-[160px]"
                />
                <Button
                  size="sm"
                  variant="sun"
                  onClick={() => recordServiceCash(order)}
                  isLoading={busyId === order.id}
                  disabled={!(receipts[order.id] || '').trim()}
                >
                  {labels['staff.ops.record_cash']}
                </Button>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="bg-surface-paper border border-border-line rounded-lg shadow-card p-24 mb-24">
        <h2 className="font-display text-title font-semibold text-text-ink mb-8">
          {labels['staff.ops.tickets_title']}
        </h2>
        {openTickets.length === 0 ? (
          <p className="text-body text-text-secondary py-8">{labels['staff.ops.tickets_empty']}</p>
        ) : (
          openTickets.map((ticket) => {
            const statusActions: Array<{ newStatus: string; label: string }> = [];
            const progression = ticketNextStatus(ticket.status);
            if (progression) {
              statusActions.push({
                newStatus: progression,
                label:
                  ticket.status === 'open'
                    ? labels['staff.ops.ticket_acknowledge']
                    : ticket.status === 'acknowledged'
                      ? labels['staff.ops.ticket_start']
                      : labels['staff.ops.ticket_resume'],
              });
            }
            if (ticket.status === 'in_progress') {
              statusActions.push({
                newStatus: 'waiting_reporter',
                label: labels['staff.ops.ticket_need_reporter'],
              });
              statusActions.push({
                newStatus: 'resolved',
                label: labels['staff.ops.ticket_resolve'],
              });
            }

            return (
              <div
                key={ticket.id}
                className="flex flex-col md:flex-row md:items-center gap-12 py-16 border-b border-border-line last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-8">
                    <p className="text-body font-semibold text-text-ink">{ticket.title}</p>
                    <Chip variant={chipStatusVariant} status={ticketChipStatus(ticket.status)}>
                      {ticketStatusLabel(ticket.status, labels)}
                    </Chip>
                  </div>
                  <p className="text-small text-text-secondary">
                    {ticket.unitId ? (
                      <Link
                        href={`/ops/calendar/${ticket.unitId}`}
                        className="text-brand-andaman hover:underline"
                      >
                        {ticket.unitName}
                      </Link>
                    ) : (
                      ticket.unitName
                    )}{' '}
                    · {labels['staff.ops.ticket_reported_by']} {ticket.raisedByName}
                  </p>
                  {ticket.slaDueAt ? (
                    <p className="text-small text-text-secondary">
                      {labels['staff.ops.ticket_due']}: {new Date(ticket.slaDueAt).toLocaleString()}
                    </p>
                  ) : null}
                  {ticket.assigneeName ? (
                    <p className="text-small text-text-secondary">
                      {labels['staff.ops.ticket_assigned_to']}: {ticket.assigneeName}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-8">
                  <Link
                    href={`/tickets/${ticket.id}`}
                    className="text-small font-semibold text-brand-andaman hover:underline"
                  >
                    {labels['staff.ops.ticket_view']} →
                  </Link>
                  {ticket.assigneeIdentityId !== viewerIdentityId ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void ticketAction(ticket.id, 'assign')}
                      isLoading={busyId === ticket.id}
                    >
                      {labels['staff.ops.ticket_assign_me']}
                    </Button>
                  ) : null}
                  {statusActions.map((action) => (
                    <Button
                      key={`${ticket.id}-${action.newStatus}`}
                      size="sm"
                      onClick={() => runTicketStatusAction(ticket, action.newStatus)}
                      isLoading={busyId === ticket.id}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
