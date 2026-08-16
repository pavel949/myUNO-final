'use client';

import { FC, memo } from 'react';
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
}

interface OpportunityCardProps {
  opportunity: SerializedOpportunity;
  draggable?: boolean;
  onClick?: () => void;
}

const STAGE_COLORS: Record<string, string> = {
  new: 'bg-slate-100 dark:bg-slate-800',
  qualified: 'bg-blue-100 dark:bg-blue-900',
  discovery: 'bg-indigo-100 dark:bg-indigo-900',
  proposal: 'bg-purple-100 dark:bg-purple-900',
  negotiation: 'bg-orange-100 dark:bg-orange-900',
  nurture: 'bg-yellow-100 dark:bg-yellow-900',
  won: 'bg-green-100 dark:bg-green-900',
  lost: 'bg-red-100 dark:bg-red-900',
};

const STAGE_BADGE_COLORS: Record<string, string> = {
  new: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
  qualified:
    'bg-blue-200 text-blue-800 dark:bg-blue-700 dark:text-blue-200',
  discovery:
    'bg-indigo-200 text-indigo-800 dark:bg-indigo-700 dark:text-indigo-200',
  proposal:
    'bg-purple-200 text-purple-800 dark:bg-purple-700 dark:text-purple-200',
  negotiation:
    'bg-orange-200 text-orange-800 dark:bg-orange-700 dark:text-orange-200',
  nurture:
    'bg-yellow-200 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-200',
  won: 'bg-green-200 text-green-800 dark:bg-green-700 dark:text-green-200',
  lost: 'bg-red-200 text-red-800 dark:bg-red-700 dark:text-red-200',
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

export const OpportunityCard: FC<OpportunityCardProps> = memo(
  ({ opportunity, draggable = false, onClick }) => {
    const daysInStage = getDaysInStage(opportunity.createdAt);
    const weightedValue = ((opportunity.valueThb ?? 0) * opportunity.probability) / 100;

    return (
      <div
        onClick={onClick}
        draggable={draggable}
        className={`${STAGE_COLORS[opportunity.stage]} p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-200 dark:border-gray-700 group`}
      >
        {/* Header: Contact Avatar + Name */}
        <div className="flex items-center gap-3 mb-3">
          {opportunity.contact?.avatar ? (
            <div className="relative w-8 h-8 flex-shrink-0 rounded-full overflow-hidden">
              <Image
                src={opportunity.contact.avatar}
                alt={opportunity.contact.name}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0 flex items-center justify-center">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                {opportunity.contact?.name?.[0]?.toUpperCase() || '?'}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">
              {opportunity.contact?.name || 'Unknown'}
            </p>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:line-clamp-none">
          {opportunity.title}
        </h3>

        {/* Value & Probability */}
        <div className="mb-3 space-y-1">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-gray-600 dark:text-gray-400">
              Value
            </span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {formatCurrency(weightedValue)}
            </span>
          </div>
          <div className="w-full bg-gray-300 dark:bg-gray-600 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full"
              style={{ width: `${opportunity.probability}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600 dark:text-gray-400">
              {formatCurrency(opportunity.valueThb ?? 0)}
            </span>
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {opportunity.probability}%
            </span>
          </div>
        </div>

        {/* Stage Badge + Days in Stage */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <span
            className={`text-xs font-medium px-2 py-1 rounded ${
              STAGE_BADGE_COLORS[opportunity.stage]
            }`}
          >
            {opportunity.stage.charAt(0).toUpperCase() + opportunity.stage.slice(1)}
          </span>
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {daysInStage}d
          </span>
        </div>

        {/* Quick Actions */}
        <div className="pt-2 border-t border-gray-300 dark:border-gray-600 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="flex-1 text-xs py-1 px-2 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
            Details
          </button>
          <button className="flex-1 text-xs py-1 px-2 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
            Activity
          </button>
        </div>
      </div>
    );
  }
);

OpportunityCard.displayName = 'OpportunityCard';
