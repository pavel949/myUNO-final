export {
  addActivity,
  capturePublicLead,
  completeActivity,
  createOpportunity,
  ensureCrmProfile,
  getPipeline,
  transitionOpportunity,
} from './crm.service';
export {
  lifecycleAfterWin,
  opportunityTypeForAudience,
  parseLeadContact,
  validateProbability,
} from './domain';
export type { ActivityInput, OpportunityInput, PublicLeadInput } from './crm.service';
