'use client';

import React, { useState } from 'react';
import {
  Button,
  StatTile,
  ProjectSwitcher,
  BookingsList,
  LatestStatementCard,
  OpenTicketsList,
  SellInterestCard,
  OwnerStayModal,
} from '@/components';
import { BarChart, LineChart, Sparkline, DeltaChip, CHART_SERIES, formatThbCompact } from '@/components/viz';
import type { OwnerTrends } from '@/app/actions/getOwnerDashboard';

interface UnitData {
  id: string;
  name: string;
  projectId: string;
  occupancyThisMonth: number;
  revenueThisMonth: number;
  nextArrivalDate: Date | null;
  bookingsCount: number;
  openTicketsCount: number;
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
  labels: Record<string, string>;
}

const formatCurrency = (thb: number): string => {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(thb);
};

const monthLabel = (period: string): string => {
  // period is 'YYYY-MM'
  const d = new Date(`${period}-01T00:00:00Z`);
  return d.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' });
};

export const OwnerDashboardClient: React.FC<OwnerDashboardClientProps> = ({
  dashboard,
  shape,
  projects,
  bookings,
  trends,
  labels,
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    shape.isPortfolio ? projects[0]?.id || null : null
  );
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

  return (
    <div className="min-h-screen bg-surface-background">
      <div className="max-w-6xl mx-auto px-24 py-40">
        {/* Header */}
        <div className="mb-40">
          <h1 className="text-heading-1 font-bold text-text-ink mb-8">
            {labels['owner.dashboard.title']}
          </h1>
          <p className="text-body text-text-secondary">{labels['owner.dashboard.subtitle']}</p>
        </div>

        {/* Portfolio: Project Switcher */}
        {shape.isPortfolio && (
          <div className="mb-40">
            <ProjectSwitcher
              projects={projects}
              selectedProjectId={selectedProjectId || projects[0]?.id || null}
              onProjectChange={setSelectedProjectId}
            />
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
            value={formatCurrency(revenueNow)}
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
          <h2 className="text-heading-2 font-semibold text-text-ink mb-16">
            {labels['owner.trends.title']}
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24">
            <div className="bg-surface-paper border border-border-line rounded-md p-24">
              <h3 className="text-heading-3 font-semibold text-text-ink mb-16">
                {labels['owner.trends.revenue']}
              </h3>
              <BarChart
                data={trends.monthly.map((p) => ({
                  label: monthLabel(p.period),
                  value: p.rentalRevenueThb,
                }))}
                color={CHART_SERIES[0]}
                formatValue={formatThbCompact}
                valueHeader={labels['owner.chart.revenue']}
                {...chartLabels}
              />
            </div>
            <div className="bg-surface-paper border border-border-line rounded-md p-24">
              <h3 className="text-heading-3 font-semibold text-text-ink mb-16">
                {labels['owner.trends.occupancy']}
              </h3>
              <LineChart
                data={trends.monthly.map((p) => ({
                  label: monthLabel(p.period),
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

        {/* Unit Cards Grid or Single Unit View */}
        {isSingleUnit ? (
          <div className="space-y-32">
            {/* Single Unit: Bookings */}
            <div>
              <h2 className="text-heading-2 font-semibold text-text-ink mb-16">
                {labels['owner.sections.bookings']}
              </h2>
              <BookingsList bookings={bookings} />
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
              <OpenTicketsList count={currentUnit?.openTicketsCount || 0} />
            </div>

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
              <SellInterestCard onExpressInterest={handleExpressSellInterest} />
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
                    <h3 className="text-heading-3 font-semibold text-text-ink">{unit.name}</h3>
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
                        {formatCurrency(unit.revenueThisMonth)}
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
                  </div>
                </div>
              ))}
            </div>

            {/* Portfolio: Sell Interest Card */}
            <div>
              <SellInterestCard onExpressInterest={handleExpressSellInterest} />
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
