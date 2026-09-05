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
  new: 'bg-slate-100',
  qualified: 'bg-blue-100',
  discovery: 'bg-indigo-100',
  proposal: 'bg-purple-100',
  negotiation: 'bg-orange-100',
  nurture: 'bg-yellow-100',
  won: 'bg-green-100',
  lost: 'bg-state-error-soft',
};

const STAGE_BADGE_COLORS: Record<string, string> = {
  new: 'bg-slate-200 text-slate-800',
  qualified:
    'bg-blue-200 text-blue-800',
  discovery:
    'bg-indigo-200 text-indigo-800',
  proposal:
    'bg-purple-200 text-purple-800',
  negotiation:
    'bg-orange-200 text-orange-800',
  nurture:
    'bg-yellow-200 text-yellow-800',
  won: 'bg-green-200 text-green-800',
  lost: 'bg-red-200 text-red-800',
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
        className={`${STAGE_COLORS[opportunity.stage]} p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-border-line  group`}
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
            <div className="w-8 h-8 rounded-full bg-border-line  flex-shrink-0 flex items-center justify-center">
              <span className="text-xs font-bold text-text-ink ">
                {opportunity.contact?.name?.[0]?.toUpperCase() || '?'}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-text-stone  truncate">
              {opportunity.contact?.name || 'Unknown'}
            </p>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-text-ink  mb-2 line-clamp-2 group-hover:line-clamp-none">
          {opportunity.title}
        </h3>

        {/* Value & Probability */}
        <div className="mb-3 space-y-1">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-text-stone ">
              Value
            </span>
            <span className="text-sm font-bold text-text-ink ">
              {formatCurrency(weightedValue)}
            </span>
          </div>
          <div className="w-full bg-border-line  h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-brand-andaman h-full rounded-full"
              style={{ width: `${opportunity.probability}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-stone ">
              {formatCurrency(opportunity.valueThb ?? 0)}
            </span>
            <span className="font-medium text-text-ink ">
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
          <span className="text-xs text-text-stone ">
            {daysInStage}d
          </span>
        </div>

        {/* Quick Actions */}
        <div className="pt-2 border-t border-border-line  flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="flex-1 text-xs py-1 px-2 rounded bg-surface-paper  text-text-ink  hover:bg-surface-ivory  transition-colors">
            Details
          </button>
          <button className="flex-1 text-xs py-1 px-2 rounded bg-surface-paper  text-text-ink  hover:bg-surface-ivory  transition-colors">
            Activity
          </button>
        </div>
      </div>
    );
  }
);

OpportunityCard.displayName = 'OpportunityCard';
