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
export {
  grantConsent,
  withdrawConsent,
  denyConsent,
  getConsentStatus,
  hasConsent,
  getConsentHistory,
  getConsentSummary,
} from './consent.service';
export type { ConsentDecisionInput } from './consent.service';
