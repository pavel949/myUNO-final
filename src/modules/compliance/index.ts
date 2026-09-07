// module: compliance — public interface (see docs/14_tech_spec.md §3)
// Owns: TM30Filing, PassportCapture, ComplianceRecord, RegulatoryCredential, CommercialEligibilityEngine

export {
  evaluateCommercialEligibility,
  canPublishShortTerm,
  canPublishLongTerm,
  canPublishSale,
  type CommercialEligibilityQuery,
  type CommercialEligibilityResult,
} from './commercial-eligibility.engine';
