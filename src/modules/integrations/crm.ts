import { PrismaClient, IntegrationKey, IntegrationStatus } from '@prisma/client';
import { registerIntegrationAccount, getIntegrationAccount, recordIntegrationSync } from './integrations';

export interface CrmConfig {
  apiKey?: string;
  portalId?: string;
  webhookUrl?: string;
  [key: string]: any; // Provider-specific fields
}

export interface CrmContact {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  properties?: Record<string, any>;
}

/**
 * Register HubSpot CRM integration for a project.
 * Stub for loop one; real adapter after Q-20 (CRM provider selection).
 */
export async function registerHubSpotCrm(
  db: PrismaClient,
  config: CrmConfig,
  projectId?: string,
) {
  return await registerIntegrationAccount(
    db,
    IntegrationKey.crm_hubspot,
    'project',
    { provider: 'hubspot', ...config },
    projectId
  );
}

/**
 * Sync an identity (guest, owner, provider) to the CRM.
 * Creates or updates a contact record.
 *
 * Stub for loop one: just logs the sync.
 * Real: sends identity data to HubSpot API.
 */
export async function syncIdentityToCrm(
  db: PrismaClient,
  projectId: string,
  contact: CrmContact,
): Promise<{ success: boolean; contactId?: string; error?: string }> {
  try {
    // Get HubSpot integration for this project
    const crm = await getIntegrationAccount(
      db,
      IntegrationKey.crm_hubspot,
      'project',
      projectId
    );

    if (!crm) {
      return {
        success: false,
        error: 'HubSpot CRM not configured for this project',
      };
    }

    if (crm.status === IntegrationStatus.disabled) {
      return {
        success: false,
        error: 'HubSpot CRM is disabled',
      };
    }

    // Stub: In production, this would:
    // 1. Build HubSpot contact object from identity data
    // 2. Call HubSpot API to create or update contact
    // 3. Map identity fields to HubSpot properties
    // 4. Return external contact ID
    //
    // For loop one, just log the sync.
    console.log(
      `[CRM stub] Sync identity to HubSpot: ${contact.email}`,
      contact
    );

    // Record sync attempt
    await recordIntegrationSync(db, crm.id);

    return {
      success: true,
      contactId: `crm-stub-${Date.now()}`,
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
 * Sync a booking to the CRM as a deal.
 * Creates a sales pipeline opportunity.
 *
 * Stub for loop one: just logs the sync.
 * Real: sends booking data to HubSpot API as deal/opportunity.
 */
export async function syncBookingToCrm(
  db: PrismaClient,
  projectId: string,
  bookingData: {
    bookingId: string;
    guestEmail: string;
    guestName: string;
    amount: number;
    currency: string;
    startDate: Date;
    endDate: Date;
  },
): Promise<{ success: boolean; dealId?: string; error?: string }> {
  try {
    const crm = await getIntegrationAccount(
      db,
      IntegrationKey.crm_hubspot,
      'project',
      projectId
    );

    if (!crm) {
      return {
        success: false,
        error: 'HubSpot CRM not configured for this project',
      };
    }

    if (crm.status === IntegrationStatus.disabled) {
      return {
        success: false,
        error: 'HubSpot CRM is disabled',
      };
    }

    // Stub: In production, this would:
    // 1. Create or update HubSpot deal with booking details
    // 2. Link deal to contact (guest email)
    // 3. Set deal stage based on booking status
    // 4. Return external deal ID
    //
    // For loop one, just log the booking.
    console.log(
      `[CRM stub] Sync booking to HubSpot:`,
      bookingData
    );

    // Record sync attempt
    await recordIntegrationSync(db, crm.id);

    return {
      success: true,
      dealId: `crm-deal-stub-${Date.now()}`,
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
 * Handle incoming CRM webhook (deal update, contact change, etc.).
 * Stub for loop one; real adapter after provider integration.
 */
export async function handleCrmWebhook(
  _db: PrismaClient,
  payload: Record<string, any>,
): Promise<boolean> {
  try {
    // Stub: In production, this would:
    // 1. Verify webhook signature
    // 2. Parse CRM event (deal stage change, contact updated, etc.)
    // 3. Sync changes back to platform
    //
    // For loop one, just log the event.
    console.log('[CRM webhook] HubSpot event:', JSON.stringify(payload));

    return true;
  } catch (error) {
    console.error('[CRM webhook] Error processing event:', error);
    return false;
  }
}

/**
 * Get CRM integration status for a project.
 */
export async function getCrmStatus(
  db: PrismaClient,
  projectId: string,
) {
  return await getIntegrationAccount(
    db,
    IntegrationKey.crm_hubspot,
    'project',
    projectId
  );
}
