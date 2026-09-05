import { describe, expect, it } from 'vitest';
import { generateToken, hashToken, normalizeResetToken } from './token';

describe('normalizeResetToken', () => {
  it('trims whitespace from email-wrapped tokens', () => {
    const raw = generateToken();
    expect(normalizeResetToken(`  ${raw}\n`)).toBe(raw);
  });

  it('strips angle brackets some clients wrap around a URL', () => {
    const raw = generateToken();
    expect(normalizeResetToken(`<${raw}>`)).toBe(raw);
  });

  it('pulls the token out of a pasted reset URL', () => {
    const raw = generateToken();
    expect(
      normalizeResetToken(`https://my-uno-final.vercel.app/auth/reset-password?token=${raw}`)
    ).toBe(raw);
  });

  it('hashes the same value before and after normalisation', () => {
    const raw = generateToken();
    expect(hashToken(normalizeResetToken(` ${raw} `))).toBe(hashToken(raw));
  });
});
