// module: integrations — public interface
// Owns: Integration accounts, federation contracts, channel adapters and exports

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
  ingestFederationEvent,
  upsertExternalMapping,
  markFederationEventProcessed,
  markFederationEventFailed,
  type FederationEventInput,
} from './federation.service';

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

export {
  getUnitIcalConflictAlerts,
  getProjectIcalConflictAlerts,
  type UnitIcalConflictAlert,
} from './unit-ical-conflicts';

export { parseICal, type ParseResult } from './ical-parse';

export { fetchICalFeed, assertSafeFeedUrl, ICalFetchError } from './ical-fetch';

export {
  registerWhatsAppAccount,
  registerTelegramAccount,
  sendMessengerMessage,
  handleMessengerWebhook,
  getMessengerStatus,
  MessengerChannel,
  type MessengerConfig,
} from './messenger';
