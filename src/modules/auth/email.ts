export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

async function sendViaResend(message: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'noreply@myuno.local';

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set');
  }

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
    throw new Error(`Resend API error: ${response.status} - ${error}`);
  }
}

async function sendViaConsole(message: EmailMessage): Promise<void> {
  // The console fallback records that an email would have gone out — not who
  // to, and not what it said. These are auth emails: their bodies carry
  // one-time reset and verification links, so dumping them to a log hands
  // anyone with log access a working account takeover (doc 12).
  console.log(
    `📧 Email would be sent: subject="${message.subject}" (${message.html.length} chars)`
  );
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  if (process.env.RESEND_API_KEY) {
    return sendViaResend(message);
  }
  return sendViaConsole(message);
}
