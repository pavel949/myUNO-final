'use client';

import { FC, FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import type { CrmOpportunity } from '@prisma/client';

interface SerializedOpportunity extends Omit<CrmOpportunity, 'createdAt' | 'updatedAt' | 'expectedCloseAt' | 'nextActionAt' | 'wonAt' | 'lostAt'> {
  createdAt: string;
  updatedAt: string;
  expectedCloseAt: string | null;
  nextActionAt: string | null;
  wonAt: string | null;
  lostAt: string | null;
  contact: {
    id: string;
    name: string;
    email: string | null;
    phone?: string | null;
    avatar?: string | null;
  } | null;
  assignedTo?: {
    id: string;
    name: string;
    email: string | null;
  } | null;
  project?: {
    id: string;
    name: string;
  } | null;
  unit?: {
    id: string;
    name: string;
  } | null;
  activities?: Array<{
    id: string;
    type: string;
    subject: string;
    createdAt: string;
    status: string;
    identity?: {
      id: string;
      name: string;
    } | null;
  }>;
}

interface OpportunityDetailClientProps {
  opportunity: SerializedOpportunity;
  labels?: Record<string, string>;
}

const STAGE_COLORS: Record<string, string> = {
  new: 'bg-surface-paper text-text-ink',
  qualified: 'bg-state-success-soft text-state-success',
  discovery: 'bg-state-info-soft text-state-info',
  proposal: 'bg-state-warning-soft text-state-warning',
  negotiation: 'bg-state-warning-soft text-state-warning',
  nurture: 'bg-state-info-soft text-state-info',
  won: 'bg-state-success-soft text-state-success',
  lost: 'bg-state-error-soft text-state-error',
};

const STAGE_LABELS: Record<string, string> = {
  new: '🆕 New',
  qualified: '✅ Qualified',
  discovery: '🔍 Discovery',
  proposal: '💼 Proposal',
  negotiation: '🤝 Negotiation',
  nurture: '🌱 Nurture',
  won: '🏆 Won',
  lost: '❌ Lost',
};

const getDaysInStage = (createdAt: string | Date): number => {
  const now = new Date();
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const days = Math.floor(
    (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
  );
  return days;
};

const formatCurrency = (value: number): string => {
  if (value >= 1_000_000) {
    return `฿${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `฿${(value / 1_000).toFixed(1)}K`;
  }
  return `฿${value.toFixed(0)}`;
};

const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'Not set';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const OpportunityDetailClient: FC<OpportunityDetailClientProps> = ({
  opportunity,
  labels = {},
}) => {
  const router = useRouter();
  const [activityBusy, setActivityBusy] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activitySubject, setActivitySubject] = useState('');
  const [activityBody, setActivityBody] = useState('');

  const daysInStage = getDaysInStage(opportunity.createdAt);
  const weightedValue = ((opportunity.valueThb ?? 0) * opportunity.probability) / 100;

  const logActivity = async (event: FormEvent) => {
    event.preventDefault();
    if (!activitySubject.trim()) return;
    setActivityBusy(true);
    setActivityError(null);
    try {
      const response = await fetch('/api/admin/crm/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identityId: opportunity.identityId,
          opportunityId: opportunity.id,
          type: 'note',
          subject: activitySubject.trim(),
          body: activityBody.trim() || undefined,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || labels['admin.crm.activity.error'] || 'Failed');
      }
      setActivitySubject('');
      setActivityBody('');
      router.refresh();
    } catch (err) {
      setActivityError(
        err instanceof Error ? err.message : labels['admin.crm.activity.error'] || 'Failed'
      );
    } finally {
      setActivityBusy(false);
    }
  };

  return (
    <div className="space-y-24">
      {/* Main Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-24">
        {/* Contact Card */}
        <div className="bg-surface-paper border border-border-line rounded-lg p-24">
          <h2 className="text-heading-3 font-semibold text-text-ink mb-16">
            Contact
          </h2>
          {opportunity.contact ? (
            <div className="space-y-16">
              <div className="flex items-center gap-12">
                {opportunity.contact.avatar ? (
                  <div className="relative w-40 h-40 flex-shrink-0 rounded-full overflow-hidden">
                    <Image
                      src={opportunity.contact.avatar}
                      alt={opportunity.contact.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-40 h-40 rounded-full bg-border-line flex-shrink-0 flex items-center justify-center">
                    <span className="text-heading-2 font-bold text-text-stone">
                      {opportunity.contact.name?.[0]?.toUpperCase() || '?'}
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-body font-semibold text-text-ink">
                    {opportunity.contact.name}
                  </p>
                  <p className="text-small text-text-secondary">
                    {opportunity.contact.email}
                  </p>
                </div>
              </div>
              {opportunity.contact.phone && (
                <div className="text-small text-text-secondary">
                  <span className="font-semibold text-text-ink">Phone:</span> {opportunity.contact.phone}
                </div>
              )}
            </div>
          ) : (
            <p className="text-body text-text-secondary">No contact assigned</p>
          )}
        </div>

        {/* Stage & Status Card */}
        <div className="bg-surface-paper border border-border-line rounded-lg p-24">
          <h2 className="text-heading-3 font-semibold text-text-ink mb-16">
            Pipeline Status
          </h2>
          <div className="space-y-16">
            <div>
              <p className="text-small text-text-secondary mb-8">Stage</p>
              <span className={`inline-block px-12 py-4 rounded-full font-semibold text-small ${STAGE_COLORS[opportunity.stage]}`}>
                {STAGE_LABELS[opportunity.stage]}
              </span>
            </div>
            <div>
              <p className="text-small text-text-secondary mb-8">Days in Stage</p>
              <p className="text-heading-2 font-semibold text-text-ink">
                {daysInStage}
              </p>
            </div>
            <div>
              <p className="text-small text-text-secondary mb-8">Probability</p>
              <div className="flex items-center gap-8">
                <div className="flex-1 bg-border-line h-8 rounded-full overflow-hidden">
                  <div
                    className="bg-brand-andaman h-full rounded-full"
                    style={{ width: `${opportunity.probability}%` }}
                  />
                </div>
                <span className="text-body font-semibold text-text-ink">
                  {opportunity.probability}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Value Card */}
        <div className="bg-surface-paper border border-border-line rounded-lg p-24">
          <h2 className="text-heading-3 font-semibold text-text-ink mb-16">
            Deal Value
          </h2>
          <div className="space-y-16">
            <div>
              <p className="text-small text-text-secondary mb-4">Expected Value</p>
              <p className="text-heading-1 font-semibold text-text-ink">
                {formatCurrency(opportunity.valueThb ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-small text-text-secondary mb-4">Weighted Value</p>
              <p className="text-heading-2 font-semibold text-brand-andaman">
                {formatCurrency(weightedValue)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Details Section */}
      <div className="bg-surface-paper border border-border-line rounded-lg p-24">
        <h2 className="text-heading-3 font-semibold text-text-ink mb-16">
          Opportunity Details
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
          <div>
            <p className="text-small text-text-secondary mb-4">Source</p>
            <p className="text-body text-text-ink">
              {opportunity.source || 'Not specified'}
            </p>
          </div>
          <div>
            <p className="text-small text-text-secondary mb-4">Type</p>
            <p className="text-body text-text-ink capitalize">
              {opportunity.type}
            </p>
          </div>
          <div>
            <p className="text-small text-text-secondary mb-4">Expected Close Date</p>
            <p className="text-body text-text-ink">
              {formatDate(opportunity.expectedCloseAt)}
            </p>
          </div>
          <div>
            <p className="text-small text-text-secondary mb-4">Next Action Date</p>
            <p className="text-body text-text-ink">
              {formatDate(opportunity.nextActionAt)}
            </p>
          </div>
          {opportunity.project && (
            <div>
              <p className="text-small text-text-secondary mb-4">Project</p>
              <p className="text-body text-text-ink">
                {opportunity.project.name}
              </p>
            </div>
          )}
          {opportunity.unit && (
            <div>
              <p className="text-small text-text-secondary mb-4">Unit</p>
              <p className="text-body text-text-ink">
                {opportunity.unit.name}
              </p>
            </div>
          )}
          {opportunity.assignedTo && (
            <div>
              <p className="text-small text-text-secondary mb-4">Assigned To</p>
              <p className="text-body text-text-ink">
                {opportunity.assignedTo.name}
              </p>
            </div>
          )}
          {opportunity.stage === 'lost' && opportunity.lostReason && (
            <div>
              <p className="text-small text-text-secondary mb-4">Loss Reason</p>
              <p className="text-body text-text-ink">
                {opportunity.lostReason}
              </p>
            </div>
          )}
          {opportunity.externalPartner && (
            <div>
              <p className="text-small text-text-secondary mb-4">External Partner</p>
              <p className="text-body text-text-ink">
                {opportunity.externalPartner}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Log activity */}
      <div className="bg-surface-paper border border-border-line rounded-lg p-24">
        <h2 className="text-heading-3 font-semibold text-text-ink mb-16">
          {labels['admin.crm.activity.title'] || 'Log activity'}
        </h2>
        {activityError && (
          <p className="text-body text-state-error mb-12">{activityError}</p>
        )}
        <form onSubmit={logActivity} className="space-y-12">
          <input
            type="text"
            value={activitySubject}
            onChange={(e) => setActivitySubject(e.target.value)}
            placeholder={labels['admin.crm.activity.subject'] || 'Subject'}
            className="h-40 px-12 rounded-sm bg-surface-ivory border border-border-line text-small w-full"
            required
          />
          <textarea
            value={activityBody}
            onChange={(e) => setActivityBody(e.target.value)}
            placeholder={labels['admin.crm.activity.body'] || 'Notes (optional)'}
            rows={3}
            className="px-12 py-8 rounded-sm bg-surface-ivory border border-border-line text-small w-full"
          />
          <button
            type="submit"
            disabled={activityBusy}
            className="px-16 py-8 rounded-sm bg-brand-andaman text-on-dark-text text-small font-semibold disabled:opacity-50"
          >
            {activityBusy
              ? labels['admin.crm.activity.saving'] || 'Saving…'
              : labels['admin.crm.activity.submit'] || 'Add note'}
          </button>
        </form>
      </div>

      {/* Activities Section */}
      {opportunity.activities && opportunity.activities.length > 0 && (
        <div className="bg-surface-paper border border-border-line rounded-lg p-24">
          <h2 className="text-heading-3 font-semibold text-text-ink mb-16">
            Recent Activities
          </h2>
          <div className="space-y-16">
            {opportunity.activities.map((activity) => (
              <div
                key={activity.id}
                className="border-l-4 border-brand-andaman pl-16 py-8"
              >
                <div className="flex items-baseline justify-between mb-4">
                  <span className="text-body font-semibold text-text-ink capitalize">
                    {activity.type}
                  </span>
                  <span className="text-small text-text-secondary">
                    {formatDate(activity.createdAt)}
                  </span>
                </div>
                <p className="text-small text-text-secondary mb-4">
                  {activity.subject}
                </p>
                <div className="flex items-center gap-16 text-small text-text-stone">
                  {activity.identity && (
                    <span>By {activity.identity.name}</span>
                  )}
                  <span className="capitalize">{activity.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
