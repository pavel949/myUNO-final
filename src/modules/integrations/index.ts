// module: integrations — public interface (see docs/14_tech_spec.md §3)
// Owns: Integration accounts, channel adapters (OTA, messenger, CRM, payment)
// Depends on: core, booking, comms, finance

export {
  registerIntegrationAccount,
  getIntegrationAccount,
  updateIntegrationStatus,
  recordIntegrationSync,
  disableIntegrationAccount,
  listIntegrationAccounts,
  type IntegrationAccountConfig,
} from './integrations';
