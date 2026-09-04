'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, StatTile } from '@/components';
import {
  HBarStack,
  MonthHeatStrip,
  HeroNumber,
  DeltaChip,
  CHART_SERIES,
  formatThb,
} from '@/components/viz';
import type { HeatDay } from '@/components/viz';

interface Unit {
  id: string;
  name: string;
  projectId: string;
  description?: string | null;
  baseNightlyThb: number;
  status: string;
  engagement: Array<{
    id: string;
    engagementType: string;
    feeOverridePct: number | null;
  }>;
}

interface Booking {
  id: string;
  startDate: Date;
  endDate: Date;
  totalThb: number;
  status: string;
  guestIdentity: {
    id: string;
    firstName: string;
  };
  unit: {
    id: string;
    name: string;
  };
  guests: Array<{
    nationality?: string;
  }>;
}

interface Ticket {
  id: string;
  projectId: string;
  unitId: string | null;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  createdAt: Date;
  updatedAt: Date;
  assigneeIdentityId?: string | null;
  assignee?: {
    id: string;
    firstName: string;
  } | null;
  raisedBy: {
    id: string;
    firstName: string;
  };
  unit: {
    id: string;
    name: string;
  };
}

interface DashboardData {
  identityId: string;
  projectId: string;
  organizationId: string;
  unitsCount: number;
  bookingsThisMonth: number;
  bookingsPrevMonth: number;
  openTicketsCount: number;
}

interface FeeLine {
  id: string;
  type: string;
  description: string;
  unitName?: string | null;
  grossAmount: number;
  feePercentage: number;
  feeAmount: number;
  date: string | Date;
}

interface FeeReport {
  periodStart: string | Date;
  periodEnd: string | Date;
  feeLines: FeeLine[];
  summaryThb: { grossAmount: number; platformFeeAmount: number };
}

interface ServiceOrder {
  id: string;
  status: string;
  scheduledStart: Date | string;
  totalThb: number;
  noteToProvider?: string | null;
  paid: boolean;
  service: {
    id: string;
    title: string;
  } | null;
  orderer: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  unit: {
    id: string;
    name: string;
  } | null;
}

interface MCContextOption {
  key: string;
  projectId: string;
  organizationId: string;
  projectName: string;
  organizationName: string;
  href: string;
}

interface MCDashboardClientProps {
  dashboard: DashboardData;
  units: Unit[];
  bookings: Booking[];
  tickets: Ticket[];
  serviceOrders: ServiceOrder[];
  feeReport?: FeeReport | null;
  labels: Record<string, string>;
  contexts: MCContextOption[];
  activeContextKey: string;
}

// doc 06 §3.4 status → color mapping, state tokens only
const bookingStatusStyle: Record<string, string> = {
  requested: 'bg-state-warning-soft text-state-warning',
  confirmed: 'bg-state-success-soft text-state-success',
  checked_in: 'bg-state-info-soft text-state-info',
  checked_out: 'bg-surface-ivory text-text-stone',
  pending_payment: 'bg-state-warning-soft text-state-warning',
  placed: 'bg-state-warning-soft text-state-warning',
  paid: 'bg-state-info-soft text-state-info',
  accepted: 'bg-state-info-soft text-state-info',
};

const ticketStatusStyle: Record<string, string> = {
  open: 'bg-state-warning-soft text-state-warning',
  acknowledged: 'bg-state-info-soft text-state-info',
  in_progress: 'bg-state-info-soft text-state-info',
  waiting_reporter: 'bg-state-warning-soft text-state-warning',
  resolved: 'bg-state-success-soft text-state-success',
};

/** Build the current month's day cells for a unit from its bookings. */
function monthHeatDays(unitId: string, bookings: Booking[]): HeatDay[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const occupying = bookings.filter(
    (b) =>
      b.unit?.id === unitId &&
      ['confirmed', 'checked_in', 'checked_out'].includes(b.status)
  );
  const days: HeatDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const night = new Date(year, month, d);
    const occupied = occupying.some(
      (b) => new Date(b.startDate) <= night && new Date(b.endDate) > night
    );
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({ date: iso, occupied });
  }
  return days;
}

