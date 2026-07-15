'use client';

import React, { useState } from 'react';
import Link from 'next/link';

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
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  createdAt: Date;
  updatedAt: Date;
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
  openTicketsCount: number;
}

interface FeeLine {
  unitName?: string;
  description?: string;
  source?: string;
  feeThb?: number;
  feeAmount?: number;
}

interface FeeReport {
  periodStart: string | Date;
  periodEnd: string | Date;
  feeLines: FeeLine[];
  summaryThb: { grossAmount: number; platformFeeAmount: number };
}

interface MCDashboardClientProps {
  dashboard: DashboardData;
  units: Unit[];
  bookings: Booking[];
  tickets: Ticket[];
  feeReport?: FeeReport | null;
}

export function MCDashboardClient({
  dashboard,
  units,
  bookings,
  tickets,
  feeReport,
}: MCDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'tickets' | 'calendar' | 'reports'>('overview');

  return (
    <main className="min-h-screen bg-surface-background">
      {/* Header */}
      <section className="bg-white border-b border-border-line px-24 py-16">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-heading-1 font-bold text-text-ink mb-4">Management Company Portal</h1>
          <p className="text-body text-text-secondary">
            Manage your units, bookings, and operations
          </p>
        </div>
      </section>

      {/* Navigation Tabs */}
      <section className="bg-white border-b border-border-line sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-24">
          <div className="flex gap-32">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-16 font-semibold text-body border-b-3 transition ${
                activeTab === 'overview'
                  ? 'border-brand-andaman text-brand-andaman'
                  : 'border-transparent text-text-secondary hover:text-text-ink'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('bookings')}
              className={`py-16 font-semibold text-body border-b-3 transition ${
                activeTab === 'bookings'
                  ? 'border-brand-andaman text-brand-andaman'
                  : 'border-transparent text-text-secondary hover:text-text-ink'
              }`}
            >
              Bookings
            </button>
            <button
              onClick={() => setActiveTab('tickets')}
              className={`py-16 font-semibold text-body border-b-3 transition ${
                activeTab === 'tickets'
                  ? 'border-brand-andaman text-brand-andaman'
                  : 'border-transparent text-text-secondary hover:text-text-ink'
              }`}
            >
              Tickets
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`py-16 font-semibold text-body border-b-3 transition ${
                activeTab === 'calendar'
                  ? 'border-brand-andaman text-brand-andaman'
                  : 'border-transparent text-text-secondary hover:text-text-ink'
              }`}
            >
              Calendar
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`py-16 font-semibold text-body border-b-3 transition ${
                activeTab === 'reports'
                  ? 'border-brand-andaman text-brand-andaman'
                  : 'border-transparent text-text-secondary hover:text-text-ink'
              }`}
            >
              Fee Reports
            </button>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-7xl mx-auto px-24 py-40">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div>
            {/* Stats Tiles */}
            <div className="grid grid-cols-3 gap-24 mb-40">
              <div className="bg-white border border-border-line rounded-lg p-24">
                <p className="text-small text-text-secondary mb-8">Managed Units</p>
                <div className="text-heading-2 font-bold text-brand-andaman">
                  {dashboard.unitsCount}
                </div>
              </div>
              <div className="bg-white border border-border-line rounded-lg p-24">
                <p className="text-small text-text-secondary mb-8">Bookings This Month</p>
                <div className="text-heading-2 font-bold text-brand-andaman">
                  {dashboard.bookingsThisMonth}
                </div>
              </div>
              <div className="bg-white border border-border-line rounded-lg p-24">
                <p className="text-small text-text-secondary mb-8">Open Tickets</p>
                <div className="text-heading-2 font-bold text-brand-andaman">
                  {dashboard.openTicketsCount}
                </div>
              </div>
            </div>

            {/* Managed Units List */}
            <div className="bg-white border border-border-line rounded-lg p-24">
              <h2 className="text-heading-2 font-bold text-text-ink mb-20">Your Managed Units</h2>
              <div className="space-y-16">
                {units.length === 0 ? (
                  <p className="text-body text-text-secondary">No units under management</p>
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
                              ฿{unit.baseNightlyThb.toLocaleString()} / night
                            </span>
                            <span className="text-small font-semibold text-brand-andaman">
                              {unit.status}
                            </span>
                          </div>
                        </div>
                        <Link
                          href={`/units/${unit.id}`}
                          className="text-brand-andaman font-semibold hover:underline"
                        >
                          Manage →
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
            <h2 className="text-heading-2 font-bold text-text-ink mb-20">Bookings</h2>
            <div className="bg-white border border-border-line rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-background border-b border-border-line">
                    <tr>
                      <th className="text-left p-16 font-bold text-text-ink">Unit</th>
                      <th className="text-left p-16 font-bold text-text-ink">Guest</th>
                      <th className="text-left p-16 font-bold text-text-ink">Check-in</th>
                      <th className="text-left p-16 font-bold text-text-ink">Check-out</th>
                      <th className="text-left p-16 font-bold text-text-ink">Amount</th>
                      <th className="text-left p-16 font-bold text-text-ink">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center p-24 text-text-secondary">
                          No bookings
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
                            {booking.startDate.toLocaleDateString()}
                          </td>
                          <td className="p-16 text-small text-text-secondary">
                            {booking.endDate.toLocaleDateString()}
                          </td>
                          <td className="p-16 text-body font-semibold text-text-ink">
                            ฿{booking.totalThb.toLocaleString()}
                          </td>
                          <td className="p-16">
                            <span className={`inline-flex items-center px-12 py-6 rounded-full text-small font-medium ${
                              booking.status === 'confirmed'
                                ? 'bg-green-100 text-green-700'
                                : booking.status === 'checked_in'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {booking.status.replace(/_/g, ' ')}
                            </span>
                          </td>
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
            <h2 className="text-heading-2 font-bold text-text-ink mb-20">Tickets</h2>
            <div className="space-y-16">
              {tickets.length === 0 ? (
                <div className="bg-white border border-border-line rounded-lg p-24 text-center">
                  <p className="text-text-secondary">No open tickets</p>
                </div>
              ) : (
                tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="bg-white border border-border-line rounded-lg p-20 hover:shadow-md transition"
                  >
                    <div className="flex justify-between items-start mb-12">
                      <div>
                        <div className="flex items-center gap-12">
                          <span className={`inline-flex items-center px-12 py-6 rounded-full text-small font-medium ${
                            ticket.status === 'open'
                              ? 'bg-red-100 text-red-700'
                              : ticket.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {ticket.status}
                          </span>
                        </div>
                        <h3 className="text-heading-3 font-bold text-text-ink mt-8">
                          {ticket.title}
                        </h3>
                      </div>
                      <Link
                        href={`/tickets`}
                        className="text-brand-andaman font-semibold hover:underline"
                      >
                        View →
                      </Link>
                    </div>
                    <p className="text-small text-text-secondary">
                      {ticket.unit.name} · Reported by {ticket.raisedBy.firstName}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Calendar Tab */}
        {activeTab === 'calendar' && (
          <div className="bg-white border border-border-line rounded-lg p-24">
            <h2 className="text-heading-2 font-bold text-text-ink mb-20">Calendar View</h2>
            {bookings.length === 0 ? (
              <p className="text-body text-text-secondary">No bookings in the period.</p>
            ) : (
              units.map((unit) => {
                const unitBookings = bookings.filter((b) => b.unit?.id === unit.id);
                return (
                  <div key={unit.id} className="mb-20">
                    <p className="text-body font-semibold text-text-ink mb-8">{unit.name}</p>
                    {unitBookings.length === 0 ? (
                      <p className="text-small text-text-secondary">Free — no bookings.</p>
                    ) : (
                      unitBookings.map((b) => (
                        <p key={b.id} className="text-small text-text-secondary">
                          {new Date(b.startDate).toLocaleDateString()} — {new Date(b.endDate).toLocaleDateString()} · {b.status}
                        </p>
                      ))
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="bg-white border border-border-line rounded-lg p-24">
            <h2 className="text-heading-2 font-bold text-text-ink mb-20">Fee Reports</h2>
            {!feeReport ? (
              <p className="text-body text-text-secondary">No fee data for this period.</p>
            ) : (
              <div>
                <p className="text-small text-text-secondary mb-16">
                  {new Date(feeReport.periodStart).toLocaleDateString()} — {new Date(feeReport.periodEnd).toLocaleDateString()}
                </p>
                <div className="grid grid-cols-2 gap-16 mb-24">
                  <div className="bg-surface-background rounded-lg p-16">
                    <p className="text-small text-text-secondary">Gross revenue</p>
                    <p className="text-heading-2 font-bold text-text-ink">฿{feeReport.summaryThb.grossAmount.toLocaleString()}</p>
                  </div>
                  <div className="bg-surface-background rounded-lg p-16">
                    <p className="text-small text-text-secondary">Platform fees</p>
                    <p className="text-heading-2 font-bold text-brand-andaman">฿{feeReport.summaryThb.platformFeeAmount.toLocaleString()}</p>
                  </div>
                </div>
                {feeReport.feeLines.length > 0 && (
                  <div>
                    {feeReport.feeLines.map((line, i) => (
                      <div key={i} className="flex justify-between py-8 border-b border-border-line last:border-b-0 text-small">
                        <span className="text-text-secondary">{line.unitName || line.description || line.source}</span>
                        <span className="text-text-ink font-semibold">฿{(line.feeThb ?? line.feeAmount ?? 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
