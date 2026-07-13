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
  console.log(`\n📧 Email would be sent to ${message.to}`);
  console.log(`Subject: ${message.subject}`);
  console.log(`---`);
  console.log(message.html);
  console.log(`---\n`);
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  if (process.env.RESEND_API_KEY) {
    return sendViaResend(message);
  }
  return sendViaConsole(message);
}
