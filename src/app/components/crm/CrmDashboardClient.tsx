'use client';

import { FC, useState } from 'react';
import { OpportunitiesKanban } from './OpportunitiesKanban';
import { OpportunitiesList } from './OpportunitiesList';
import { CrmDashboard } from './CrmDashboard';
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
    phone: string | null;
    avatar: string | null;
  } | null;
  assignedTo?: any;
  activities: any[];
}

interface CrmDashboardClientProps {
  opportunities: SerializedOpportunity[];
  summary: {
    totalDeals: number;
    totalValue: number;
    weightedForecast: number;
    winRate: string;
    stageBreakdown: Record<
      string,
      { count: number; value: number; weightedValue: number }
    >;
  };
  overdueTasks: any[];
  recentActivities: any[];
}

type ViewMode = 'dashboard' | 'kanban' | 'list';

export const CrmDashboardClient: FC<CrmDashboardClientProps> = ({
  opportunities,
  summary,
  overdueTasks,
  recentActivities,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    // In a real app, you'd refetch data here
  };

  return (
    <div className="space-y-6">
      {/* View Switcher */}
      <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <button
          onClick={() => setViewMode('dashboard')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'dashboard'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          📊 Dashboard
        </button>
        <button
          onClick={() => setViewMode('kanban')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'kanban'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          📋 Kanban
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'list'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          📑 List
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'dashboard' && (
        <CrmDashboard
          key={refreshKey}
          summary={summary}
          overdueTasks={overdueTasks}
          recentActivities={recentActivities}
        />
      )}

      {viewMode === 'kanban' && (
        <OpportunitiesKanban
          key={refreshKey}
          opportunities={opportunities}
          onUpdate={handleRefresh}
        />
      )}

      {viewMode === 'list' && (
        <OpportunitiesList
          key={refreshKey}
          opportunities={opportunities}
          onRowClick={(id) => {
            // TODO: Navigate to opportunity detail page
            console.log('Clicked opportunity:', id);
          }}
        />
      )}
    </div>
  );
};
