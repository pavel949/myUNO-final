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
}

const formatCurrency = (thb: number): string => {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(thb);
};

export const OwnerDashboardClient: React.FC<OwnerDashboardClientProps> = ({
  dashboard,
  shape,
  projects,
  bookings,
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    shape.isPortfolio ? projects[0]?.id || null : null
  );
  const [showOwnerStayModal, setShowOwnerStayModal] = useState(false);
  const [ownerStayLoading, setOwnerStayLoading] = useState(false);

  const handleOwnerStay = async (unitId: string, startDate: Date, endDate: Date) => {
    setOwnerStayLoading(true);
    try {
      // TODO: Call bookOwnerStay API
      console.log('Booking owner stay:', { unitId, startDate, endDate });
      // const response = await fetch('/api/owner-stays', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ unitId, startDate, endDate }),
      // });
      // if (!response.ok) throw new Error('Failed to book owner stay');
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

  return (
    <div className="min-h-screen bg-surface-background">
      <div className="max-w-6xl mx-auto px-24 py-40">
        {/* Header */}
        <div className="mb-40">
          <h1 className="text-heading-1 font-bold text-text-ink mb-8">Owner Dashboard</h1>
          <p className="text-body text-text-secondary">Manage your properties and stay informed</p>
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
            label="Occupancy This Month"
            value={`${shape.isPortfolio ? dashboard.combinedOccupancyThisMonth : currentUnit?.occupancyThisMonth || 0} nights`}
            variant="occupancy"
          />
          <StatTile
            label="Revenue This Month"
            value={formatCurrency(
              shape.isPortfolio
                ? dashboard.combinedRevenueThisMonth
                : currentUnit?.revenueThisMonth || 0
            )}
            variant="revenue"
          />
        </div>

        {/* Unit Cards Grid or Single Unit View */}
        {isSingleUnit ? (
          <div className="space-y-32">
            {/* Single Unit: Bookings */}
            <div>
              <h2 className="text-heading-2 font-semibold text-text-ink mb-16">Recent Bookings</h2>
              <BookingsList bookings={bookings} />
            </div>

            {/* Single Unit: Latest Statement */}
            <div>
              <h2 className="text-heading-2 font-semibold text-text-ink mb-16">Latest Statement</h2>
              <LatestStatementCard statementId={currentUnit?.latestStatementId || null} />
            </div>

            {/* Single Unit: Open Tickets */}
            <div>
              <h2 className="text-heading-2 font-semibold text-text-ink mb-16">Open Tickets</h2>
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
                Book My Stay
              </Button>
            </div>

            {/* Sell Interest Card */}
            <div>
              <SellInterestCard onExpressInterest={handleExpressSellInterest} />
            </div>
          </div>
        ) : (
          <div className="space-y-32">
            {/* Portfolio: Units Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
              {filteredUnits.map((unit) => (
                <div
                  key={unit.id}
                  className="border border-border-line rounded-md p-24 hover:shadow-md transition-shadow"
                >
                  <h3 className="text-heading-3 font-semibold text-text-ink mb-16">{unit.name}</h3>
                  <div className="space-y-12">
                    <div className="flex justify-between">
                      <span className="text-body text-text-secondary">Occupancy</span>
                      <span className="text-body font-medium text-text-ink">{unit.occupancyThisMonth} nights</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-body text-text-secondary">Revenue</span>
                      <span className="text-body font-medium text-text-ink">
                        {formatCurrency(unit.revenueThisMonth)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-body text-text-secondary">Bookings</span>
                      <span className="text-body font-medium text-text-ink">{unit.bookingsCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-body text-text-secondary">Open Tickets</span>
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
