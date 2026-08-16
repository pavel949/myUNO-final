'use client';

import { FC, useMemo } from 'react';
import { ActivityItem } from './ActivityItem';
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

interface ActivityTimelineProps {
  activities: Activity[];
}

const getActivityIcon = (type: CrmActivityType): string => {
  const icons: Record<CrmActivityType, string> = {
    note: '📝',
    task: '✅',
    call: '☎️',
    meeting: '📅',
    email: '✉️',
    whatsapp: '💬',
    telegram: '✈️',
    system: '⚙️',
  };
  return icons[type] || '•';
};

const getActivityLabel = (type: CrmActivityType): string => {
  const labels: Record<CrmActivityType, string> = {
    note: 'Note',
    task: 'Task',
    call: 'Call',
    meeting: 'Meeting',
    email: 'Email',
    whatsapp: 'WhatsApp',
    telegram: 'Telegram',
    system: 'System',
  };
  return labels[type] || type;
};

export const ActivityTimeline: FC<ActivityTimelineProps> = ({
  activities,
}) => {
  const groupedByDay = useMemo(() => {
    const groups: Record<string, Activity[]> = {};

    activities.forEach((activity) => {
      const date = new Date(activity.createdAt);
      const dateKey = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(activity);
    });

    return groups;
  }, [activities]);

  if (activities.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">
          No activities yet. Log one to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {Object.entries(groupedByDay).map(([dateKey, dayActivities]) => (
        <div key={dateKey}>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="inline-block w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs">
              {dayActivities.length}
            </span>
            {dateKey}
          </h3>

          <div className="space-y-3 ml-4">
            {dayActivities.map((activity) => (
              <ActivityItem
                key={activity.id}
                activity={activity}
                icon={getActivityIcon(activity.type)}
                label={getActivityLabel(activity.type)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
