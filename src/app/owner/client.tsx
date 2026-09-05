'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Button,
  StatTile,
  ProjectSwitcher,
  BookingsList,
  LatestStatementCard,
  OpenTicketsList,
  SellInterestCard,
  OwnerStayModal,
  MoneyAmount,
  RoleContextBanner,
  Chip,
} from '@/components';
import { BarChart, LineChart, Sparkline, DeltaChip, CHART_SERIES, formatThbCompact } from '@/components/viz';
import type { OwnerTrends } from '@/app/actions/getOwnerDashboard';
import type { OwnerAlert, OwnerComplianceStatus } from '@/modules/projects';
import type { OwnerStatement } from '@prisma/client';

function fill(template: string, params?: Record<string, string>): string {
  if (!params) return template;
  let output = template;
  for (const [key, value] of Object.entries(params)) {
    output = output.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return output;
}

interface UnitData {
  id: string;
  name: string;
  projectId: string;
  occupancyThisMonth: number;
  revenueThisMonth: number;
  nextArrivalDate: Date | null;
  bookingsCount: number;
  openTicketsCount: number;
  openTickets: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
    unitName: string;
  }>;
  latestStatementId: string | null;
}

interface DashboardData {
  identityId: string;
  units: UnitData[];
  combinedOccupancyThisMonth: number;
  combinedRevenueThisMonth: number;
  alertsCount: number;
}

interface PortfolioShape {
  unitCount: number;
  projectCount: number;
  isPortfolio: boolean;
  projectIds: string[];
}

interface Project {
  id: string;
  name: string;
  slug: string;
  _count: {
    units: number;
  };
}

interface Booking {
  id: string;
  startDate: string;
  endDate: string;
  totalThb: number;
  guestIdentity: {
    id: string;
    firstName: string;
  };
  guests: Array<{
    nationality: string;
  }>;
}

interface OwnerDashboardClientProps {
  dashboard: DashboardData;
  shape: PortfolioShape;
  projects: Project[];
  bookings: Booking[];
  trends: OwnerTrends;
  alerts: OwnerAlert[];
  complianceSummary: OwnerComplianceStatus[];
  statements: OwnerStatement[];
  labels: Record<string, string>;
  locale: string;
  activeStay?: { bookingId: string; unitName: string } | null;
}

