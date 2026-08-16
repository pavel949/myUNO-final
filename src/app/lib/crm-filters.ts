import type { OpportunityFilters } from '@/app/components/crm/OpportunitiesFilterPanel';
import type { CrmOpportunity } from '@prisma/client';

export interface SerializedOpportunity extends Omit<CrmOpportunity, 'createdAt' | 'updatedAt' | 'expectedCloseAt' | 'nextActionAt' | 'wonAt' | 'lostAt'> {
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

export const applyOpportunityFilters = (
  opportunities: SerializedOpportunity[],
  filters: OpportunityFilters
): SerializedOpportunity[] => {
  return opportunities.filter((opp) => {
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const searchMatch =
        opp.title.toLowerCase().includes(searchLower) ||
        opp.contact?.name.toLowerCase().includes(searchLower) ||
        opp.contact?.email?.toLowerCase().includes(searchLower);
      if (!searchMatch) return false;
    }

    // Stage filter
    if (filters.stages.length > 0) {
      if (!filters.stages.includes(opp.stage)) return false;
    }

    // Type filter
    if (filters.types.length > 0) {
      if (!filters.types.includes(opp.type)) return false;
    }

    // Probability range filter
    if (opp.probability < filters.minProbability || opp.probability > filters.maxProbability) {
      return false;
    }

    // Assigned only filter
    if (filters.assignedOnly && !opp.assignedTo) {
      return false;
    }

    return true;
  });
};

export const extractOpportunityTypes = (opportunities: SerializedOpportunity[]): string[] => {
  const types = new Set<string>();
  opportunities.forEach((opp) => {
    if (opp.type) types.add(opp.type);
  });
  return Array.from(types).sort();
};
