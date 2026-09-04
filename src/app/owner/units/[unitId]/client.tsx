'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Button,
  StatTile,
  BookingsList,
  LatestStatementCard,
  OpenTicketsList,
  OwnerStayModal,
  MoneyAmount,
  SellInterestCard,
} from '@/components';
import { DeltaChip, Sparkline } from '@/components/viz';
import type { OwnerAlert, OwnerComplianceStatus } from '@/modules/projects';

function fill(template: string, params?: Record<string, string>): string {
  if (!params) return template;
  let output = template;
  for (const [key, value] of Object.entries(params)) {
    output = output.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return output;
}

interface OwnerUnitDashboardClientProps {
  unit: {
    id: string;
    name: string;
    projectId: string;
    projectName: string;
  };
  summary: {
    id: string;
    name: string;
    projectId: string;
    occupancyThisMonth: number;
    revenueThisMonth: number;
    nextArrivalDate: string | null;
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
  };
  bookings: Array<{
    id: string;
    startDate: string;
    endDate: string;
    totalThb: number;
    guestIdentity: { id: string; firstName: string };
    guests: Array<{ nationality: string }>;
  }>;
  alerts: Array<Omit<OwnerAlert, 'createdAt'> & { createdAt: string }>;
  compliance: OwnerComplianceStatus | null;
  statements: Array<{
    id: string;
    periodStart: string;
    periodEnd: string;
    publishedAt: string | null;
    createdAt: string;
    noiTh: number | null;
    ownerShareTh: number | null;
  }>;
  sparkline: number[];
  trends: {
    prevMonth: { nights: number; revenueThb: number } | null;
  };
  labels: Record<string, string>;
  locale: string;
}

interface OwnerContractView {
  managementFeeBasis: string;
  managementFeeRate: number | null;
  managementFeeFixedAmount: number | null;
  performanceFeeEnabled: boolean;
  performanceFeeRate: number | null;
  performanceFeeBaseline: number | null;
  contractStartDate: string;
  contractEndDate: string | null;
}

export const OwnerUnitDashboardClient: React.FC<OwnerUnitDashboardClientProps> = ({
  unit,
  summary,
  bookings,
  alerts,
  compliance,
  statements,
  sparkline,
  trends,
  labels,
  locale,
}) => {
  const [showOwnerStayModal, setShowOwnerStayModal] = useState(false);
  const [ownerStayLoading, setOwnerStayLoading] = useState(false);
  const [contract, setContract] = useState<OwnerContractView | null>(null);
  const [contractLoading, setContractLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setContractLoading(true);
      try {
        const response = await fetch(`/api/owner/units/${unit.id}/contract`);
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) {
          setContract(data.contract ?? null);
        }
      } finally {
        if (!cancelled) setContractLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [unit.id]);

  const resolveLabel = (key: string, params?: Record<string, string>) =>
    fill(labels[key] || key, params);

  const ticketHref = `/tickets/new?projectId=${unit.projectId}&unitId=${unit.id}`;
  const serviceHref = `/services?projectId=${unit.projectId}&unitId=${unit.id}`;

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

  const formatBasis = (basis: string) =>
    labels[`owner.contract.basis.${basis}`] || basis;

  return (
    <div className="min-h-screen bg-surface-background">
      <div className="max-w-4xl mx-auto px-24 py-40">
        <Link href="/owner" className="text-small font-semibold text-brand-andaman hover:underline">
          {labels['owner.unit.back']}
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-16 mt-12 mb-32">
          <div>
            <h1 className="text-heading-1 font-bold text-text-ink mb-8">{unit.name}</h1>
            <p className="text-body text-text-secondary">
              {unit.projectName} — {labels['owner.unit.subtitle']}
            </p>
          </div>
          <Sparkline values={sparkline} max={1} title={labels['owner.units.last30']} />
        </div>

        {alerts.length > 0 && (
          <div className="mb-40">
            <h2 className="text-heading-2 font-semibold text-text-ink mb-16">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-20 mb-40">
          <StatTile
            label={labels['owner.dashboard.occupancy_this_month']}
            value={`${summary.occupancyThisMonth} ${labels['owner.stats.nights']}`}
            variant="occupancy"
            delta={
              <DeltaChip
                currentValue={summary.occupancyThisMonth}
                previousValue={trends.prevMonth ? trends.prevMonth.nights : null}
                vsLabel={labels['owner.stats.vs_last_month']}
                newLabel={labels['owner.stats.new_period']}
              />
            }
          />
          <StatTile
            label={labels['owner.dashboard.revenue_this_month']}
            value={<MoneyAmount satang={summary.revenueThisMonth * 100} />}
            variant="revenue"
            delta={
              <DeltaChip
                currentValue={summary.revenueThisMonth}
                previousValue={trends.prevMonth ? trends.prevMonth.revenueThb : null}
                vsLabel={labels['owner.stats.vs_last_month']}
                newLabel={labels['owner.stats.new_period']}
              />
            }
          />
        </div>

        {compliance && (
          <div className="bg-surface-paper border border-border-line rounded-md p-24 mb-40">
            <h2 className="text-heading-2 font-semibold text-text-ink mb-8">
              {labels['owner.compliance.title']}
            </h2>
            <p className="text-body text-text-secondary mb-16">
              {labels['owner.compliance.subtitle']}
            </p>
            <div className="space-y-12">
              <div className="flex justify-between items-center">
                <span className="text-body text-text-secondary">
                  {labels['owner.compliance.permitted_use']}
                </span>
                <span
                  className={`text-body font-medium ${
                    compliance.permittedUseConfirmedAt
                      ? 'text-state-success'
                      : 'text-state-warning'
                  }`}
                >
                  {compliance.permittedUseConfirmedAt ? '✓' : '⚠'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-body text-text-secondary">
                  {labels['owner.compliance.tm30_ontime']}
                </span>
                <span className="text-body font-medium text-text-ink">
                  {compliance.tm30OnTimePercent}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-body text-text-secondary">
                  {labels['owner.compliance.records']}
                </span>
                <span className="text-body font-medium text-text-ink">
                  {compliance.complianceRecordsCount}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-body text-text-secondary">
                  {labels['owner.compliance.mobilization']}
                </span>
                <span className="text-body font-medium text-text-ink">
                  {compliance.mobilizationProgress.total > 0
                    ? Math.round(
                        (compliance.mobilizationProgress.completed /
                          compliance.mobilizationProgress.total) *
                          100
                      )
                    : 0}
                  %
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-32">
          {contractLoading ? (
            <p className="text-small text-text-secondary">{labels['owner.contract.loading']}</p>
          ) : contract ? (
            <div className="bg-surface-paper border border-border-line rounded-md p-24">
              <h2 className="text-heading-2 font-semibold text-text-ink mb-16">
                {labels['owner.contract.title']}
              </h2>
              <dl className="grid md:grid-cols-2 gap-12 text-small">
                <div>
                  <dt className="text-text-secondary">{labels['owner.contract.basis']}</dt>
                  <dd className="font-medium text-text-ink">{formatBasis(contract.managementFeeBasis)}</dd>
                </div>
                {contract.managementFeeRate != null ? (
                  <div>
                    <dt className="text-text-secondary">{labels['owner.contract.rate']}</dt>
                    <dd className="font-medium text-text-ink">
                      {(contract.managementFeeRate * 100).toFixed(2)}%
                    </dd>
                  </div>
                ) : null}
                {contract.managementFeeFixedAmount != null ? (
                  <div>
                    <dt className="text-text-secondary">{labels['owner.contract.fixed']}</dt>
                    <dd className="font-medium text-text-ink">
                      ฿{(contract.managementFeeFixedAmount / 100).toFixed(2)}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-text-secondary">{labels['owner.contract.period']}</dt>
                  <dd className="font-medium text-text-ink">
                    {contract.contractStartDate}
                    {contract.contractEndDate ? ` – ${contract.contractEndDate}` : ''}
                  </dd>
                </div>
                {contract.performanceFeeEnabled ? (
                  <div>
                    <dt className="text-text-secondary">{labels['owner.contract.performance']}</dt>
                    <dd className="font-medium text-text-ink">
                      {contract.performanceFeeRate != null
                        ? `${(contract.performanceFeeRate * 100).toFixed(2)}%`
                        : '—'}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ) : null}

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

          <div>
            <h2 className="text-heading-2 font-semibold text-text-ink mb-16">
              {labels['owner.sections.statement']}
            </h2>
            <LatestStatementCard statementId={summary.latestStatementId} />
          </div>

          {statements.length > 0 && (
            <div>
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
                    className="bg-surface-paper border border-border-line rounded-md p-24"
                  >
                    <div className="flex items-start justify-between gap-12">
                      <div>
                        <h3 className="text-body font-semibold text-text-ink mb-4">
                          {labels['owner.statement.period']}:{' '}
                          {new Date(statement.periodStart).toLocaleDateString(locale, {
                            year: 'numeric',
                            month: 'short',
                          })}{' '}
                          –{' '}
                          {new Date(statement.periodEnd).toLocaleDateString(locale, {
                            year: 'numeric',
                            month: 'short',
                          })}
                        </h3>
                        <div className="space-y-8 mt-12">
                          <div className="flex justify-between gap-16">
                            <span className="text-sm text-text-secondary">
                              {labels['owner.statement.noi']}
                            </span>
                            <MoneyAmount satang={statement.noiTh || 0} />
                          </div>
                          <div className="flex justify-between gap-16">
                            <span className="text-sm text-text-secondary">
                              {labels['owner.statement.your_share']}
                            </span>
                            <MoneyAmount satang={statement.ownerShareTh || 0} />
                          </div>
                        </div>
                      </div>
                      <Link href={`/owner/statements/${statement.id}`}>
                        <Button variant="secondary" size="sm">
                          {labels['owner.statement.view']}
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-heading-2 font-semibold text-text-ink mb-16">
              {labels['owner.sections.tickets']}
            </h2>
            <OpenTicketsList
              count={summary.openTicketsCount}
              tickets={summary.openTickets}
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

          <div>
            <h2 className="text-heading-2 font-semibold text-text-ink mb-16">
              {labels['owner.actions.title']}
            </h2>
            <div className="flex flex-col sm:flex-row gap-12">
              <Link href={ticketHref} className="flex-1">
                <Button variant="secondary" size="md" fullWidth>
                  {labels['owner.actions.raise_ticket']}
                </Button>
              </Link>
              <Link href={serviceHref} className="flex-1">
                <Button variant="secondary" size="md" fullWidth>
                  {labels['owner.actions.book_service']}
                </Button>
              </Link>
            </div>
          </div>

          <SellInterestCard
            labels={{
              title: labels['owner.sell_interest.card_title'],
              description: labels['owner.sell_interest.card_description'],
              action: labels['owner.sell_interest.action'],
            }}
            onExpressInterest={handleExpressSellInterest}
          />

          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => setShowOwnerStayModal(true)}
          >
            {labels['owner.stay.book_action']}
          </Button>
        </div>
      </div>

      <OwnerStayModal
        isOpen={showOwnerStayModal}
        unitId={unit.id}
        onClose={() => setShowOwnerStayModal(false)}
        onSubmit={handleOwnerStay}
        isLoading={ownerStayLoading}
      />
    </div>
  );
};
