'use client';

import { FC } from 'react';
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
}

const STAGE_COLORS: Record<string, string> = {
  new: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
  qualified: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  discovery: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  proposal: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  negotiation: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  nurture: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  won: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  lost: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
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
}) => {
  const daysInStage = getDaysInStage(opportunity.createdAt);
  const weightedValue = ((opportunity.valueThb ?? 0) * opportunity.probability) / 100;

  return (
    <div className="space-y-6">
      {/* Main Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Contact Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Contact
          </h2>
          {opportunity.contact ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {opportunity.contact.avatar ? (
                  <div className="relative w-12 h-12 flex-shrink-0 rounded-full overflow-hidden">
                    <Image
                      src={opportunity.contact.avatar}
                      alt={opportunity.contact.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-gray-700 dark:text-gray-300">
                      {opportunity.contact.name?.[0]?.toUpperCase() || '?'}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {opportunity.contact.name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {opportunity.contact.email}
                  </p>
                </div>
              </div>
              {opportunity.contact.phone && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Phone:</span> {opportunity.contact.phone}
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-600 dark:text-gray-400">No contact assigned</p>
          )}
        </div>

        {/* Stage & Status Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Pipeline Status
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Stage</p>
              <span className={`inline-block px-3 py-1 rounded-full font-medium ${STAGE_COLORS[opportunity.stage]}`}>
                {STAGE_LABELS[opportunity.stage]}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Days in Stage</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {daysInStage}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Probability</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full"
                    style={{ width: `${opportunity.probability}%` }}
                  />
                </div>
                <span className="font-bold text-gray-900 dark:text-white">
                  {opportunity.probability}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Value Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Deal Value
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Expected Value</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(opportunity.valueThb ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Weighted Value</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(weightedValue)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Details Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Opportunity Details
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Source</p>
            <p className="text-gray-900 dark:text-white">
              {opportunity.source || 'Not specified'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Type</p>
            <p className="text-gray-900 dark:text-white capitalize">
              {opportunity.type}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Expected Close Date</p>
            <p className="text-gray-900 dark:text-white">
              {formatDate(opportunity.expectedCloseAt)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Next Action Date</p>
            <p className="text-gray-900 dark:text-white">
              {formatDate(opportunity.nextActionAt)}
            </p>
          </div>
          {opportunity.project && (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Project</p>
              <p className="text-gray-900 dark:text-white">
                {opportunity.project.name}
              </p>
            </div>
          )}
          {opportunity.unit && (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Unit</p>
              <p className="text-gray-900 dark:text-white">
                {opportunity.unit.name}
              </p>
            </div>
          )}
          {opportunity.assignedTo && (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Assigned To</p>
              <p className="text-gray-900 dark:text-white">
                {opportunity.assignedTo.name}
              </p>
            </div>
          )}
          {opportunity.stage === 'lost' && opportunity.lostReason && (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Loss Reason</p>
              <p className="text-gray-900 dark:text-white">
                {opportunity.lostReason}
              </p>
            </div>
          )}
          {opportunity.externalPartner && (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">External Partner</p>
              <p className="text-gray-900 dark:text-white">
                {opportunity.externalPartner}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Activities Section */}
      {opportunity.activities && opportunity.activities.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Recent Activities
          </h2>
          <div className="space-y-4">
            {opportunity.activities.map((activity) => (
              <div
                key={activity.id}
                className="border-l-4 border-blue-500 pl-4 py-2"
              >
                <div className="flex items-baseline justify-between mb-1">
                  <span className="font-medium text-gray-900 dark:text-white capitalize">
                    {activity.type}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {formatDate(activity.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {activity.subject}
                </p>
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
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
