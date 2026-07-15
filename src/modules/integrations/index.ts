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

export {
  importICalEvents,
  createConflictNotifications,
  clearOtaImports,
  type ICalEvent,
  type ICalImportResult,
} from './ical-import';

export {
  registerWhatsAppAccount,
  registerTelegramAccount,
  sendMessengerMessage,
  handleMessengerWebhook,
  getMessengerStatus,
  MessengerChannel,
  type MessengerConfig,
} from './messenger';

export {
  registerHubSpotCrm,
  syncIdentityToCrm,
  syncBookingToCrm,
  handleCrmWebhook,
  getCrmStatus,
  type CrmConfig,
  type CrmContact,
} from './crm';
