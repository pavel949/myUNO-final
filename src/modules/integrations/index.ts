// module: integrations — public interface (see docs/14_tech_spec.md §3)
// Owns: Integration accounts and channel adapters (OTA, messenger, payment, exports)
// Depends on: core, booking, comms, finance

export {
  registerIntegrationAccount,
  getIntegrationAccount,
  getDecryptedConfig,
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
  syncICalAccount,
  syncAllICalAccounts,
  readFeedUrl,
  ICAL_INTEGRATION_KEYS,
  type SyncOneResult,
  type SyncAllResult,
} from './ical-sync';

export { parseICal, type ParseResult } from './ical-parse';

export {
  fetchICalFeed,
  assertSafeFeedUrl,
  ICalFetchError,
} from './ical-fetch';

export {
  registerWhatsAppAccount,
  registerTelegramAccount,
  sendMessengerMessage,
  handleMessengerWebhook,
  getMessengerStatus,
  MessengerChannel,
  type MessengerConfig,
} from './messenger';
