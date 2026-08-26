export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'noreply@myuno.io';

  if (!apiKey) {
    // Development fallback: log that an email would have gone out (no contents to avoid leaking reset links)
    // Doc 12 requires that auth emails with one-time links never appear in logs in production
    console.log(
      `[EMAIL - DEV/MISSING_KEY] would send to ${message.to.split('@')[0]}@***: "${message.subject}"`
    );
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
    }
  } catch (err) {
    console.error('[RESEND SEND ERROR]', err);
  }
}
