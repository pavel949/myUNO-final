'use client';

import { FC, useState, useEffect } from 'react';
import { ActivityTimeline } from './ActivityTimeline';
import { QuickActivityForm } from './QuickActivityForm';
import { RequirementsPanel } from './RequirementsPanel';

interface SerializedOpportunity {
  id: string;
  type: string;
  stage: string;
  title: string;
  source: string;
  valueThb: number | null;
  probability: number;
  requirements: any;
  expectedCloseAt: string | null;
  nextActionAt: string | null;
  wonAt: string | null;
  lostAt: string | null;
  lostReason: string | null;
  externalPartner: string | null;
  createdAt: string;
  updatedAt: string;
  contact: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  assignedTo: {
    id: string;
    name: string;
  } | null;
  project: {
    id: string;
    name: string;
    slug: string;
  } | null;
  unit: {
    id: string;
    name: string;
  } | null;
  activities: any[];
}

interface OpportunityDetailProps {
  opportunityId: string;
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

export const OpportunityDetail: FC<OpportunityDetailProps> = ({
  opportunityId,
}) => {
  const [opportunity, setOpportunity] = useState<SerializedOpportunity | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'requirements'>(
    'timeline'
  );

  useEffect(() => {
    const fetchOpportunity = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/crm/opportunities/${opportunityId}`
        );
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to load opportunity');
        }
        const data = await response.json();
        setOpportunity(data);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to load opportunity');
      } finally {
        setLoading(false);
      }
    };

    fetchOpportunity();
  }, [opportunityId]);

  const handleActivityAdded = async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const response = await fetch(
      `/api/crm/opportunities/${opportunityId}`
    );
    if (response.ok) {
      const data = await response.json();
      setOpportunity(data);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !opportunity) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-200 p-4 rounded-lg">
        {error || 'Opportunity not found'}
      </div>
    );
  }

  const weightedValue =
    ((opportunity.valueThb ?? 0) * opportunity.probability) / 100;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {opportunity.title}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {opportunity.contact.name} • {opportunity.source}
            </p>
          </div>
          <div
            className={`${STAGE_COLORS[opportunity.stage]} px-4 py-2 rounded-lg`}
          >
            <p className="font-semibold text-gray-900 dark:text-white">
              {opportunity.stage.charAt(0).toUpperCase() +
                opportunity.stage.slice(1)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400 uppercase">
              Value
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              ฿{(weightedValue / 1000).toFixed(1)}K
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400 uppercase">
              Probability
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {opportunity.probability}%
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400 uppercase">
              Type
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {opportunity.type}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400 uppercase">
              Assigned
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {opportunity.assignedTo?.name || '—'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400 uppercase">
              Expected Close
            </p>
            <p className="text-sm text-gray-900 dark:text-white">
              {opportunity.expectedCloseAt
                ? new Date(opportunity.expectedCloseAt).toLocaleDateString()
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400 uppercase">
              Next Action
            </p>
            <p className="text-sm text-gray-900 dark:text-white">
              {opportunity.nextActionAt
                ? new Date(opportunity.nextActionAt).toLocaleDateString()
                : '—'}
            </p>
          </div>
          {opportunity.project && (
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 uppercase">
                Project
              </p>
              <p className="text-sm text-gray-900 dark:text-white">
                {opportunity.project.name}
              </p>
            </div>
          )}
          {opportunity.unit && (
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 uppercase">
                Unit
              </p>
              <p className="text-sm text-gray-900 dark:text-white">
                {opportunity.unit.name}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'timeline'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Activity Timeline
          </button>
          <button
            onClick={() => setActiveTab('requirements')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'requirements'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Requirements
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'timeline' && (
            <div className="space-y-6">
              <QuickActivityForm
                opportunityId={opportunityId}
                onActivityAdded={handleActivityAdded}
              />
              <ActivityTimeline activities={opportunity.activities} />
            </div>
          )}
          {activeTab === 'requirements' && (
            <RequirementsPanel
              opportunityId={opportunityId}
              requirements={opportunity.requirements}
            />
          )}
        </div>
      </div>
    </div>
  );
};
