'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components';
import CheckInConditionReportModal from '@/components/ops/CheckInConditionReportModal';
import CheckOutConditionReportModal from '@/components/ops/CheckOutConditionReportModal';
import UnitIcalConflictBanner, {
  UNIT_ICAL_CALENDAR_SURFACES,
} from '@/components/units/UnitIcalConflictBanner';
import type { UnitIcalConflictAlert } from '@/modules/integrations';
import {
  HBarStack,
  HeroNumber,
  CHART_SERIES,
  formatThb,
} from '@/components/viz';
import { toCsv } from '@/lib/csv';
import { statusClasses } from '@/lib/status';

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
  requestExpiresAt?: Date | string | null;
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
  icalConflicts: UnitIcalConflictAlert[];
  feeReportContext: {
    projectId: string;
    organizationId: string;
  };
  labels: Record<string, string>;
  contexts: MCContextOption[];
  activeContextKey: string;
}

function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthToPeriod(monthValue: string): { periodStart: string; periodEnd: string } {
  const [year, month] = monthValue.split('-').map(Number);
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 1);
  return {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  };
}

function formatReportPeriod(periodStart: string, periodEnd: string): string {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  end.setUTCDate(end.getUTCDate() - 1);
  return `${start.toLocaleDateString()} — ${end.toLocaleDateString()}`;
}

