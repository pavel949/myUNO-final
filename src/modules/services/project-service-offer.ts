export type ProjectServiceRow = {
  project_id: string;
  enabled: boolean;
  public: boolean;
  price_override_thb: number | null;
  take_rate_pct: { toNumber(): number } | number | null;
  lead_time_hours: number | null;
  terms_version: number;
  effective_from: Date | null;
  effective_to: Date | null;
};

export type ResolvedProjectServiceOffer = {
  available: boolean;
  publiclyVisible: boolean;
  source: 'global' | 'project' | 'unavailable';
  unitPriceThb: number | null;
  leadTimeHours: number;
  takeRatePct: number | null;
  termsVersion: number | null;
};

function decimalNumber(value: ProjectServiceRow['take_rate_pct']): number | null {
  if (value === null) return null;
  if (typeof value === 'number') return value;
  const n = value.toNumber();
  return Number.isFinite(n) ? n : null;
}

/**
 * One interpretation of ServiceProject for discovery, detail and ordering.
 * No rows means a platform-wide service. Once a service has project rows it is
 * restricted to those projects. A project row can be private/disabled and can
 * carry project-specific money/lead-time terms.
 */
export function resolveProjectServiceOffer(input: {
  rows: ProjectServiceRow[];
  projectId: string;
  basePriceThb: number | null;
  baseLeadTimeHours: number;
  at?: Date;
}): ResolvedProjectServiceOffer {
  const at = input.at ?? new Date();
  if (input.rows.length === 0) {
    return {
      available: true,
      publiclyVisible: true,
      source: 'global',
      unitPriceThb: input.basePriceThb,
      leadTimeHours: input.baseLeadTimeHours,
      takeRatePct: null,
      termsVersion: null,
    };
  }

  const row = input.rows.find(item => item.project_id === input.projectId);
  if (!row) {
    return {
      available: false,
      publiclyVisible: false,
      source: 'unavailable',
      unitPriceThb: null,
      leadTimeHours: input.baseLeadTimeHours,
      takeRatePct: null,
      termsVersion: null,
    };
  }

  const effective =
    (!row.effective_from || row.effective_from <= at) &&
    (!row.effective_to || at < row.effective_to);
  const available = row.enabled && effective;
  return {
    available,
    publiclyVisible: available && row.public,
    source: 'project',
    unitPriceThb: row.price_override_thb ?? input.basePriceThb,
    leadTimeHours: row.lead_time_hours ?? input.baseLeadTimeHours,
    takeRatePct: decimalNumber(row.take_rate_pct),
    termsVersion: row.terms_version,
  };
}
