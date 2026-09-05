/**
 * Outbound mail identity (auth + notification seams).
 *
 * Founder inbox is the default From and Reply-To. Resend will reject
 * EMAIL_FROM until ignatevestate.com is a verified domain; until then set
 * EMAIL_FROM=onboarding@resend.dev and keep EMAIL_REPLY_TO on the founder.
 */

export const FOUNDER_EMAIL = 'pavel@ignatevestate.com';

export function emailFrom(): string {
  return (process.env.EMAIL_FROM || FOUNDER_EMAIL).trim();
}

export function emailReplyTo(): string {
  return (process.env.EMAIL_REPLY_TO || FOUNDER_EMAIL).trim();
}
