import crypto from 'crypto';

export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function verifyTokenHash(token: string, hash: string): boolean {
  const computed = hashToken(token);
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
}
