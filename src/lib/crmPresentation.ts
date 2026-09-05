import type { CrmOpportunityType } from '@prisma/client';
import { STATUS_VARIANT_CLASSES, type StatusVariant } from './status';

/**
 * Opportunity type → chip color (doc 06 §3.4 mapping, canvas board 10/02):
 * "info for rental, warning for purchase, outline for advisory". Extended
 * here to the rest of CrmOpportunityType on the same rationale: an ongoing
 * revenue engagement (rental, management) reads as info; a one-time
 * transactional deal (purchase, sale) reads as warning; advisory and
 * non-revenue engagements (developer_advisory, compliance, capex) read as
 * neutral. Single source — nobody picks this chip's color ad hoc.
 */
const OPPORTUNITY_TYPE_VARIANT: Record<CrmOpportunityType, StatusVariant> = {
  rental: 'info',
  management: 'info',
  purchase: 'warning',
  sale: 'warning',
  developer_advisory: 'neutral',
  compliance: 'neutral',
  capex: 'neutral',
};

export function getOpportunityTypeVariant(type: CrmOpportunityType | string): StatusVariant {
  return OPPORTUNITY_TYPE_VARIANT[type as CrmOpportunityType] ?? 'neutral';
}

export function getOpportunityTypeChipClasses(type: CrmOpportunityType | string): string {
  return STATUS_VARIANT_CLASSES[getOpportunityTypeVariant(type)];
}

/**
 * Pipeline stage → color (canvas board 10): "Sequential andaman ramp, dark
 * reads as late stage; won is success, lost is stone." Won and lost are
 * terminal outcomes, not points on the ramp, so they use the §3.4 status
 * tokens instead — never a series color for a status, per doc 06 §3.5.
 */
const STAGE_RAMP_CLASSES: Record<string, string> = {
  new: 'bg-chart-seq-1 text-text-ink',
  qualified: 'bg-chart-seq-2 text-text-ink',
  discovery: 'bg-chart-seq-3 text-surface-ivory',
  proposal: 'bg-chart-seq-4 text-surface-ivory',
  negotiation: 'bg-chart-seq-5 text-surface-ivory',
  nurture: 'bg-chart-seq-1 text-text-ink',
};

export function getStageClasses(stage: string): string {
  if (stage === 'won') return STATUS_VARIANT_CLASSES.success;
  if (stage === 'lost') return STATUS_VARIANT_CLASSES.neutral;
  return STAGE_RAMP_CLASSES[stage] ?? STATUS_VARIANT_CLASSES.neutral;
}
