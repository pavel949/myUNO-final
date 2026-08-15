'use client';

import { FC, useState, useMemo } from 'react';
import { OpportunitiesKanban } from './OpportunitiesKanban';
import { OpportunitiesList } from './OpportunitiesList';
import { CrmDashboard } from './CrmDashboard';
import { OpportunitiesFilterPanel, type OpportunityFilters } from './OpportunitiesFilterPanel';
import { applyOpportunityFilters, extractOpportunityTypes, type SerializedOpportunity } from '@/app/lib/crm-filters';

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
  const [filters, setFilters] = useState<OpportunityFilters>({
    search: '',
    stages: [],
    types: [],
    minProbability: 0,
    maxProbability: 100,
    assignedOnly: false,
  });

  const opportunityTypes = useMemo(() => extractOpportunityTypes(opportunities), [opportunities]);

  const filteredOpportunities = useMemo(
    () => applyOpportunityFilters(opportunities, filters),
    [opportunities, filters]
  );

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    // In a real app, you'd refetch data here
  };

  return (
    <div className="space-y-6">
      {/* Filter Panel */}
      <OpportunitiesFilterPanel
        onFiltersChange={setFilters}
        opportunityTypes={opportunityTypes}
      />

      {/* View Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
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
          opportunities={filteredOpportunities}
          onUpdate={handleRefresh}
        />
      )}

      {viewMode === 'list' && (
        <OpportunitiesList
          key={refreshKey}
          opportunities={filteredOpportunities}
          onRowClick={(id) => {
            // TODO: Navigate to opportunity detail page
            console.log('Clicked opportunity:', id);
          }}
        />
      )}
    </div>
  );
};
