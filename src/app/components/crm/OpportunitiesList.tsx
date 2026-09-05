'use client';

import { FC, useMemo, useState } from 'react';
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

interface OpportunitiesListProps {
  opportunities: SerializedOpportunity[];
  onRowClick?: (id: string) => void;
}

type SortKey = 'stage' | 'probability' | 'value' | 'age' | 'date';

const STAGE_COLORS: Record<string, string> = {
  new: 'text-slate-700',
  qualified: 'text-blue-700',
  discovery: 'text-indigo-700',
  proposal: 'text-purple-700',
  negotiation: 'text-orange-700',
  nurture: 'text-yellow-700',
  won: 'text-green-700',
  lost: 'text-red-700',
};

const getDaysInStage = (createdAt: string | Date): number => {
  const now = new Date();
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  return Math.floor(
    (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
  );
};

const formatCurrency = (value: number): string => {
  if (value >= 1_000_000) {
    return `฿${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `฿${(value / 1_000).toFixed(1)}K`;
  }
  return `฿${value}`;
};

export const OpportunitiesList: FC<OpportunitiesListProps> = ({
  opportunities,
  onRowClick,
}) => {
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({
    key: 'date',
    asc: false,
  });

  const sorted = useMemo(() => {
    const copy = [...opportunities];

    copy.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sort.key) {
        case 'stage':
          aVal = a.stage;
          bVal = b.stage;
          break;
        case 'probability':
          aVal = a.probability;
          bVal = b.probability;
          break;
        case 'value':
          aVal = ((a.valueThb ?? 0) * a.probability) / 100;
          bVal = ((b.valueThb ?? 0) * b.probability) / 100;
          break;
        case 'age':
          aVal = getDaysInStage(a.createdAt);
          bVal = getDaysInStage(b.createdAt);
          break;
        case 'date':
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
      }

      if (typeof aVal === 'string') {
        return sort.asc
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sort.asc ? aVal - bVal : bVal - aVal;
    });

    return copy;
  }, [opportunities, sort]);

  const toggleSort = (key: SortKey) => {
    setSort((prev) => ({
      key,
      asc: prev.key === key ? !prev.asc : false,
    }));
  };

  return (
    <div className="w-full">
      {/* Desktop Table View */}
      <div className="hidden lg:block bg-surface-paper rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
        <thead className="bg-surface-ivory border-b border-border-line ">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-text-ink ">
              Contact
            </th>
            <th className="px-4 py-3 text-left font-semibold text-text-ink ">
              Opportunity
            </th>
            <th
              className="px-4 py-3 text-left font-semibold text-text-ink  cursor-pointer hover:bg-surface-ivory "
              onClick={() => toggleSort('stage')}
            >
              Stage{' '}
              {sort.key === 'stage' && (sort.asc ? '↑' : '↓')}
            </th>
            <th
              className="px-4 py-3 text-left font-semibold text-text-ink  cursor-pointer hover:bg-surface-ivory "
              onClick={() => toggleSort('probability')}
            >
              Probability{' '}
              {sort.key === 'probability' && (sort.asc ? '↑' : '↓')}
            </th>
            <th
              className="px-4 py-3 text-right font-semibold text-text-ink  cursor-pointer hover:bg-surface-ivory "
              onClick={() => toggleSort('value')}
            >
              Weighted Value{' '}
              {sort.key === 'value' && (sort.asc ? '↑' : '↓')}
            </th>
            <th
              className="px-4 py-3 text-right font-semibold text-text-ink  cursor-pointer hover:bg-surface-ivory "
              onClick={() => toggleSort('age')}
            >
              Days in Stage{' '}
              {sort.key === 'age' && (sort.asc ? '↑' : '↓')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {sorted.map((opp) => (
            <tr
              key={opp.id}
              onClick={() => onRowClick?.(opp.id)}
              className="hover:bg-surface-ivory  cursor-pointer transition-colors"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {opp.contact?.avatar ? (
                    <div className="relative w-8 h-8 flex-shrink-0 rounded-full overflow-hidden">
                      <Image
                        src={opp.contact.avatar}
                        alt={opp.contact.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-border-line  flex-shrink-0 flex items-center justify-center">
                      <span className="text-xs font-bold">
                        {opp.contact?.name?.[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-text-ink ">
                      {opp.contact?.name || 'Unknown'}
                    </p>
                    <p className="text-xs text-text-stone ">
                      {opp.contact?.email}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <p className="font-medium text-text-ink  line-clamp-1">
                  {opp.title}
                </p>
              </td>
              <td className="px-4 py-3">
                <span className={`font-medium ${STAGE_COLORS[opp.stage]}`}>
                  {opp.stage.charAt(0).toUpperCase() + opp.stage.slice(1)}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-12 h-2 bg-border-line  rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-andaman"
                      style={{ width: `${opp.probability}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-text-ink  w-10">
                    {opp.probability}%
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-right font-medium text-text-ink ">
                {formatCurrency(
                  ((opp.valueThb ?? 0) * opp.probability) / 100
                )}
              </td>
              <td className="px-4 py-3 text-right text-text-stone ">
                {getDaysInStage(opp.createdAt)} days
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>

      {sorted.length === 0 && (
        <div className="hidden lg:block text-center py-12 bg-surface-paper rounded-lg">
          <p className="text-text-stone ">
            No opportunities yet
          </p>
        </div>
      )}

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-4">
        {sorted.length === 0 && (
          <div className="text-center py-12 bg-surface-paper rounded-lg">
            <p className="text-text-stone ">
              No opportunities yet
            </p>
          </div>
        )}
        {sorted.map((opp) => (
          <div
            key={opp.id}
            onClick={() => onRowClick?.(opp.id)}
            className="bg-surface-paper rounded-lg shadow p-4 space-y-3 cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="font-medium text-text-ink ">
                  {opp.title}
                </p>
                <p className="text-sm text-text-stone ">
                  {opp.contact?.name || 'Unknown'}
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded font-medium ${STAGE_COLORS[opp.stage]}`}>
                {opp.stage.charAt(0).toUpperCase() + opp.stage.slice(1)}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-text-stone ">Prob:</span>
                <div className="w-16 h-2 bg-border-line  rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-andaman"
                    style={{ width: `${opp.probability}%` }}
                  />
                </div>
                <span className="font-medium text-text-ink  w-8">
                  {opp.probability}%
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-text-stone  pt-2 border-t border-border-line ">
              <span>
                Value: {formatCurrency(((opp.valueThb ?? 0) * opp.probability) / 100)}
              </span>
              <span>{getDaysInStage(opp.createdAt)} days in stage</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
