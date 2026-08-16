'use client';

import { FC, useState, useCallback } from 'react';

export interface OpportunityFilters {
  search: string;
  stages: string[];
  types: string[];
  minProbability: number;
  maxProbability: number;
  assignedOnly: boolean;
}

interface OpportunitiesFilterPanelProps {
  onFiltersChange: (filters: OpportunityFilters) => void;
  opportunityTypes: string[];
}

const STAGES = [
  'new',
  'qualified',
  'discovery',
  'proposal',
  'negotiation',
  'nurture',
  'won',
  'lost',
];

const STAGE_COLORS: Record<string, string> = {
  new: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
  qualified: 'bg-blue-100 dark:bg-blue-700 text-blue-700 dark:text-blue-300',
  discovery: 'bg-indigo-100 dark:bg-indigo-700 text-indigo-700 dark:text-indigo-300',
  proposal: 'bg-purple-100 dark:bg-purple-700 text-purple-700 dark:text-purple-300',
  negotiation: 'bg-orange-100 dark:bg-orange-700 text-orange-700 dark:text-orange-300',
  nurture: 'bg-yellow-100 dark:bg-yellow-700 text-yellow-700 dark:text-yellow-300',
  won: 'bg-green-100 dark:bg-green-700 text-green-700 dark:text-green-300',
  lost: 'bg-red-100 dark:bg-red-700 text-red-700 dark:text-red-300',
};

export const OpportunitiesFilterPanel: FC<OpportunitiesFilterPanelProps> = ({
  onFiltersChange,
  opportunityTypes,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState<OpportunityFilters>({
    search: '',
    stages: [],
    types: [],
    minProbability: 0,
    maxProbability: 100,
    assignedOnly: false,
  });

  const handleFilterChange = useCallback((newFilters: Partial<OpportunityFilters>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);
    onFiltersChange(updated);
  }, [filters, onFiltersChange]);

  const toggleStage = (stage: string) => {
    const newStages = filters.stages.includes(stage)
      ? filters.stages.filter((s) => s !== stage)
      : [...filters.stages, stage];
    handleFilterChange({ stages: newStages });
  };

  const toggleType = (type: string) => {
    const newTypes = filters.types.includes(type)
      ? filters.types.filter((t) => t !== type)
      : [...filters.types, type];
    handleFilterChange({ types: newTypes });
  };

  const clearFilters = () => {
    const cleared: OpportunityFilters = {
      search: '',
      stages: [],
      types: [],
      minProbability: 0,
      maxProbability: 100,
      assignedOnly: false,
    };
    setFilters(cleared);
    onFiltersChange(cleared);
  };

  const hasActiveFilters =
    filters.search ||
    filters.stages.length > 0 ||
    filters.types.length > 0 ||
    filters.minProbability > 0 ||
    filters.maxProbability < 100 ||
    filters.assignedOnly;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <span className="text-lg">🔍</span>
          Filters & Search
          {hasActiveFilters && (
            <span className="ml-2 inline-block w-2 h-2 bg-blue-500 rounded-full" />
          )}
        </button>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Filters */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange({ search: e.target.value })}
              placeholder="Contact name, title, email..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>

          {/* Stages */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Stages
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {STAGES.map((stage) => (
                <button
                  key={stage}
                  onClick={() => toggleStage(stage)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    filters.stages.includes(stage)
                      ? `${STAGE_COLORS[stage]} ring-2 ring-offset-0 dark:ring-offset-gray-800`
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {stage.charAt(0).toUpperCase() + stage.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Types */}
          {opportunityTypes.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Types
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {opportunityTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      filters.types.includes(type)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Probability Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Probability: {filters.minProbability}% – {filters.maxProbability}%
            </label>
            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max="100"
                value={filters.minProbability}
                onChange={(e) =>
                  handleFilterChange({ minProbability: parseInt(e.target.value) })
                }
                className="w-full"
              />
              <input
                type="range"
                min="0"
                max="100"
                value={filters.maxProbability}
                onChange={(e) =>
                  handleFilterChange({ maxProbability: parseInt(e.target.value) })
                }
                className="w-full"
              />
            </div>
          </div>

          {/* Assigned Only */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.assignedOnly}
                onChange={(e) =>
                  handleFilterChange({ assignedOnly: e.target.checked })
                }
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Show only assigned opportunities
              </span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
