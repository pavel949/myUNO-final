import { PrismaClient, IntegrationKey, IntegrationStatus } from '@prisma/client';
import { registerIntegrationAccount, getIntegrationAccount, recordIntegrationSync } from './integrations';

export enum MessengerChannel {
  WHATSAPP = 'whatsapp',
  TELEGRAM = 'telegram',
}

/**
 * Reduce a recipient — an address or a phone number — to a correlatable stub.
 * Kept local rather than imported so the integrations module does not reach
 * into comms for a two-line helper.
 */
function redactRecipient(recipient: string): string {
  if (recipient.includes('@')) {
    const [local, domain] = recipient.split('@');
    return `${local.slice(0, 1)}***@${domain}`;
  }
  return recipient.length > 4 ? `***${recipient.slice(-2)}` : '***';
}

export interface MessengerConfig {
  apiKey?: string;
  apiSecret?: string;
  phoneNumber?: string;
  botToken?: string;
  botUsername?: string;
  webhookUrl?: string;
}

/**
 * Register a WhatsApp business account for a unit or project.
 * Stub for loop one; real adapter after Q-20 (provider selection).
 */
export async function registerWhatsAppAccount(
  db: PrismaClient,
  config: MessengerConfig,
  scopeId?: string,
  isUnit = false,
) {
  return await registerIntegrationAccount(
    db,
    IntegrationKey.whatsapp,
    isUnit ? 'unit' : 'project',
    { channel: MessengerChannel.WHATSAPP, ...config },
    scopeId
  );
}

/**
 * Register a Telegram bot for a unit or project.
 * Stub for loop one; real adapter after Q-20 (provider selection).
 */
export async function registerTelegramAccount(
  db: PrismaClient,
  config: MessengerConfig,
  scopeId?: string,
  isUnit = false,
) {
  return await registerIntegrationAccount(
    db,
    IntegrationKey.telegram,
    isUnit ? 'unit' : 'project',
    { channel: MessengerChannel.TELEGRAM, ...config },
    scopeId
  );
}

/**
 * Send a message via WhatsApp or Telegram.
 * Provider adapters are not implemented yet. A registered account or enabled
 * flag cannot establish delivery, so attempts fail explicitly until then.
 */
export async function sendMessengerMessage(
  db: PrismaClient,
  channel: MessengerChannel,
  recipientPhone: string,
  messageBody: string,
  scopeId?: string,
  isUnit = false,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Get the integration account for this channel
    const integrationKey = channel === MessengerChannel.WHATSAPP ? IntegrationKey.whatsapp : IntegrationKey.telegram;
    const account = await getIntegrationAccount(
      db,
      integrationKey,
      isUnit ? 'unit' : 'project',
      scopeId
    );

    if (!account) {
      return {
        success: false,
        error: `${channel} not configured for this scope`,
      };
    }

    if (account.status === IntegrationStatus.disabled) {
      return {
        success: false,
        error: `${channel} account is disabled`,
      };
    }

    const error = `MESSENGER_ADAPTER_UNAVAILABLE: ${channel} provider is not implemented`;
    // Log the attempted channel, never claim it was queued or sent. Contact
    // details and message content remain out of the log.
    console.log(
      `[Messenger unavailable] ${channel} delivery not attempted for ${redactRecipient(recipientPhone)} (${messageBody.length} chars)`
    );
    await recordIntegrationSync(db, account.id, error);
    return { success: false, error };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Webhook handler for incoming messenger events (message received, delivery confirmation, etc.).
 * Stub for loop one; real adapter after provider integration.
 */
export async function handleMessengerWebhook(
  _db: PrismaClient,
  _channel: MessengerChannel,
  _payload: Record<string, any>,
): Promise<boolean> {
  // No signature verification or event processing adapter exists. Never
  // acknowledge ingestion or log arbitrary private webhook payloads.
  return false;
}

/**
 * Get the status of a messenger account.
 */
export async function getMessengerStatus(
  db: PrismaClient,
  channel: MessengerChannel,
  scopeId?: string,
  isUnit = false,
) {
  const integrationKey = channel === MessengerChannel.WHATSAPP ? IntegrationKey.whatsapp : IntegrationKey.telegram;
  return await getIntegrationAccount(
    db,
    integrationKey,
    isUnit ? 'unit' : 'project',
    scopeId
  );
}
