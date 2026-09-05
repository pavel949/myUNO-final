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
  new: 'bg-slate-100 text-slate-700',
  qualified: 'bg-blue-100  text-blue-700',
  discovery: 'bg-indigo-100 text-indigo-700',
  proposal: 'bg-purple-100 text-purple-700',
  negotiation: 'bg-orange-100 text-orange-700',
  nurture: 'bg-yellow-100 text-yellow-700',
  won: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
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
    <div className="bg-surface-paper rounded-lg shadow">
      {/* Header */}
      <div className="p-4 border-b border-border-line  flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 font-medium text-text-ink hover:text-brand-andaman transition-colors"
        >
          Filters & Search
          {hasActiveFilters && (
            <span className="ml-2 inline-block w-2 h-2 bg-brand-andaman rounded-full" />
          )}
        </button>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-text-stone hover:text-text-ink transition-colors"
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
            <label className="block text-sm font-medium text-text-ink  mb-2">
              Search
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange({ search: e.target.value })}
              placeholder="Contact name, title, email..."
              className="w-full px-3 py-2 border border-border-line  rounded-lg bg-surface-paper  text-text-ink  placeholder:text-text-stone-2 "
            />
          </div>

          {/* Stages */}
          <div>
            <label className="block text-sm font-medium text-text-ink  mb-2">
              Stages
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {STAGES.map((stage) => (
                <button
                  key={stage}
                  onClick={() => toggleStage(stage)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    filters.stages.includes(stage)
                      ? `${STAGE_COLORS[stage]} ring-2 ring-offset-0`
                      : 'bg-surface-ivory text-text-ink  hover:bg-surface-ivory '
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
              <label className="block text-sm font-medium text-text-ink  mb-2">
                Types
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {opportunityTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      filters.types.includes(type)
                        ? 'bg-brand-andaman text-surface-ivory'
                        : 'bg-surface-ivory text-text-ink  hover:bg-surface-ivory '
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
            <label className="block text-sm font-medium text-text-ink  mb-2">
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
                className="rounded border-border-line"
              />
              <span className="text-sm text-text-ink ">
                Show only assigned opportunities
              </span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
