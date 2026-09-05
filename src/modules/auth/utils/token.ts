import crypto from 'crypto';

export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Tokens arrive from email clients that wrap, punctuate, or paste the
 * whole reset URL into the query string. Hash the raw hex, not the wrapping.
 */
export function normalizeResetToken(raw: string): string {
  let token = raw.trim();
  token = token.replace(/^[<("'[]+/, '').replace(/[>)"'\],.]+$/, '');
  try {
    if (/%[0-9A-Fa-f]{2}/.test(token)) {
      token = decodeURIComponent(token);
    }
  } catch {
    // Keep the trimmed value if it was not valid URI encoding.
  }
  try {
    const asUrl = new URL(token);
    const fromQuery = asUrl.searchParams.get('token');
    if (fromQuery) return fromQuery.trim();
  } catch {
    // Not a URL — treat the value as the token itself.
  }
  return token.trim();
}

export function verifyTokenHash(token: string, hash: string): boolean {
  const computed = hashToken(token);
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
}