export function MCDashboardClient({
  dashboard,
  units,
  bookings,
  tickets,
  serviceOrders,
  icalConflicts,
  feeReportContext,
  labels,
  contexts,
  activeContextKey,
}: MCDashboardClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    'overview' | 'bookings' | 'tickets' | 'service_orders' | 'reports'
  >('overview');
  const [reservationView, setReservationView] = useState<
    'requests' | 'arrivals' | 'in_house' | 'departures' | 'all'
  >('requests');
  const [reportMonth, setReportMonth] = useState(currentMonthValue);
  const [feeReport, setFeeReport] = useState<FeeReport | null>(null);
  const [feeReportLoading, setFeeReportLoading] = useState(false);
  const [feeReportError, setFeeReportError] = useState<string | null>(null);
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingReceipts, setBookingReceipts] = useState<Record<string, string>>({});
  const [busyTicketId, setBusyTicketId] = useState<string | null>(null);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [busyServiceOrderId, setBusyServiceOrderId] = useState<string | null>(null);
  const [serviceOrderError, setServiceOrderError] = useState<string | null>(null);
  const [serviceOrderReceipts, setServiceOrderReceipts] = useState<Record<string, string>>({});
  const [checkinBooking, setCheckinBooking] = useState<Booking | null>(null);
  const [checkoutBooking, setCheckoutBooking] = useState<Booking | null>(null);
  const [serviceUnitId, setServiceUnitId] = useState(units[0]?.id ?? '');

  const requestedBookings = bookings.filter((booking) => booking.status === 'requested').length;
  const actionableServiceOrders = serviceOrders.filter((order) =>
    order.status === 'placed' || order.status === 'paid'
  ).length;

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

  useEffect(() => {
    if (activeTab !== 'reports') {
      return;
    }

    let cancelled = false;
    const { periodStart, periodEnd } = monthToPeriod(reportMonth);

    (async () => {
      setFeeReportLoading(true);
      setFeeReportError(null);
      try {
        const params = new URLSearchParams({
          projectId: feeReportContext.projectId,
          organizationId: feeReportContext.organizationId,
          periodStart,
          periodEnd,
        });
        const response = await fetch(`/api/mc/fee-report?${params.toString()}`);
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || labels['mc.reports.error_generic']);
        }
        const data = (await response.json()) as FeeReport;
        if (!cancelled) {
          setFeeReport(data);
        }
      } catch (error) {
        if (!cancelled) {
          setFeeReport(null);
          setFeeReportError(
            error instanceof Error ? error.message : labels['mc.reports.error_generic']
          );
        }
      } finally {
        if (!cancelled) {
          setFeeReportLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, reportMonth, feeReportContext, labels]);

  const exportFeeReportCsv = () => {
    if (!feeReport || feeReport.feeLines.length === 0) {
      return;
    }

    const rows: (string | number)[][] = [
      [
        labels['mc.reports.export.date'],
        labels['mc.reports.export.type'],
        labels['mc.reports.export.unit'],
        labels['mc.reports.export.description'],
        labels['mc.reports.export.gross'],
        labels['mc.reports.export.fee_pct'],
        labels['mc.reports.export.fee_amount'],
      ],
      ...feeReport.feeLines.map((line) => [
        new Date(line.date).toLocaleDateString(),
        line.type,
        line.unitName || '',
        line.description,
        line.grossAmount,
        line.feePercentage,
        line.feeAmount,
      ]),
    ];

    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `mc-fee-report-${reportMonth}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

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
            className="h-40 px-12 rounded-sm bg-surface-paper border border-border-line text-small text-text-ink focus:border-brand-andaman focus:outline-none"
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
          onClick={() => setCheckinBooking(booking)}
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
          onClick={() => setCheckoutBooking(booking)}
          isLoading={busyBookingId === booking.id}
        >
          {labels['mc.bookings.check_out']}
        </Button>
      );
    }

    return <span className="text-small text-text-secondary">—</span>;
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isSameLocalDay = (value: Date | string) => {
    const date = new Date(value);
    return date >= today && date < tomorrow;
  };

  const arrivalsToday = bookings.filter(
    (booking) => isSameLocalDay(booking.startDate) && ['confirmed', 'checked_in'].includes(booking.status)
  ).length;
  const departuresToday = bookings.filter(
    (booking) => isSameLocalDay(booking.endDate) && ['confirmed', 'checked_in', 'checked_out'].includes(booking.status)
  ).length;
  const inHouseNow = bookings.filter((booking) => {
    const start = new Date(booking.startDate);
    const end = new Date(booking.endDate);
    return start <= new Date() && end > new Date() && ['confirmed', 'checked_in'].includes(booking.status);
  }).length;
  const pendingPayments = bookings.filter((booking) => booking.status === 'pending_payment');
  const visibleBookings = bookings.filter((booking) => {
    if (reservationView === 'all') return true;
    if (reservationView === 'requests') {
      return ['requested', 'pending_payment'].includes(booking.status);
    }
    if (reservationView === 'arrivals') {
      return isSameLocalDay(booking.startDate) && ['confirmed', 'checked_in'].includes(booking.status);
    }
    if (reservationView === 'departures') {
      return isSameLocalDay(booking.endDate) && ['confirmed', 'checked_in', 'checked_out'].includes(booking.status);
    }
    const start = new Date(booking.startDate);
    const end = new Date(booking.endDate);
    return start <= new Date() && end > new Date() && booking.status === 'checked_in';
  });

  return (
    <main className="min-h-screen bg-surface-ivory">
      {/* MC workspace shell */}
      <section className="bg-surface-paper border-b border-border-line">
        <div className="max-w-[1600px] mx-auto px-16 lg:px-24 py-16">
          <div className="flex flex-col gap-16 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-8 text-small text-text-secondary mb-4">
                <span className="font-semibold uppercase tracking-[0.12em] text-brand-andaman">{labels['mc.workspace.brand']}</span>
                <span aria-hidden="true">/</span>
                <span>{activeContext?.organizationName}</span>
              </div>
              <h1 className="font-display text-display-xl font-semibold text-text-ink">
                {labels['mc.portal.title']}
              </h1>
              <p className="text-body text-text-stone mt-4">
                {activeContext?.projectName} · {labels['mc.workspace.live']}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-8">
              {contexts.length > 1 && (
                <label className="sr-only" htmlFor="mc-context-switcher">
                  {labels['mc.context.switcher']}
                </label>
              )}
              {contexts.length > 1 ? (
                <select
                  id="mc-context-switcher"
                  value={activeContextKey}
                  onChange={(event) => {
                    const context = contexts.find((item) => item.key === event.target.value);
                    if (context) router.push(context.href);
                  }}
                  className="h-44 min-w-[220px] rounded-md border border-border-line bg-surface-paper px-12 text-small font-medium text-text-ink focus:border-brand-andaman focus:outline-none"
                >
                  {contexts.map((context) => (
                    <option key={context.key} value={context.key}>
                      {context.projectName} · {context.organizationName}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="inline-flex h-44 items-center rounded-md border border-border-line px-12 text-small font-medium text-text-ink">
                  {activeContext?.projectName}
                </span>
              )}
              <Link
                href={`/mc/calendar?projectId=${encodeURIComponent(activeContext?.projectId || '')}&organizationId=${encodeURIComponent(activeContext?.organizationId || '')}`}
                className="inline-flex h-44 items-center rounded-md bg-brand-deep px-16 text-small font-semibold text-white hover:opacity-90"
              >
                {labels['mc.workspace.open_calendar']}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-[1600px] mx-auto lg:grid lg:grid-cols-[228px_minmax(0,1fr)]">
        <aside className="border-b lg:border-b-0 lg:border-r border-border-line bg-surface-paper lg:min-h-[calc(100vh-110px)]">
          <nav aria-label={labels['mc.portal.title']} className="p-12 lg:p-16">
            <div className="flex gap-8 overflow-x-auto lg:flex-col">
              <p className="hidden px-12 pt-4 text-caption font-semibold uppercase tracking-[0.12em] text-text-secondary lg:block">
                {labels['mc.workspace.operate']}
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`whitespace-nowrap rounded-md px-12 py-8 text-left text-small font-semibold transition ${activeTab === 'overview' ? 'bg-brand-andaman-soft text-brand-andaman' : 'text-text-secondary hover:bg-surface-ivory hover:text-text-ink'}`}
              >
                {labels['mc.workspace.today']}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('bookings')}
                className={`whitespace-nowrap rounded-md px-12 py-8 text-left text-small font-semibold transition ${activeTab === 'bookings' ? 'bg-brand-andaman-soft text-brand-andaman' : 'text-text-secondary hover:bg-surface-ivory hover:text-text-ink'}`}
              >
                {labels['mc.workspace.reservations']}
              </button>
              <Link
                href={`/mc/calendar?projectId=${encodeURIComponent(activeContext?.projectId || '')}&organizationId=${encodeURIComponent(activeContext?.organizationId || '')}`}
                className="whitespace-nowrap rounded-md px-12 py-8 text-left text-small font-semibold text-text-secondary hover:bg-surface-ivory hover:text-text-ink"
              >
                {labels['mc.tabs.calendar']}
              </Link>
              <Link
                href={`/mc/tm30?projectId=${encodeURIComponent(activeContext?.projectId || '')}&organizationId=${encodeURIComponent(activeContext?.organizationId || '')}`}
                className="whitespace-nowrap rounded-md px-12 py-8 text-left text-small font-semibold text-text-secondary hover:bg-surface-ivory hover:text-text-ink"
              >
                {labels['mc.workspace.guests']}
              </Link>
              <Link
                href="/ops/tasks?mc=1"
                className="whitespace-nowrap rounded-md px-12 py-8 text-left text-small font-semibold text-text-secondary hover:bg-surface-ivory hover:text-text-ink"
              >
                {labels['mc.workspace.tasks']}
              </Link>

              <div className="hidden lg:block my-8 border-t border-border-line" />
              <p className="hidden px-12 pt-4 text-caption font-semibold uppercase tracking-[0.12em] text-text-secondary lg:block">
                {labels['mc.workspace.manage']}
              </p>
              <Link href={`/mc?projectId=${encodeURIComponent(activeContext?.projectId || '')}&organizationId=${encodeURIComponent(activeContext?.organizationId || '')}#managed-properties`} className="whitespace-nowrap rounded-md px-12 py-8 text-small font-medium text-text-secondary hover:bg-surface-ivory hover:text-text-ink">
                {labels['mc.workspace.portfolio']}
              </Link>
              <button
                type="button"
                onClick={() => setActiveTab('service_orders')}
                className={`whitespace-nowrap rounded-md px-12 py-8 text-left text-small font-medium transition ${activeTab === 'service_orders' ? 'bg-brand-andaman-soft text-brand-andaman' : 'text-text-secondary hover:bg-surface-ivory hover:text-text-ink'}`}
              >
                {labels['mc.workspace.services']}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('tickets')}
                className={`whitespace-nowrap rounded-md px-12 py-8 text-left text-small font-medium transition ${activeTab === 'tickets' ? 'bg-brand-andaman-soft text-brand-andaman' : 'text-text-secondary hover:bg-surface-ivory hover:text-text-ink'}`}
              >
                {labels['mc.workspace.issues']}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('reports')}
                className={`whitespace-nowrap rounded-md px-12 py-8 text-left text-small font-medium transition ${activeTab === 'reports' ? 'bg-brand-andaman-soft text-brand-andaman' : 'text-text-secondary hover:bg-surface-ivory hover:text-text-ink'}`}
              >
                {labels['mc.workspace.revenue_finance']}
              </button>
              <Link href={`/mc/mobilization?projectId=${encodeURIComponent(activeContext?.projectId || '')}&organizationId=${encodeURIComponent(activeContext?.organizationId || '')}`} className="hidden lg:block rounded-md px-12 py-8 text-small font-medium text-text-secondary hover:bg-surface-ivory hover:text-text-ink">
                {labels['mc.nav.mobilization']}
              </Link>
              <Link href={`/mc/costs?projectId=${encodeURIComponent(activeContext?.projectId || '')}&organizationId=${encodeURIComponent(activeContext?.organizationId || '')}`} className="hidden lg:block rounded-md px-12 py-8 text-small font-medium text-text-secondary hover:bg-surface-ivory hover:text-text-ink">
                {labels['mc.workspace.costs']}
              </Link>
              <Link href="/announcements" className="hidden lg:block rounded-md px-12 py-8 text-small font-medium text-text-secondary hover:bg-surface-ivory hover:text-text-ink">
                {labels['mc.workspace.announcements']}
              </Link>
            </div>
          </nav>
        </aside>

        <div className="min-w-0">
          {icalConflicts.length > 0 && (
            <section className="px-16 lg:px-24 pt-24">
              <UnitIcalConflictBanner
                conflicts={icalConflicts}
                labels={labels}
                calendarSurface={UNIT_ICAL_CALENDAR_SURFACES.mc}
              />
            </section>
          )}

          {activeTab === 'overview' && (
            <section className="px-16 lg:px-24 pt-24">
              <div className="mb-16">
                <p className="text-small font-semibold uppercase tracking-[0.08em] text-text-secondary">{labels['mc.workspace.portfolio_pulse']}</p>
                <div className="mt-8 grid grid-cols-2 gap-8 sm:grid-cols-3 xl:grid-cols-6">
                  {[
                    [labels['mc.stats.units'], units.length],
                    [labels['mc.workspace.arrivals'], arrivalsToday],
                    [labels['mc.workspace.departures'], departuresToday],
                    [labels['mc.attention.requests'], requestedBookings],
                    [labels['mc.workspace.payment_issues'], pendingPayments.length],
                    [labels['mc.workspace.channel_issues'], icalConflicts.length],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-lg border border-border-line bg-surface-paper p-12">
                      <p className="text-caption text-text-secondary">{label}</p>
                      <p className="mt-4 font-display text-heading-2 font-semibold tabular-nums text-text-ink">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-16 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)]">
                <div className="rounded-lg border border-border-line bg-surface-paper p-20">
                  <div className="flex items-center justify-between gap-12 mb-16">
                    <div>
                      <p className="text-small font-semibold uppercase tracking-[0.08em] text-text-secondary">{labels['mc.workspace.today']}</p>
                      <h2 className="mt-4 text-heading-2 font-bold text-text-ink">{labels['mc.workspace.timeline']}</h2>
                    </div>
                    <Link
                      href={`/mc/calendar?projectId=${encodeURIComponent(activeContext?.projectId || '')}&organizationId=${encodeURIComponent(activeContext?.organizationId || '')}`}
                      className="text-small font-semibold text-brand-andaman hover:underline"
                    >
                      {labels['mc.workspace.full_calendar']} →
                    </Link>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-12">
                    {[
                      [labels['mc.workspace.arrivals'], arrivalsToday, labels['mc.workspace.arrivals_hint'], 'arrivals'],
                      [labels['mc.workspace.departures'], departuresToday, labels['mc.workspace.departures_hint'], 'departures'],
                      [labels['mc.workspace.in_house'], inHouseNow, labels['mc.workspace.in_house_hint'], 'in_house'],
                    ].map(([label, value, hint, view]) => (
                      <button key={String(label)} type="button"
                        onClick={() => { setReservationView(view as typeof reservationView); setActiveTab('bookings'); }}
                        className="rounded-md bg-surface-ivory p-16 text-left transition hover:ring-1 hover:ring-brand-andaman">
                        <p className="text-small font-semibold text-text-ink">{label}</p>
                        <p className="mt-4 font-display text-display-lg font-semibold tabular-nums text-brand-andaman">{value}</p>
                        <p className="mt-8 text-small text-text-secondary">{hint}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-border-line bg-surface-paper p-20">
                  <p className="text-small font-semibold uppercase tracking-[0.08em] text-text-secondary">{labels['mc.attention.title']}</p>
                  <h2 className="mt-4 text-heading-2 font-bold text-text-ink">{labels['mc.workspace.action_queue']}</h2>
                  <div className="mt-16 space-y-8">
                    {[
                      [labels['mc.attention.requests'], requestedBookings, 'bookings' as const],
                      [labels['mc.attention.tickets'], dashboard.openTicketsCount, 'tickets' as const],
                      [labels['mc.attention.services'], actionableServiceOrders, 'service_orders' as const],
                      [labels['mc.workspace.pending_payments'], pendingPayments.length, 'bookings' as const],
                    ].map(([label, count, target]) => (
                      <button
                        key={String(label)}
                        type="button"
                        onClick={() => setActiveTab(target as typeof activeTab)}
                        className="w-full flex items-center justify-between rounded-md border border-border-line px-12 py-8 text-left hover:border-brand-andaman"
                      >
                        <span className="text-small text-text-ink">{label}</span>
                        <span className="font-semibold tabular-nums text-brand-andaman">{count} →</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-16 rounded-lg border border-border-line bg-surface-paper p-20">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-small font-semibold uppercase tracking-[0.08em] text-text-secondary">
                      {labels['mc.workspace.health']}
                    </p>
                    <h2 className="mt-4 text-heading-2 font-bold text-text-ink">
                      {labels['mc.workspace.health_title']}
                    </h2>
                  </div>
                  <Link href="/ops/tasks?mc=1" className="text-small font-semibold text-brand-andaman hover:underline">
                    {labels['mc.workspace.open_tasks']} →
                  </Link>
                </div>
                <div className="mt-16 grid gap-12 sm:grid-cols-2 xl:grid-cols-4">
                  <button type="button" onClick={() => { setReservationView('all'); setActiveTab('bookings'); }} className="rounded-md bg-surface-ivory p-16 text-left hover:ring-1 hover:ring-brand-andaman">
                    <p className="text-small font-semibold text-text-ink">{labels['mc.workspace.health_payments']}</p>
                    <p className="mt-4 font-display text-display-lg font-semibold tabular-nums text-brand-andaman">{pendingPayments.length}</p>
                    <p className="mt-8 text-small text-text-secondary">{pendingPayments.length ? labels['mc.workspace.action_required'] : labels['mc.workspace.clear']}</p>
                  </button>
                  <Link href={`/mc/calendar?projectId=${encodeURIComponent(activeContext?.projectId || '')}&organizationId=${encodeURIComponent(activeContext?.organizationId || '')}`} className="rounded-md bg-surface-ivory p-16 text-left hover:ring-1 hover:ring-brand-andaman">
                    <p className="text-small font-semibold text-text-ink">{labels['mc.workspace.health_channels']}</p>
                    <p className="mt-4 font-display text-display-lg font-semibold tabular-nums text-brand-andaman">{icalConflicts.length}</p>
                    <p className="mt-8 text-small text-text-secondary">{icalConflicts.length ? labels['mc.workspace.action_required'] : labels['mc.workspace.clear']}</p>
                  </Link>
                  <button type="button" onClick={() => setActiveTab('tickets')} className="rounded-md bg-surface-ivory p-16 text-left hover:ring-1 hover:ring-brand-andaman">
                    <p className="text-small font-semibold text-text-ink">{labels['mc.workspace.health_issues']}</p>
                    <p className="mt-4 font-display text-display-lg font-semibold tabular-nums text-brand-andaman">{dashboard.openTicketsCount}</p>
                    <p className="mt-8 text-small text-text-secondary">{dashboard.openTicketsCount ? labels['mc.workspace.review'] : labels['mc.workspace.clear']}</p>
                  </button>
                  <button type="button" onClick={() => setActiveTab('service_orders')} className="rounded-md bg-surface-ivory p-16 text-left hover:ring-1 hover:ring-brand-andaman">
                    <p className="text-small font-semibold text-text-ink">{labels['mc.workspace.health_services']}</p>
                    <p className="mt-4 font-display text-display-lg font-semibold tabular-nums text-brand-andaman">{actionableServiceOrders}</p>
                    <p className="mt-8 text-small text-text-secondary">{actionableServiceOrders ? labels['mc.workspace.review'] : labels['mc.workspace.clear']}</p>
                  </button>
                </div>
              </div>

              <div id="managed-properties" className="mt-16 rounded-lg border border-border-line bg-surface-paper p-20 scroll-mt-24">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-small font-semibold uppercase tracking-[0.08em] text-text-secondary">{labels['mc.workspace.portfolio']}</p>
                    <h2 className="mt-4 text-heading-2 font-bold text-text-ink">{labels['mc.workspace.managed_properties']}</h2>
                    <p className="mt-4 max-w-3xl text-small text-text-secondary">{labels['mc.workspace.managed_properties_hint']}</p>
                  </div>
                  <Link href={`/mc/calendar?projectId=${encodeURIComponent(activeContext?.projectId || '')}&organizationId=${encodeURIComponent(activeContext?.organizationId || '')}`} className="text-small font-semibold text-brand-andaman hover:underline">
                    {labels['mc.workspace.view_all_calendar']} →
                  </Link>
                </div>
                {units.length === 0 ? (
                  <p className="mt-16 text-small text-text-secondary">{labels['mc.workspace.no_properties']}</p>
                ) : (
                  <div className="mt-16 grid gap-12 md:grid-cols-2 xl:grid-cols-3">
                    {units.map((unit) => (
                      <Link key={unit.id} href={`/mc/properties/${encodeURIComponent(unit.id)}?tab=overview`} className="rounded-lg border border-border-line bg-surface-ivory p-16 transition hover:border-brand-andaman hover:bg-surface-paper">
                        <div className="flex items-start justify-between gap-8">
                          <div>
                            <p className="font-semibold text-text-ink">{unit.name}</p>
                            <p className="mt-4 text-small text-text-secondary">{statusLabel(unit.status)}</p>
                          </div>
                          <span className="text-small font-semibold text-brand-andaman">{labels['mc.workspace.open_property']} →</span>
                        </div>
                        <p className="mt-12 text-small text-text-secondary">฿{unit.baseNightlyThb.toLocaleString()} {labels['mc.units.per_night']}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

      {/* Content */}
      <section className="max-w-7xl mx-auto px-24 py-40">
        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <div>
            <div className="mb-20 flex flex-col gap-12 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-small font-semibold uppercase tracking-[0.08em] text-text-secondary">
                  {labels['mc.workspace.reservations']}
                </p>
                <h2 className="mt-4 text-heading-2 font-bold text-text-ink">
                  {labels['mc.bookings.title']}
                </h2>
              </div>
              <div className="flex gap-8 overflow-x-auto" role="group" aria-label={labels['mc.workspace.reservation_views']}>
                {[
                  ['requests', labels['mc.workspace.requests']],
                  ['arrivals', labels['mc.workspace.arrivals']],
                  ['in_house', labels['mc.workspace.in_house']],
                  ['departures', labels['mc.workspace.departures']],
                  ['all', labels['mc.workspace.all_reservations']],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setReservationView(key as typeof reservationView)}
                    className={`min-h-40 whitespace-nowrap rounded-full border px-12 text-small font-semibold transition ${
                      reservationView === key
                        ? 'border-brand-andaman bg-brand-andaman text-white'
                        : 'border-border-line bg-surface-paper text-text-secondary hover:text-text-ink'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {bookingError && (
              <div className="mb-16 bg-state-error-soft border border-state-error rounded-lg p-12">
                <p className="text-small text-state-error">{bookingError}</p>
              </div>
            )}
            <div className="bg-surface-paper border border-border-line rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-ivory border-b border-border-line">
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
                    {visibleBookings.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center p-24 text-text-secondary">
                          {labels['mc.bookings.empty']}
                        </td>
                      </tr>
                    ) : (
                      visibleBookings.map((booking) => (
                        <tr key={booking.id} className="border-b border-border-line hover:bg-surface-ivory">
                          <td className="p-16 text-body font-semibold text-text-ink">
                            <Link href={`/mc/properties/${encodeURIComponent(booking.unit.id)}?tab=overview&date=${encodeURIComponent(new Date(booking.startDate).toISOString().slice(0,10))}`} className="hover:text-brand-andaman hover:underline">
                              {booking.unit.name}
                            </Link>
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
                              className={`inline-flex items-center px-12 py-4 rounded-full text-small font-medium ${
                                statusClasses(booking.status)
                              }`}
                            >
                              {statusLabel(booking.status)}
                            </span>
                            {booking.status === 'requested' && booking.requestExpiresAt ? (
                              <p className="text-caption text-state-warning mt-4">
                                {labels['mc.bookings.request_expires']}:{' '}
                                {new Date(booking.requestExpiresAt).toLocaleString()}
                              </p>
                            ) : null}
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
                            className={`inline-flex items-center px-12 py-4 rounded-full text-small font-medium ${
                              statusClasses(ticket.status)
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
                      <Link href={`/mc/properties/${encodeURIComponent(ticket.unit.id)}?tab=operations`} className="font-semibold text-brand-andaman hover:underline">{ticket.unit.name}</Link> · {labels['mc.tickets.reported_by']} {ticket.raisedBy.firstName}
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
            <div className="bg-surface-paper border border-border-line rounded-lg p-20 mb-20">
              <p className="text-body text-text-secondary mb-12">
                {labels['mc.service_orders.order_hint']}
              </p>
              {units.length > 0 ? (
                <div className="flex flex-col sm:flex-row gap-12 items-stretch sm:items-end">
                  <label className="flex-1 block">
                    <span className="text-small text-text-secondary">
                      {labels['mc.service_orders.unit_label']}
                    </span>
                    <select
                      value={serviceUnitId}
                      onChange={(event) => setServiceUnitId(event.target.value)}
                      className="mt-4 w-full h-48 rounded-sm border border-border-line bg-surface-ivory px-12 text-body text-text-ink"
                    >
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Link
                    href={`/services?projectId=${encodeURIComponent(dashboard.projectId)}&unitId=${encodeURIComponent(serviceUnitId)}&context=mc`}
                    className="inline-flex items-center justify-center h-48 px-20 rounded-md bg-brand-andaman text-surface-ivory font-semibold hover:bg-brand-deep transition-colors"
                  >
                    {labels['mc.service_orders.browse']}
                  </Link>
                </div>
              ) : (
                <p className="text-small text-text-secondary">{labels['mc.units.empty']}</p>
              )}
            </div>
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
                        className={`inline-flex items-center px-12 py-4 rounded-full text-small font-medium ${
                          statusClasses(order.status)
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
                            className="h-40 px-12 rounded-sm bg-surface-paper border border-border-line text-small text-text-ink focus:border-brand-andaman focus:outline-none"
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

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="bg-surface-paper border border-border-line rounded-lg p-24">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-16 mb-20">
              <h2 className="text-heading-2 font-bold text-text-ink">
                {labels['mc.reports.title']}
              </h2>
              <div className="flex flex-wrap items-end gap-12">
                <label className="block">
                  <span className="text-small text-text-secondary">
                    {labels['mc.reports.period_label']}
                  </span>
                  <input
                    type="month"
                    value={reportMonth}
                    onChange={(event) => setReportMonth(event.target.value)}
                    className="mt-4 block h-40 rounded-sm border border-border-line bg-surface-ivory px-12 text-body text-text-ink"
                  />
                </label>
                <button
                  type="button"
                  onClick={exportFeeReportCsv}
                  disabled={!feeReport || feeReport.feeLines.length === 0}
                  className="h-40 px-16 rounded-md border border-brand-andaman text-brand-andaman font-semibold hover:bg-brand-andaman-soft disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {labels['mc.reports.export_csv']}
                </button>
              </div>
            </div>
            {feeReportError && (
              <div className="mb-16 bg-state-error-soft border border-state-error rounded-lg p-12">
                <p className="text-small text-state-error">{feeReportError}</p>
              </div>
            )}
            {feeReportLoading ? (
              <p className="text-body text-text-secondary">{labels['mc.reports.loading']}</p>
            ) : !feeReport || feeReport.feeLines.length === 0 ? (
              <p className="text-body text-text-secondary">{labels['mc.reports.empty']}</p>
            ) : (
              <div>
                <p className="text-small text-text-secondary mb-16">
                  {formatReportPeriod(
                    String(feeReport.periodStart),
                    String(feeReport.periodEnd)
                  )}
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
        </div>
      </div>

      <CheckInConditionReportModal
        bookingId={checkinBooking?.id ?? null}
        guestName={checkinBooking?.guestIdentity.firstName ?? ''}
        unitName={checkinBooking?.unit.name ?? ''}
        labels={labels}
        onClose={() => setCheckinBooking(null)}
        onComplete={() => router.refresh()}
      />

      <CheckOutConditionReportModal
        bookingId={checkoutBooking?.id ?? null}
        guestName={checkoutBooking?.guestIdentity.firstName ?? ''}
        unitName={checkoutBooking?.unit.name ?? ''}
        labels={labels}
        onClose={() => setCheckoutBooking(null)}
        onComplete={() => router.refresh()}
      />
    </main>
  );
}
