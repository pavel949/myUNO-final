export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  // Use Resend's pre-verified test domain if EMAIL_FROM not set (works without domain verification)
  // Switch to your verified domain once available: hello@yourdomain.com
  const from = process.env.EMAIL_FROM || 'onboarding@resend.dev';

  if (!apiKey) {
    // Development fallback: log that an email would have gone out (no contents to avoid leaking reset links)
    // Doc 12 requires that auth emails with one-time links never appear in logs in production
    console.log(
      `[EMAIL - DEV/MISSING_KEY] would send to ${message.to.split('@')[0]}@***: "${message.subject}"`
    );
    console.warn('[EMAIL] RESEND_API_KEY is not set. Emails will not be delivered. Set RESEND_API_KEY in environment variables.');
    return;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: message.to,
        subject: message.subject,
        html: message.html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[RESEND ERROR] ${response.status}: ${error}`);
      throw new Error(`Resend API error ${response.status}: ${error}`);
    }

    console.log(`[EMAIL SENT] to ${message.to.split('@')[0]}@***: "${message.subject}"`);
  } catch (err) {
    console.error('[RESEND SEND ERROR]', err instanceof Error ? err.message : String(err));
    throw err;
  }
}
