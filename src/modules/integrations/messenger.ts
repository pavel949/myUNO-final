import { PrismaClient, IntegrationKey, IntegrationStatus } from '@prisma/client';
import { registerIntegrationAccount, getIntegrationAccount, recordIntegrationSync } from './integrations';

export enum MessengerChannel {
  WHATSAPP = 'whatsapp',
  TELEGRAM = 'telegram',
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
 * Stub for loop one; routes to mock send for testing until real adapter is configured.
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

    // Stub: In production, this would:
    // 1. Call the messenger provider's API (Twilio, official WhatsApp API, Telegram API)
    // 2. Send the message
    // 3. Return external message ID for tracking
    //
    // For loop one, just log that the message would be sent.
    console.log(
      `[Messenger stub] ${channel} message to ${recipientPhone}: ${messageBody}`
    );

    // Record sync attempt
    await recordIntegrationSync(db, account.id);

    return {
      success: true,
      messageId: `stub-${Date.now()}`,
    };
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
  channel: MessengerChannel,
  payload: Record<string, any>,
): Promise<boolean> {
  try {
    // Stub: In production, this would:
    // 1. Verify webhook signature (provider-specific)
    // 2. Parse incoming message or status event
    // 3. Create Thread/Message records or update delivery status
    // 4. Emit notifications as needed
    //
    // For loop one, just log the event.
    console.log(`[Messenger webhook] ${channel} event:`, JSON.stringify(payload));

    return true;
  } catch (error) {
    console.error(`[Messenger webhook] Error processing ${channel} event:`, error);
    return false;
  }
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
