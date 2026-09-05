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
    open: 'bg-yellow-100 text-yellow-800',
    completed:
      'bg-green-100 text-green-800',
    cancelled:
      'bg-surface-ivory text-text-ink ',
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
          ? 'border-green-500 bg-green-50'
          : isPastDue
            ? 'border-red-500 bg-state-error-soft'
            : 'border-brand-andaman bg-brand-andaman-soft'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="text-lg mt-0.5">{icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-text-ink ">
                {label}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded ${getStatusColor(activity.status)}`}
              >
                {getStatusLabel(activity.status)}
              </span>
              {isPastDue && (
                <span className="text-xs px-2 py-0.5 rounded bg-state-error-soft text-state-error">
                  Overdue
                </span>
              )}
            </div>
            <p
              className={`text-sm font-medium line-clamp-2 cursor-pointer hover:underline ${
                activity.status === 'completed'
                  ? 'text-text-stone  line-through'
                  : 'text-text-ink '
              }`}
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {activity.subject}
            </p>
            {activity.dueAt && (
              <p className="text-xs text-text-stone  mt-1">
                Due: {new Date(activity.dueAt).toLocaleDateString()} at{' '}
                {new Date(activity.dueAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
            {isExpanded && activity.body && (
              <div className="mt-3 p-3 bg-surface-paper rounded border border-border-line  text-sm text-text-ink ">
                {activity.body}
              </div>
            )}
            {isExpanded && activity.createdBy && (
              <p className="text-xs text-text-stone  mt-2">
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
                  ? 'bg-green-200 text-green-800'
                  : 'bg-surface-ivory  text-text-ink  hover:bg-border-line '
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
