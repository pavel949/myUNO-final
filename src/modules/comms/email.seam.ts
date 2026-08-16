/**
 * Email delivery seam for notifications.
 * Abstraction over an email provider (Resend) with console fallback for dev.
 * Following the seam pattern from finance.ts for pluggable providers.
 */

import { PrismaClient } from '@prisma/client';
import { t } from '@/modules/content/content.service';
import type { Locale } from '@/modules/content/types';

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  htmlBody?: string;
}

/**
 * Reduce an address to something a developer can correlate but nobody can
 * contact: first character and domain. `anna@example.com` → `a***@example.com`.
 */
export function redactEmail(address: string): string {
  const [local, domain] = address.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 1)}***@${domain}`;
}

/**
 * Send an email via the configured provider.
 * With RESEND_API_KEY: posts to Resend API.
 * Without: logs to console (development fallback).
 * Returns externalRef (provider message ID) on success, null on failure.
 */
export async function sendEmail(
  input: SendEmailInput
): Promise<string | null> {
  const { to, subject, body, htmlBody } = input;

  const resendKey = process.env.RESEND_API_KEY;

  if (!resendKey) {
    // Development fallback: record that an email would have gone out, without
    // its recipient or its contents. Doc 12 admits no dev-mode exception —
    // staging logs are shipped and retained like any other, and a booking
    // confirmation or reset link in them is a real disclosure.
    console.log('[EMAIL - DEV MODE]', {
      to: redactEmail(to),
      subject,
      bodyChars: body?.length ?? 0,
      htmlChars: htmlBody?.length ?? 0,
      timestamp: new Date().toISOString(),
    });
    return 'dev-mode-console-logged';
  }

  try {
    // Call Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'noreply@myuno.io',
        to,
        subject,
        text: body,
        html: htmlBody || body,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[RESEND ERROR]', response.status, error);
      return null;
    }

    const data = (await response.json()) as { id?: string };
    return data.id || null;
  } catch (err) {
    console.error('[EMAIL SEND ERROR]', err);
    return null;
  }
}

/**
 * Build email body for a notification.
 * The titleKey and bodyKey are rendered with i18n; params are substituted.
 * Returns plain text format for now; can be enhanced with HTML templates.
 */
export async function buildNotificationEmail(
  db: PrismaClient,
  input: {
    titleKey: string;
    bodyKey: string;
    params?: Record<string, any>;
    locale?: string;
  }
): Promise<{ subject: string; body: string }> {
  const { titleKey, bodyKey, params = {}, locale = 'en' as Locale } = input;

  // Fetch translations from content layer with fallback chain
  const subject = await t(db, titleKey, params, locale as Locale);
  const body = await t(db, bodyKey, params, locale as Locale);

  return { subject, body };
}