export const OwnerDashboardClient: React.FC<OwnerDashboardClientProps> = ({
  dashboard,
  shape,
  projects,
  bookings,
  trends,
  alerts,
  complianceSummary,
  statements,
  labels,
  locale,
  activeStay,
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showOwnerStayModal, setShowOwnerStayModal] = useState(false);
  const [ownerStayLoading, setOwnerStayLoading] = useState(false);

  const handleOwnerStay = async (unitId: string, startDate: Date, endDate: Date) => {
    setOwnerStayLoading(true);
    try {
      const response = await fetch('/api/owner-stays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitId, startDate, endDate }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || labels['owner.stay.error']);
      }
      setShowOwnerStayModal(false);
      window.location.reload();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : labels['owner.stay.error']);
    } finally {
      setOwnerStayLoading(false);
    }
  };

  const handleExpressSellInterest = async () => {
    // Sell-interest card -> a general thread with the admins (doc 07 F-OWN)
    const response = await fetch('/api/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contextType: 'general',
        body: '[sell-interest]',
      }),
    });
    if (response.ok) {
      const data = await response.json();
      window.location.href = `/messages/${data.threadId}`;
    }
  };

  const isSingleUnit = !shape.isPortfolio;
  const currentUnit = isSingleUnit ? dashboard.units[0] : null;
  const filteredUnits = selectedProjectId
    ? dashboard.units.filter((u) => u.projectId === selectedProjectId)
    : dashboard.units;
  const portfolioOpenTickets = filteredUnits
    .flatMap((unit) =>
      unit.openTickets.map((ticket) => ({
        ...ticket,
        unitName: ticket.unitName || unit.name,
      }))
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const occupancyNow = shape.isPortfolio
    ? dashboard.combinedOccupancyThisMonth
    : currentUnit?.occupancyThisMonth || 0;
  const revenueNow = shape.isPortfolio
    ? dashboard.combinedRevenueThisMonth
    : currentUnit?.revenueThisMonth || 0;

  const chartLabels = {
    tableToggleLabels: {
      show: labels['owner.chart.show_table'],
      hide: labels['owner.chart.hide_table'],
    },
    labelHeader: labels['owner.chart.month'],
    emptyLabel: labels['owner.trends.empty'],
  };

  const resolveLabel = (key: string, params?: Record<string, string>) =>
    fill(labels[key] || key, params);

  const statementChipStatus = (status: string) => {
    if (status === 'distributed' || status === 'signed_off') return 'confirmed' as const;
    if (status === 'pending_owner_review') return 'requested' as const;
    return 'default' as const;
  };

  const ticketHref = (unit: { id: string; projectId: string }) =>
    `/tickets/new?projectId=${unit.projectId}&unitId=${unit.id}`;

  const serviceHref = (unit: { id: string; projectId: string }) =>
    `/services?projectId=${unit.projectId}&unitId=${unit.id}`;

  const OwnerQuickActions = ({
    unit,
  }: {
    unit: { id: string; projectId: string; name: string };
  }) => (
    <div className="flex flex-col sm:flex-row gap-12">
      <Link href={ticketHref(unit)} className="flex-1">
        <Button variant="secondary" size="md" fullWidth>
          {labels['owner.actions.raise_ticket']}
        </Button>
      </Link>
      <Link href={serviceHref(unit)} className="flex-1">
        <Button variant="secondary" size="md" fullWidth>
          {labels['owner.actions.book_service']}
        </Button>
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-ivory">
      <div className="max-w-6xl mx-auto px-24 py-40">
        <div className="mb-40">
          <h1 className="font-display text-display-xl font-semibold text-text-ink mb-8">
            {labels['owner.dashboard.title']}
          </h1>
          <p className="text-body text-text-stone">
            {shape.isPortfolio
              ? fill(labels['owner.dashboard.portfolio_subtitle'] ?? '', {
                  units: String(shape.unitCount),
                  projects: String(shape.projectCount),
                })
              : labels['owner.dashboard.subtitle']}
          </p>
        </div>

        {activeStay ? (
          <RoleContextBanner
            message={(labels['owner.role_context'] ?? '').replace('{unit}', activeStay.unitName)}
            action={{
              label: labels['owner.role_context.stay_link'],
              href: `/bookings/${activeStay.bookingId}/home-space`,
            }}
          />
        ) : null}

        {/* Portfolio: Project Switcher */}
        {shape.isPortfolio && (
          <div className="mb-40">
            <ProjectSwitcher
              projects={projects}
              selectedProjectId={selectedProjectId}
              onProjectChange={setSelectedProjectId}
              labels={{
                selectProject: labels['owner.switcher.select_project'],
                unitSingular: labels['owner.switcher.unit_singular'],
                unitPlural: labels['owner.switcher.unit_plural'],
                allProjects: labels['owner.switcher.all_projects'],
              }}
            />
          </div>
        )}

        {/* Alerts Section (D2) */}
        {alerts.length > 0 && (
          <div className="mb-40">
            <h2 className="font-display text-display font-semibold text-text-ink mb-16">
              {labels['owner.alerts.title']}
            </h2>
            <div className="space-y-12">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`bg-surface-paper border rounded-md p-16 ${
                    alert.severity === 'critical'
                      ? 'border-state-error bg-state-error-soft'
                      : 'border-state-warning bg-state-warning-soft'
                  }`}
                >
                  <div className="flex items-start justify-between gap-12">
                    <div>
                      <h3 className="text-body font-semibold text-text-ink mb-4">
                        {resolveLabel(alert.titleKey, alert.titleParams)}
                      </h3>
                      <p className="text-body text-text-secondary">
                        {resolveLabel(alert.descriptionKey, alert.descriptionParams)}
                      </p>
                      <p className="text-sm text-text-secondary mt-4">{alert.unitName}</p>
                    </div>
                    {alert.actionUrl && (
                      <Link href={alert.actionUrl}>
                        <Button variant="secondary" size="sm">
                          {labels['owner.alert.action_view']}
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stat Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-20 mb-40">
          <StatTile
            label={labels['owner.dashboard.occupancy_this_month']}
            value={`${occupancyNow} ${labels['owner.stats.nights']}`}
            variant="occupancy"
            delta={
              <DeltaChip
                currentValue={occupancyNow}
                previousValue={trends.prevMonth ? trends.prevMonth.nights : null}
                vsLabel={labels['owner.stats.vs_last_month']}
                newLabel={labels['owner.stats.new_period']}
              />
            }
          />
          <StatTile
            label={labels['owner.dashboard.revenue_this_month']}
            value={<MoneyAmount satang={revenueNow * 100} />}
            variant="revenue"
            delta={
              <DeltaChip
                currentValue={revenueNow}
                previousValue={trends.prevMonth ? trends.prevMonth.revenueThb : null}
                vsLabel={labels['owner.stats.vs_last_month']}
                newLabel={labels['owner.stats.new_period']}
              />
            }
          />
        </div>

        {/* Trends — last 6 months from the analytics rollup */}
        <div className="mb-40">
          <h2 className="font-display text-display font-semibold text-text-ink mb-16">
            {labels['owner.trends.title']}
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24">
            <div className="bg-surface-paper border border-border-line rounded-lg p-24">
              <h3 className="font-display text-title font-semibold text-text-ink mb-16">
                {labels['owner.trends.revenue']}
              </h3>
              <BarChart
                data={trends.monthly.map((p) => ({
                  label: new Date(`${p.period}-01T00:00:00Z`).toLocaleDateString(locale, {
                    month: 'short',
                    timeZone: 'UTC',
                  }),
                  value: p.rentalRevenueThb,
                }))}
                color={CHART_SERIES[0]}
                formatValue={formatThbCompact}
                valueHeader={labels['owner.chart.revenue']}
                {...chartLabels}
              />
            </div>
            <div className="bg-surface-paper border border-border-line rounded-lg p-24">
              <h3 className="font-display text-title font-semibold text-text-ink mb-16">
                {labels['owner.trends.occupancy']}
              </h3>
              <LineChart
                data={trends.monthly.map((p) => ({
                  label: new Date(`${p.period}-01T00:00:00Z`).toLocaleDateString(locale, {
                    month: 'short',
                    timeZone: 'UTC',
                  }),
                  value: Math.round(p.occupancyPct),
                }))}
                max={100}
                formatValue={(v) => `${v}%`}
                valueHeader={labels['owner.chart.occupancy']}
                {...chartLabels}
              />
            </div>
          </div>
        </div>

        {/* Compliance Summary (D2) */}
        {complianceSummary.length > 0 && (
          <div className="mb-40">
            <h2 className="text-heading-2 font-semibold text-text-ink mb-16">
              {labels['owner.compliance.title']}
            </h2>
            <p className="text-body text-text-secondary mb-16">
              {labels['owner.compliance.subtitle']}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
              {complianceSummary.map((status) => (
                <div
                  key={status.unitId}
                  className="bg-surface-paper border border-border-line rounded-md p-24"
                >
                  <h3 className="text-heading-3 font-semibold text-text-ink mb-16">
                    {status.unitName}
                  </h3>
                  <div className="space-y-12">
                    <div className="flex justify-between items-center">
                      <span className="text-body text-text-secondary">
                        {labels['owner.compliance.permitted_use']}
                      </span>
                      <span className={`text-body font-medium ${
                        status.permittedUseConfirmedAt
                          ? 'text-state-success'
                          : 'text-state-warning'
                      }`}>
                        {status.permittedUseConfirmedAt
                          ? labels['owner.compliance.permitted_yes']
                          : labels['owner.compliance.permitted_no']}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-body text-text-secondary">
                        {labels['owner.compliance.tm30_ontime']}
                      </span>
                      <span className="text-body font-medium text-text-ink">
                        {status.tm30OnTimePercent}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-body text-text-secondary">
                        {labels['owner.compliance.records']}
                      </span>
                      <span className="text-body font-medium text-text-ink">
                        {status.complianceRecordsCount}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-body text-text-secondary">
                        {labels['owner.compliance.mobilization']}
                      </span>
                      <span className="text-body font-medium text-text-ink">
                        {Math.round((status.mobilizationProgress.completed / status.mobilizationProgress.total) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Statements (D2) */}
        {statements.length > 0 && (
          <div className="mb-40">
            <div className="flex items-center justify-between gap-16 mb-16">
              <h2 className="text-heading-2 font-semibold text-text-ink">
                {labels['owner.statement.title']}
              </h2>
              <Link href="/owner/statements" className="text-small font-semibold text-brand-andaman hover:underline">
                {labels['owner.statements.view_all']}
              </Link>
            </div>
            <div className="space-y-16">
              {statements.map((statement) => (
                <div
                  key={statement.id}
                  className="bg-surface-paper border border-border-line rounded-md p-24 hover:shadow-card transition-shadow"
                >
                  <div className="flex items-start justify-between gap-12">
                    <div className="flex-1">
                      <h3 className="text-body font-semibold text-text-ink mb-4">
                        {labels['owner.statement.period']}: {new Date(statement.periodStart).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                        })} – {new Date(statement.periodEnd).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                        })}
                      </h3>
                      <p className="text-sm text-text-secondary mb-12">
                        {new Date(statement.publishedAt || statement.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                      <div className="space-y-8">
                        <div className="flex justify-between">
                          <span className="text-sm text-text-secondary">
                            {labels['owner.statement.noi']}
                          </span>
                          <span className="text-sm font-medium text-text-ink">
                            {/* OwnerStatement stores every amount in satang like the rest of
                                the platform (CLAUDE.md) — MoneyAmount's contract is satang-in,
                                so the raw Prisma field goes straight in, no manual /100 (Q47). */}
                            <MoneyAmount satang={statement.noiTh || 0} />
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-text-secondary">
                            {labels['owner.statement.your_share']}
                          </span>
                          <span className="text-sm font-medium text-text-ink">
                            <MoneyAmount satang={statement.ownerShareTh || 0} />
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-12 shrink-0">
                      <Chip
                        variant="status"
                        status={statementChipStatus(statement.status)}
                      >
                        {labels[`common.status.statement.${statement.status}`] ?? statement.status}
                      </Chip>
                      <Link href={`/owner/statements/${statement.id}`}>
                        <Button variant="secondary" size="sm">
                          {labels['owner.statement.view']}
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unit Cards Grid or Single Unit View */}
        {isSingleUnit ? (
          <div className="space-y-32">
            {/* Single Unit: Bookings */}
            <div>
              <h2 className="text-heading-2 font-semibold text-text-ink mb-16">
                {labels['owner.sections.bookings']}
              </h2>
              <BookingsList
                bookings={bookings}
                locale={locale}
                labels={{
                  empty: labels['owner.bookings.empty'],
                  unknownNationality: labels['owner.bookings.unknown_nationality'],
                }}
              />
            </div>

            {/* Single Unit: Latest Statement */}
            <div>
              <h2 className="text-heading-2 font-semibold text-text-ink mb-16">
                {labels['owner.sections.statement']}
              </h2>
              <LatestStatementCard statementId={currentUnit?.latestStatementId || null} />
            </div>

            {/* Single Unit: Open Tickets */}
            <div>
              <h2 className="text-heading-2 font-semibold text-text-ink mb-16">
                {labels['owner.sections.tickets']}
              </h2>
              <OpenTicketsList
                count={currentUnit?.openTicketsCount || 0}
                tickets={currentUnit?.openTickets || []}
                labels={{
                  empty: labels['owner.tickets.empty'],
                  waitingCount: labels['owner.tickets.waiting_count'],
                  view: labels['owner.tickets.view'],
                  status: {
                    open: labels['tickets.status.open'],
                    acknowledged: labels['tickets.status.acknowledged'],
                    in_progress: labels['tickets.status.in_progress'],
                    waiting_reporter: labels['tickets.status.waiting_reporter'],
                    resolved: labels['tickets.status.resolved'],
                    closed: labels['tickets.status.closed'],
                    cancelled: labels['tickets.status.cancelled'],
                  },
                }}
              />
            </div>

            {currentUnit ? (
              <div>
                <h2 className="text-heading-2 font-semibold text-text-ink mb-16">
                  {labels['owner.actions.title']}
                </h2>
                <OwnerQuickActions unit={currentUnit} />
              </div>
            ) : null}

            {/* Owner Stay Action */}
            <div>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => setShowOwnerStayModal(true)}
              >
                {labels['owner.stay.book_action']}
              </Button>
            </div>

            {/* Sell Interest Card */}
            <div>
              <SellInterestCard
                labels={{
                  title: labels['owner.sell_interest.card_title'],
                  description: labels['owner.sell_interest.card_description'],
                  action: labels['owner.sell_interest.action'],
                }}
                onExpressInterest={handleExpressSellInterest}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-32">
            {/* Portfolio: Units Grid (doc 06 S7 — per-unit rows with occupancy sparkline) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
              {filteredUnits.map((unit) => (
                <div
                  key={unit.id}
                  className="bg-surface-paper border border-border-line rounded-md p-24 hover:shadow-card transition-shadow"
                >
                  <div className="flex items-start justify-between gap-12 mb-16">
                    <h3 className="text-heading-3 font-semibold text-text-ink">
                      <Link
                        href={`/owner/units/${unit.id}`}
                        className="hover:text-brand-andaman hover:underline"
                      >
                        {unit.name}
                      </Link>
                    </h3>
                    <Sparkline
                      values={trends.sparklines[unit.id] || []}
                      max={1}
                      title={labels['owner.units.last30']}
                    />
                  </div>
                  <div className="space-y-12">
                    <div className="flex justify-between">
                      <span className="text-body text-text-secondary">
                        {labels['owner.units.occupancy']}
                      </span>
                      <span className="text-body font-medium text-text-ink">
                        {unit.occupancyThisMonth} {labels['owner.stats.nights']}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-body text-text-secondary">
                        {labels['owner.units.revenue']}
                      </span>
                      <span className="text-body font-medium text-text-ink">
                        <MoneyAmount satang={unit.revenueThisMonth * 100} />
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-body text-text-secondary">
                        {labels['owner.units.bookings']}
                      </span>
                      <span className="text-body font-medium text-text-ink">{unit.bookingsCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-body text-text-secondary">
                        {labels['owner.units.open_tickets']}
                      </span>
                      <span className="text-body font-medium text-text-ink">{unit.openTicketsCount}</span>
                    </div>
                    <div className="pt-12 flex flex-col gap-8">
                      <Link
                        href={`/owner/units/${unit.id}`}
                        className="text-small font-semibold text-brand-andaman hover:underline"
                      >
                        {labels['owner.units.view_detail']} →
                      </Link>
                      <Link
                        href={ticketHref(unit)}
                        className="text-small font-semibold text-brand-andaman hover:underline"
                      >
                        {labels['owner.actions.raise_ticket']} →
                      </Link>
                      <Link
                        href={serviceHref(unit)}
                        className="text-small font-semibold text-brand-andaman hover:underline"
                      >
                        {labels['owner.actions.book_service']} →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <h2 className="text-heading-2 font-semibold text-text-ink mb-16">
                {labels['owner.sections.tickets']}
              </h2>
              <OpenTicketsList
                count={filteredUnits.reduce((acc, unit) => acc + unit.openTicketsCount, 0)}
                tickets={portfolioOpenTickets}
                labels={{
                  empty: labels['owner.tickets.empty'],
                  waitingCount: labels['owner.tickets.waiting_count'],
                  view: labels['owner.tickets.view'],
                  status: {
                    open: labels['tickets.status.open'],
                    acknowledged: labels['tickets.status.acknowledged'],
                    in_progress: labels['tickets.status.in_progress'],
                    waiting_reporter: labels['tickets.status.waiting_reporter'],
                    resolved: labels['tickets.status.resolved'],
                    closed: labels['tickets.status.closed'],
                    cancelled: labels['tickets.status.cancelled'],
                  },
                }}
              />
            </div>

            {/* Portfolio: Sell Interest Card */}
            <div>
              <SellInterestCard
                labels={{
                  title: labels['owner.sell_interest.card_title'],
                  description: labels['owner.sell_interest.card_description'],
                  action: labels['owner.sell_interest.action'],
                }}
                onExpressInterest={handleExpressSellInterest}
              />
            </div>
          </div>
        )}
      </div>

      {/* Owner Stay Modal */}
      <OwnerStayModal
        isOpen={showOwnerStayModal}
        unitId={currentUnit?.id || null}
        onClose={() => setShowOwnerStayModal(false)}
        onSubmit={handleOwnerStay}
        isLoading={ownerStayLoading}
      />
    </div>
  );
};
