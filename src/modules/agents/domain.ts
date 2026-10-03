export class AgentError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export function text(value: unknown, max = 200, optional = false): string {
  if (optional && (value === undefined || value === null || value === '')) return '';
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new AgentError('invalid_text');
  return value.trim();
}
export function amount(value: unknown): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,13})$/.test(value)) throw new AgentError('invalid_amount');
  return BigInt(value);
}
export function expires(value: unknown, now = new Date()): Date {
  const date = new Date(text(value, 40));
  if (!Number.isFinite(date.getTime()) || date <= now || date.getTime() > now.getTime() + 30 * 86400000) throw new AgentError('invalid_expiry');
  return date;
}
export function contactInput(input: Record<string, unknown>) {
  const email = text(input.email, 254, true).toLowerCase() || null;
  const phone = text(input.phone, 20, true) || null;
  const telegram = text(input.telegram, 40, true).replace(/^@/, '').toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AgentError('invalid_email');
  if (phone && !/^\+[1-9]\d{7,14}$/.test(phone)) throw new AgentError('phone_requires_e164');
  if (telegram && !/^[a-zA-Z0-9_]{5,32}$/.test(telegram)) throw new AgentError('invalid_telegram');
  if (!email && !phone && !telegram) throw new AgentError('contact_channel_required');
  return { displayName: text(input.displayName), email, phone, telegram, privateNotes: text(input.privateNotes, 4000, true) };
}
export function composeLinks(url: string, message: string) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new AgentError('invalid_share_url');
  return {
    whatsapp: 'https://wa.me/?text=' + encodeURIComponent(message + '\n' + url),
    telegram: 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(message),
  };
}
export function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item)) as T;
}
