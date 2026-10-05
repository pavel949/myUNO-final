export interface LongTermLeaseTerms {
  monthlyRentThb: number | null;
  minimumLeaseMonths: number | null;
  maximumLeaseMonths: number | null;
  availableFrom: string | null;
  securityDepositMonths: number | null;
  advanceRentMonths: number | null;
  petsAllowed: boolean | null;
  utilitiesIncluded: string[];
  utilitiesExcluded: string[];
}

export interface LongTermLeaseSearch {
  moveIn?: string | null;
  leaseTermMonths?: number | null;
  pets?: 'yes' | 'no' | 'any' | null;
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const positiveNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null;

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [];

const isoDate = (value: unknown): string | null => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}(?:-\d{2})?$/.test(value)) return null;
  return value.length === 7 ? value + '-01' : value;
};

export function normalizeLongTermLeaseTerms(
  pricingTerms: unknown,
  rulesAndPolicies: unknown,
): LongTermLeaseTerms {
  const pricing = record(pricingTerms);
  const rules = record(rulesAndPolicies);
  return {
    monthlyRentThb:
      positiveNumber(pricing.monthlyRentThb) ??
      positiveNumber(pricing.monthlyThb),
    minimumLeaseMonths:
      positiveNumber(rules.minimumLeaseMonths) ??
      positiveNumber(pricing.minimumLeaseMonths),
    maximumLeaseMonths:
      positiveNumber(rules.maximumLeaseMonths) ??
      positiveNumber(pricing.maximumLeaseMonths),
    availableFrom:
      isoDate(rules.availableFrom) ??
      isoDate(pricing.availableFrom),
    securityDepositMonths:
      positiveNumber(pricing.securityDepositMonths),
    advanceRentMonths:
      positiveNumber(pricing.advanceRentMonths),
    petsAllowed:
      typeof rules.petsAllowed === 'boolean'
        ? rules.petsAllowed
        : typeof pricing.petsAllowed === 'boolean'
          ? pricing.petsAllowed
          : null,
    utilitiesIncluded: stringArray(pricing.utilitiesIncluded),
    utilitiesExcluded: stringArray(pricing.utilitiesExcluded),
  };
}

function searchMoveInDate(value?: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}(?:-\d{2})?$/.test(value)) return null;
  return value.length === 7 ? value + '-01' : value;
}

export function matchesLongTermLeaseSearch(
  terms: LongTermLeaseTerms,
  search: LongTermLeaseSearch,
): boolean {
  const term = search.leaseTermMonths ?? null;
  if (term !== null) {
    if (terms.minimumLeaseMonths !== null && term < terms.minimumLeaseMonths) return false;
    if (terms.maximumLeaseMonths !== null && term > terms.maximumLeaseMonths) return false;
  }

  const requestedMoveIn = searchMoveInDate(search.moveIn);
  if (requestedMoveIn && terms.availableFrom && terms.availableFrom > requestedMoveIn) return false;

  if (search.pets === 'yes' && terms.petsAllowed === false) return false;
  return true;
}
