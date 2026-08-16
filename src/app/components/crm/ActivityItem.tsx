'use client';

import { FC, useState } from 'react';
import type { CrmActivityType, CrmActivityStatus } from '@prisma/client';

interface Activity {
  id: string;
  type: CrmActivityType;
  status: CrmActivityStatus;
  subject: string;
  body: string | null;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string;
  } | null;
}

interface ActivityItemProps {
  activity: Activity;
  icon: string;
  label: string;
}

const getStatusColor = (status: CrmActivityStatus): string => {
  const colors: Record<CrmActivityStatus, string> = {
    open: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
    completed:
      'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
    cancelled:
      'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
  };
  return colors[status] || colors.open;
};

const getStatusLabel = (status: CrmActivityStatus): string => {
  const labels: Record<CrmActivityStatus, string> = {
    open: 'Open',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return labels[status];
};

export const ActivityItem: FC<ActivityItemProps> = ({
  activity,
  icon,
  label,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggleComplete = async () => {
    try {
      setIsUpdating(true);
      const newStatus = activity.status === 'open' ? 'completed' : 'open';
      const response = await fetch(`/api/crm/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        activity.status = newStatus;
      }
    } catch (error) {
      console.error('Failed to update activity:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const isPastDue =
    activity.status === 'open' &&
    activity.dueAt &&
    new Date(activity.dueAt) < new Date();

  return (
    <div
      className={`border-l-4 pl-4 py-3 rounded-r-lg transition-colors ${
        activity.status === 'completed'
          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
          : isPastDue
            ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
            : 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="text-lg mt-0.5">{icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {label}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded ${getStatusColor(activity.status)}`}
              >
                {getStatusLabel(activity.status)}
              </span>
              {isPastDue && (
                <span className="text-xs px-2 py-0.5 rounded bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                  Overdue
                </span>
              )}
            </div>
            <p
              className={`text-sm font-medium line-clamp-2 cursor-pointer hover:underline ${
                activity.status === 'completed'
                  ? 'text-gray-600 dark:text-gray-400 line-through'
                  : 'text-gray-900 dark:text-white'
              }`}
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {activity.subject}
            </p>
            {activity.dueAt && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Due: {new Date(activity.dueAt).toLocaleDateString()} at{' '}
                {new Date(activity.dueAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
            {isExpanded && activity.body && (
              <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300">
                {activity.body}
              </div>
            )}
            {isExpanded && activity.createdBy && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                By {activity.createdBy.name} •{' '}
                {new Date(activity.createdAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {activity.type === 'task' && (
            <button
              onClick={handleToggleComplete}
              disabled={isUpdating}
              className={`p-2 rounded transition-colors ${
                activity.status === 'completed'
                  ? 'bg-green-200 dark:bg-green-700 text-green-800 dark:text-green-200'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {isUpdating ? '...' : activity.status === 'completed' ? '✓' : '○'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
