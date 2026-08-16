'use client';

import { FC } from 'react';

interface SummaryMetrics {
  totalDeals: number;
  totalValue: number;
  weightedForecast: number;
  winRate: string;
  stageBreakdown: Record<
    string,
    { count: number; value: number; weightedValue: number }
  >;
}

interface DashboardActivity {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'task' | 'note';
  subject: string;
  createdAt: Date;
  contact?: {
    id: string;
    name: string;
  };
  opportunity?: {
    id: string;
    title: string;
  };
}

interface CrmDashboardProps {
  summary: SummaryMetrics;
  overdueTasks: DashboardActivity[];
  recentActivities: DashboardActivity[];
}

const formatCurrency = (value: number): string => {
  if (value >= 1_000_000) {
    return `฿${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `฿${(value / 1_000).toFixed(1)}K`;
  }
  return `฿${value}`;
};

const getActivityIcon = (type: string): string => {
  switch (type) {
    case 'call':
      return '☎️';
    case 'email':
      return '✉️';
    case 'meeting':
      return '📅';
    case 'task':
      return '✅';
    case 'note':
      return '📝';
    default:
      return '📌';
  }
};

export const CrmDashboard: FC<CrmDashboardProps> = ({
  summary,
  overdueTasks,
  recentActivities,
}) => {
  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          label="Total Deals"
          value={summary.totalDeals}
          icon="📊"
        />
        <MetricCard
          label="Total Value"
          value={formatCurrency(summary.totalValue)}
          icon="💰"
        />
        <MetricCard
          label="Weighted Forecast"
          value={formatCurrency(summary.weightedForecast)}
          icon="📈"
        />
        <MetricCard
          label="Win Rate"
          value={`${summary.winRate}%`}
          icon="🏆"
        />
        <MetricCard
          label="In Progress"
          value={
            summary.stageBreakdown['qualified'].count +
            summary.stageBreakdown['discovery'].count +
            summary.stageBreakdown['proposal'].count +
            summary.stageBreakdown['negotiation'].count
          }
          icon="⚙️"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Breakdown */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Pipeline Breakdown
          </h3>
          <div className="space-y-3">
            {Object.entries(summary.stageBreakdown).map(
              ([stage, data]) => (
                <div key={stage} className="flex items-center gap-4">
                  <div className="w-32 text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                    {stage}
                  </div>
                  <div className="flex-1">
                    <div className="w-full h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                      {/* Count bar */}
                      <div
                        className="bg-blue-500 flex items-center justify-center text-xs font-bold text-white"
                        style={{
                          width: `${(data.count / summary.totalDeals) * 100}%`,
                          minWidth: '30px',
                        }}
                      >
                        {data.count}
                      </div>
                    </div>
                  </div>
                  <div className="w-24 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                    {formatCurrency(data.weightedValue)}
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* Overdue Tasks */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Overdue Tasks
          </h3>
          {overdueTasks.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              No overdue tasks
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {overdueTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800"
                >
                  <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">
                    ⚠️ {task.subject}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {task.contact?.name}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activities */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Recent Activities
        </h3>
        {recentActivities.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            No activities yet
          </p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {recentActivities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <span className="text-lg flex-shrink-0">
                  {getActivityIcon(activity.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {activity.subject}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {activity.contact?.name} •{' '}
                    {new Date(activity.createdAt).toLocaleDateString()}
                  </p>
                  {activity.opportunity && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {activity.opportunity.title}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: string;
}

const MetricCard: FC<MetricCardProps> = ({ label, value, icon }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs text-gray-600 dark:text-gray-400 uppercase font-semibold">
          {label}
        </p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
          {value}
        </p>
      </div>
      <span className="text-3xl">{icon}</span>
    </div>
  </div>
);