export function MCDashboardClient({
  dashboard,
  units,
  bookings,
  tickets,
  serviceOrders,
  feeReport,
  labels,
  contexts,
  activeContextKey,
}: MCDashboardClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    'overview' | 'bookings' | 'tickets' | 'service_orders' | 'calendar' | 'reports'
  >('overview');
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingReceipts, setBookingReceipts] = useState<Record<string, string>>({});
  const [busyTicketId, setBusyTicketId] = useState<string | null>(null);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [busyServiceOrderId, setBusyServiceOrderId] = useState<string | null>(null);
  const [serviceOrderError, setServiceOrderError] = useState<string | null>(null);
  const [serviceOrderReceipts, setServiceOrderReceipts] = useState<Record<string, string>>({});

  const tabs = [
    { key: 'overview' as const, label: labels['mc.tabs.overview'] },
    { key: 'bookings' as const, label: labels['mc.tabs.bookings'] },
    { key: 'tickets' as const, label: labels['mc.tabs.tickets'] },
    { key: 'service_orders' as const, label: labels['mc.tabs.service_orders'] },
    { key: 'calendar' as const, label: labels['mc.tabs.calendar'] },
    { key: 'reports' as const, label: labels['mc.tabs.reports'] },
  ];

  const statusLabel = (status: string) =>
    labels[`mc.status.${status}`] || status.replace(/_/g, ' ');

  // Fee chart: one row per unit — gross split into net-of-fee + platform fee
  const feeByUnit = new Map<string, { gross: number; fee: number }>();
  for (const line of feeReport?.feeLines ?? []) {
    const key = line.unitName || line.description;
    const agg = feeByUnit.get(key) || { gross: 0, fee: 0 };
    agg.gross += line.grossAmount;
    agg.fee += line.feeAmount;
    feeByUnit.set(key, agg);
  }
  const feeRows = Array.from(feeByUnit.entries())
    .sort((a, b) => b[1].gross - a[1].gross)
    .map(([unitName, { gross, fee }]) => ({
      label: unitName,
      segments: [
        {
          key: 'net',
          label: labels['mc.reports.net_of_fee'],
          value: gross - fee,
          color: CHART_SERIES[0],
        },
        {
          key: 'fee',
          label: labels['mc.reports.platform_fee'],
          value: fee,
          color: CHART_SERIES[1],
        },
      ],
    }));
  const activeContext =
    contexts.find((context) => context.key === activeContextKey) ?? contexts[0];

  const fill = (template: string, params: Record<string, string | number>) => {
    let result = template;
    for (const [key, value] of Object.entries(params)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }
    return result;
  };

  const postBookingAction = async (bookingId: string, path: string, body?: unknown) => {
    setBusyBookingId(bookingId);
    setBookingError(null);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || labels['mc.bookings.error_generic']);
      }
      router.refresh();
    } catch (error) {
      setBookingError(
        error instanceof Error ? error.message : labels['mc.bookings.error_generic']
      );
    } finally {
      setBusyBookingId(null);
    }
  };

  const postTicketAction = async (ticketId: string, path: string, body?: unknown) => {
    setBusyTicketId(ticketId);
    setTicketError(null);
    try {
      const response = await fetch(`/api/tickets/${ticketId}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || labels['mc.tickets.error_generic']);
      }
      router.refresh();
    } catch (error) {
      setTicketError(error instanceof Error ? error.message : labels['mc.tickets.error_generic']);
    } finally {
      setBusyTicketId(null);
    }
  };

  const ticketStatusActions = (ticket: Ticket) => {
    if (ticket.status === 'open') {
      return [{ newStatus: 'acknowledged', label: labels['mc.tickets.acknowledge'] }];
    }
    if (ticket.status === 'acknowledged') {
      return [{ newStatus: 'in_progress', label: labels['mc.tickets.start'] }];
    }
    if (ticket.status === 'in_progress') {
      return [
        { newStatus: 'waiting_reporter', label: labels['mc.tickets.need_reporter'] },
        { newStatus: 'resolved', label: labels['mc.tickets.resolve'] },
      ];
    }
    if (ticket.status === 'waiting_reporter') {
      return [{ newStatus: 'in_progress', label: labels['mc.tickets.resume'] }];
    }
    return [];
  };

  const runTicketStatusAction = (ticket: Ticket, newStatus: string) => {
    if (newStatus !== 'resolved') {
      void postTicketAction(ticket.id, 'status', { newStatus });
      return;
    }

    const noteRaw = window.prompt(labels['mc.tickets.resolve_note_prompt']) || '';
    const note = noteRaw.trim();
    if (!note) {
      setTicketError(labels['mc.tickets.resolve_note_required']);
      return;
    }
    void postTicketAction(ticket.id, 'status', { newStatus, note });
  };

  const postServiceOrderAction = async (orderId: string, path: string, body?: unknown) => {
    setBusyServiceOrderId(orderId);
    setServiceOrderError(null);
    try {
      const response = await fetch(`/api/service-orders/${orderId}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || labels['mc.service_orders.error_generic']);
      }
      router.refresh();
    } catch (error) {
      setServiceOrderError(
        error instanceof Error ? error.message : labels['mc.service_orders.error_generic']
      );
    } finally {
      setBusyServiceOrderId(null);
    }
  };

  const actionForBooking = (booking: Booking) => {
    if (booking.status === 'requested') {
      return (
        <div className="flex items-center gap-8">
          <Button
            size="sm"
            variant="sun"
            onClick={() => void postBookingAction(booking.id, 'respond', { action: 'approve' })}
            isLoading={busyBookingId === booking.id}
          >
            {labels['mc.bookings.approve']}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              if (window.confirm(labels['mc.bookings.confirm_decline'])) {
                void postBookingAction(booking.id, 'respond', { action: 'decline' });
              }
            }}
            isLoading={busyBookingId === booking.id}
          >
            {labels['mc.bookings.decline']}
          </Button>
        </div>
      );
    }

    if (booking.status === 'pending_payment') {
      const receiptRef = (bookingReceipts[booking.id] || '').trim();
      return (
        <div className="flex items-center gap-8">
          <input
            type="text"
            value={bookingReceipts[booking.id] || ''}
            onChange={(event) =>
              setBookingReceipts((previous) => ({
                ...previous,
                [booking.id]: event.target.value,
              }))
            }
            placeholder={labels['mc.bookings.receipt_placeholder']}
            className="h-36 px-10 rounded-sm bg-surface-paper border border-border-line text-small text-text-ink focus:border-brand-andaman focus:outline-none"
            style={{ width: '140px' }}
          />
          <Button
            size="sm"
            variant="sun"
            onClick={() => {
              if (!receiptRef) return;
              if (
                window.confirm(
                  fill(labels['mc.bookings.confirm_cash'], {
                    amount: booking.totalThb.toLocaleString(),
                  })
                )
              ) {
                void postBookingAction(booking.id, 'record-cash-payment', { receiptRef });
              }
            }}
            isLoading={busyBookingId === booking.id}
            disabled={!receiptRef}
          >
            {labels['mc.bookings.record_cash']}
          </Button>
        </div>
      );
    }

    if (booking.status === 'confirmed') {
      return (
        <Button
          size="sm"
          onClick={() => void postBookingAction(booking.id, 'checkin')}
          isLoading={busyBookingId === booking.id}
        >
          {labels['mc.bookings.check_in']}
        </Button>
      );
    }

    if (booking.status === 'checked_in') {
      return (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void postBookingAction(booking.id, 'check-out')}
          isLoading={busyBookingId === booking.id}
        >
          {labels['mc.bookings.check_out']}
        </Button>
      );
    }

    return <span className="text-small text-text-secondary">—</span>;
  };

  return (
    <main className="min-h-screen bg-surface-background">
      {/* Header */}
      <section className="bg-surface-paper border-b border-border-line px-24 py-16">
        <div className="max-w-7xl mx-auto flex items-start justify-between gap-16">
          <div>
            <h1 className="text-heading-1 font-bold text-text-ink mb-4">
              {labels['mc.portal.title']}
            </h1>
            <p className="text-body text-text-secondary">{labels['mc.portal.subtitle']}</p>
            <p className="text-small text-text-secondary mt-8">
              {labels['mc.context.active']}:{' '}
              {activeContext?.projectName} · {activeContext?.organizationName}
            </p>
            {contexts.length > 1 && (
              <div className="mt-12">
                <p className="text-small text-text-secondary mb-8">{labels['mc.context.switcher']}</p>
                <div className="flex flex-wrap gap-8">
                  {contexts.map((context) => (
                    <Link
                      key={context.key}
                      href={context.href}
                      className={`inline-flex items-center rounded-full px-12 py-6 text-small border transition-colors ${
                        context.key === activeContextKey
                          ? 'bg-brand-andaman-soft text-brand-andaman border-brand-andaman'
                          : 'bg-surface-paper text-text-secondary border-border-line hover:text-text-ink'
                      }`}
                    >
                      {context.projectName} · {context.organizationName}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-12 shrink-0">
            <Link
              href={`/mc/tm30?projectId=${encodeURIComponent(activeContext?.projectId || '')}&organizationId=${encodeURIComponent(activeContext?.organizationId || '')}`}
              className="inline-flex items-center h-40 px-20 rounded-md border border-brand-andaman text-brand-andaman font-medium hover:bg-brand-andaman-soft transition-colors duration-micro"
            >
              {labels['mc.nav.tm30']}
            </Link>
            <Link
              href="/announcements"
              className="inline-flex items-center h-40 px-20 rounded-md bg-brand-andaman text-surface-ivory font-medium hover:bg-brand-deep transition-colors duration-micro"
            >
              {labels['mc.nav.announcements']}
            </Link>
          </div>
        </div>
      </section>

      {/* Navigation Tabs */}
      <section className="bg-surface-paper border-b border-border-line sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-24">
          <div className="flex gap-32 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-16 font-semibold text-body border-b-3 whitespace-nowrap transition ${
                  activeTab === tab.key
                    ? 'border-brand-andaman text-brand-andaman'
                    : 'border-transparent text-text-secondary hover:text-text-ink'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-7xl mx-auto px-24 py-40">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div>
            {/* Stats Tiles */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-24 mb-40">
              <StatTile label={labels['mc.stats.units']} value={dashboard.unitsCount} variant="occupancy" />
              <StatTile
                label={labels['mc.stats.bookings_month']}
                value={dashboard.bookingsThisMonth}
                variant="occupancy"
                delta={
                  <DeltaChip
                    currentValue={dashboard.bookingsThisMonth}
                    previousValue={dashboard.bookingsPrevMonth ?? null}
                    vsLabel={labels['mc.stats.vs_last_month']}
                    newLabel={labels['mc.stats.new_period']}
                  />
                }
              />
              <StatTile label={labels['mc.stats.open_tickets']} value={dashboard.openTicketsCount} variant="neutral" />
            </div>

            {/* Managed Units List */}
            <div className="bg-surface-paper border border-border-line rounded-lg p-24">
              <h2 className="text-heading-2 font-bold text-text-ink mb-20">
                {labels['mc.units.title']}
              </h2>
              <div className="space-y-16">
                {units.length === 0 ? (
                  <p className="text-body text-text-secondary">{labels['mc.units.empty']}</p>
                ) : (
                  units.map((unit) => (
                    <div
                      key={unit.id}
                      className="border border-border-line rounded-lg p-16 hover:bg-surface-background transition"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-heading-3 font-bold text-text-ink">{unit.name}</h3>
                          <p className="text-small text-text-secondary mt-4">{unit.description}</p>
                          <div className="flex gap-16 mt-12">
                            <span className="text-small text-text-secondary">
                              ฿{unit.baseNightlyThb.toLocaleString()} {labels['mc.units.per_night']}
                            </span>
                            <span className="text-small font-semibold text-brand-andaman">
                              {unit.status}
                            </span>
                          </div>
                        </div>
                        <Link
                          href={`/mc/units/${unit.id}`}
                          className="text-brand-andaman font-semibold hover:underline"
                        >
                          {labels['mc.units.manage']} →
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <div>
            <h2 className="text-heading-2 font-bold text-text-ink mb-20">
              {labels['mc.bookings.title']}
            </h2>
            {bookingError && (
              <div className="mb-16 bg-state-error-soft border border-state-error rounded-lg p-12">
                <p className="text-small text-state-error">{bookingError}</p>
              </div>
            )}
            <div className="bg-surface-paper border border-border-line rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-background border-b border-border-line">
                    <tr>
                      <th className="text-left p-16 font-bold text-text-ink">{labels['mc.bookings.unit']}</th>
                      <th className="text-left p-16 font-bold text-text-ink">{labels['mc.bookings.guest']}</th>
                      <th className="text-left p-16 font-bold text-text-ink">{labels['mc.bookings.check_in']}</th>
                      <th className="text-left p-16 font-bold text-text-ink">{labels['mc.bookings.check_out']}</th>
                      <th className="text-left p-16 font-bold text-text-ink">{labels['mc.bookings.amount']}</th>
                      <th className="text-left p-16 font-bold text-text-ink">{labels['mc.bookings.status']}</th>
                      <th className="text-left p-16 font-bold text-text-ink">{labels['mc.bookings.actions']}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center p-24 text-text-secondary">
                          {labels['mc.bookings.empty']}
                        </td>
                      </tr>
                    ) : (
                      bookings.map((booking) => (
                        <tr key={booking.id} className="border-b border-border-line hover:bg-surface-background">
                          <td className="p-16 text-body font-semibold text-text-ink">
                            {booking.unit.name}
                          </td>
                          <td className="p-16 text-body text-text-ink">
                            {booking.guestIdentity.firstName}
                            {booking.guests[0]?.nationality && (
                              <span className="text-small text-text-secondary ml-8">
                                ({booking.guests[0].nationality})
                              </span>
                            )}
                          </td>
                          <td className="p-16 text-small text-text-secondary">
                            {new Date(booking.startDate).toLocaleDateString()}
                          </td>
                          <td className="p-16 text-small text-text-secondary">
                            {new Date(booking.endDate).toLocaleDateString()}
                          </td>
                          <td className="p-16 text-body font-semibold text-text-ink tabular-nums">
                            ฿{booking.totalThb.toLocaleString()}
                          </td>
                          <td className="p-16">
                            <span
                              className={`inline-flex items-center px-12 py-6 rounded-full text-small font-medium ${
                                bookingStatusStyle[booking.status] || 'bg-surface-ivory text-text-stone'
                              }`}
                            >
                              {statusLabel(booking.status)}
                            </span>
                          </td>
                          <td className="p-16">{actionForBooking(booking)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tickets Tab */}
        {activeTab === 'tickets' && (
          <div>
            <h2 className="text-heading-2 font-bold text-text-ink mb-20">
              {labels['mc.tickets.title']}
            </h2>
            {ticketError && (
              <div className="mb-16 bg-state-error-soft border border-state-error rounded-lg p-12">
                <p className="text-small text-state-error">{ticketError}</p>
              </div>
            )}
            <div className="space-y-16">
              {tickets.length === 0 ? (
                <div className="bg-surface-paper border border-border-line rounded-lg p-24 text-center">
                  <p className="text-text-secondary">{labels['mc.tickets.empty']}</p>
                </div>
              ) : (
                tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="bg-surface-paper border border-border-line rounded-lg p-20 hover:shadow-card transition"
                  >
                    <div className="flex justify-between items-start mb-12">
                      <div>
                        <div className="flex items-center gap-12">
                          <span
                            className={`inline-flex items-center px-12 py-6 rounded-full text-small font-medium ${
                              ticketStatusStyle[ticket.status] || 'bg-surface-ivory text-text-stone'
                            }`}
                          >
                            {statusLabel(ticket.status)}
                          </span>
                        </div>
                        <h3 className="text-heading-3 font-bold text-text-ink mt-8">
                          {ticket.title}
                        </h3>
                      </div>
                      <Link href={`/tickets/${ticket.id}`} className="text-brand-andaman font-semibold hover:underline">
                        {labels['mc.tickets.view']} →
                      </Link>
                    </div>
                    <p className="text-small text-text-secondary">
                      {ticket.unit.name} · {labels['mc.tickets.reported_by']} {ticket.raisedBy.firstName}
                    </p>
                    <div className="mt-12 flex flex-wrap items-center gap-8">
                      {ticket.assigneeIdentityId !== dashboard.identityId && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void postTicketAction(ticket.id, 'assign')}
                          isLoading={busyTicketId === ticket.id}
                        >
                          {labels['mc.tickets.assign_me']}
                        </Button>
                      )}
                      {ticket.assigneeIdentityId && (
                        <span className="text-small text-text-secondary">
                          {labels['mc.tickets.assigned_to']} {ticket.assignee?.firstName || '—'}
                        </span>
                      )}
                      {ticketStatusActions(ticket).map((action) => (
                        <Button
                          key={`${ticket.id}-${action.newStatus}`}
                          size="sm"
                          onClick={() => runTicketStatusAction(ticket, action.newStatus)}
                          isLoading={busyTicketId === ticket.id}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Calendar Tab — month heat strip per unit */}
        {activeTab === 'service_orders' && (
          <div>
            <h2 className="text-heading-2 font-bold text-text-ink mb-20">
              {labels['mc.service_orders.title']}
            </h2>
            {serviceOrderError && (
              <div className="mb-16 bg-state-error-soft border border-state-error rounded-lg p-12">
                <p className="text-small text-state-error">{serviceOrderError}</p>
              </div>
            )}
            <div className="space-y-16">
              {serviceOrders.length === 0 ? (
                <div className="bg-surface-paper border border-border-line rounded-lg p-24 text-center">
                  <p className="text-text-secondary">{labels['mc.service_orders.empty']}</p>
                </div>
              ) : (
                serviceOrders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-surface-paper border border-border-line rounded-lg p-20"
                  >
                    <div className="flex items-start justify-between gap-12">
                      <div>
                        <h3 className="text-heading-3 font-bold text-text-ink">
                          {order.service?.title || labels['mc.service_orders.unknown_service']}
                        </h3>
                        <p className="text-small text-text-secondary mt-4">
                          {order.unit?.name || labels['mc.service_orders.unknown_unit']} ·{' '}
                          {order.orderer
                            ? `${order.orderer.firstName} ${order.orderer.lastName}`
                            : labels['mc.service_orders.unknown_orderer']}
                        </p>
                        <p className="text-small text-text-secondary mt-4">
                          {new Date(order.scheduledStart).toLocaleString()} · ฿
                          {order.totalThb.toLocaleString()}
                        </p>
                        {order.noteToProvider && (
                          <p className="text-small text-text-secondary mt-4">
                            {labels['mc.service_orders.note']} {order.noteToProvider}
                          </p>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center px-12 py-6 rounded-full text-small font-medium ${
                          bookingStatusStyle[order.status] || 'bg-surface-ivory text-text-stone'
                        }`}
                      >
                        {statusLabel(order.status)}
                      </span>
                    </div>
                    <div className="mt-12 flex flex-wrap items-center gap-8">
                      {order.status === 'placed' && (
                        <>
                          <input
                            type="text"
                            value={serviceOrderReceipts[order.id] || ''}
                            onChange={(event) =>
                              setServiceOrderReceipts((previous) => ({
                                ...previous,
                                [order.id]: event.target.value,
                              }))
                            }
                            placeholder={labels['mc.service_orders.receipt_placeholder']}
                            className="h-36 px-10 rounded-sm bg-surface-paper border border-border-line text-small text-text-ink focus:border-brand-andaman focus:outline-none"
                            style={{ width: '150px' }}
                          />
                          <Button
                            size="sm"
                            variant="sun"
                            onClick={() => {
                              const receiptRef = (serviceOrderReceipts[order.id] || '').trim();
                              if (!receiptRef) return;
                              if (
                                window.confirm(
                                  fill(labels['mc.service_orders.confirm_cash'], {
                                    amount: order.totalThb.toLocaleString(),
                                  })
                                )
                              ) {
                                void postServiceOrderAction(order.id, 'record-cash-payment', {
                                  receiptRef,
                                });
                              }
                            }}
                            isLoading={busyServiceOrderId === order.id}
                            disabled={!(serviceOrderReceipts[order.id] || '').trim()}
                          >
                            {labels['mc.service_orders.record_cash']}
                          </Button>
                        </>
                      )}
                      {['placed', 'paid', 'accepted'].includes(order.status) && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            if (window.confirm(labels['mc.service_orders.confirm_cancel'])) {
                              void postServiceOrderAction(order.id, 'cancel');
                            }
                          }}
                          isLoading={busyServiceOrderId === order.id}
                        >
                          {labels['mc.service_orders.cancel']}
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Calendar Tab — month heat strip per unit */}
        {activeTab === 'calendar' && (
          <div className="bg-surface-paper border border-border-line rounded-lg p-24">
            <h2 className="text-heading-2 font-bold text-text-ink mb-8">
              {labels['mc.calendar.title']}
            </h2>
            <div className="flex items-center gap-16 mb-20">
              <span className="inline-flex items-center gap-6 text-small text-text-secondary">
                <span className="inline-block w-12 h-12 rounded-sm" style={{ backgroundColor: '#2E7B74' }} aria-hidden />
                {labels['mc.calendar.occupied']}
              </span>
              <span className="inline-flex items-center gap-6 text-small text-text-secondary">
                <span className="inline-block w-12 h-12 rounded-sm" style={{ backgroundColor: '#DCEEEB' }} aria-hidden />
                {labels['mc.calendar.vacant']}
              </span>
            </div>
            {units.length === 0 ? (
              <p className="text-body text-text-secondary">{labels['mc.calendar.empty']}</p>
            ) : (
              <div className="space-y-16">
                {units.map((unit) => (
                  <div key={unit.id} className="border border-border-line rounded-lg p-16">
                    <div className="flex items-center justify-between gap-12 mb-8">
                      <p className="text-body font-semibold text-text-ink">{unit.name}</p>
                      <Link
                        href={`/mc/units/${unit.id}`}
                        className="text-small font-semibold text-brand-andaman hover:underline"
                      >
                        {labels['mc.calendar.manage']} →
                      </Link>
                    </div>
                    <MonthHeatStrip
                      days={monthHeatDays(unit.id, bookings)}
                      occupiedLabel={labels['mc.calendar.occupied']}
                      vacantLabel={labels['mc.calendar.vacant']}
                      noDataLabel={labels['mc.calendar.no_data']}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="bg-surface-paper border border-border-line rounded-lg p-24">
            <h2 className="text-heading-2 font-bold text-text-ink mb-20">
              {labels['mc.reports.title']}
            </h2>
            {!feeReport ? (
              <p className="text-body text-text-secondary">{labels['mc.reports.empty']}</p>
            ) : (
              <div>
                <p className="text-small text-text-secondary mb-16">
                  {new Date(feeReport.periodStart).toLocaleDateString()} —{' '}
                  {new Date(feeReport.periodEnd).toLocaleDateString()}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-24 mb-32">
                  <HeroNumber
                    value={formatThb(feeReport.summaryThb.grossAmount)}
                    label={labels['mc.reports.gross']}
                  />
                  <HeroNumber
                    value={formatThb(feeReport.summaryThb.platformFeeAmount)}
                    label={labels['mc.reports.fees']}
                  />
                </div>
                <h3 className="text-heading-3 font-semibold text-text-ink mb-16">
                  {labels['mc.reports.by_unit']}
                </h3>
                <HBarStack
                  rows={feeRows}
                  formatValue={formatThb}
                  legendLabels={[
                    { label: labels['mc.reports.net_of_fee'], color: CHART_SERIES[0] },
                    { label: labels['mc.reports.platform_fee'], color: CHART_SERIES[1] },
                  ]}
                  valueHeader={labels['mc.chart.amount']}
                  labelHeader={labels['mc.chart.unit']}
                  tableToggleLabels={{
                    show: labels['mc.chart.show_table'],
                    hide: labels['mc.chart.hide_table'],
                  }}
                  emptyLabel={labels['mc.reports.empty']}
                />
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
