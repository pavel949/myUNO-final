import { encrypt, decrypt } from '@/lib/encryption';

/**
 * Field-level encryption seam for booking-guest PII (doc 02 §3.2 🔒, doc 12).
 *
 * Encrypted at rest: full name, date of birth, passport number.
 * Deliberately NOT encrypted: nationality — the TM30 obligation and the
 * foreign-guest KPIs filter on it in SQL (`nationality != 'TH'`), which
 * ciphertext would break; it is a country code, not an identifier.
 *
 * Ciphertext format is lib/encryption's `iv:tag:hex`. `safeDecrypt` accepts
 * legacy plaintext (pre-encryption rows, test fixtures) and returns it
 * unchanged, so reads never crash on old data.
 */

const CIPHERTEXT_RE = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]*$/;

export function isEncrypted(value: string): boolean {
  return CIPHERTEXT_RE.test(value);
}

export function encryptPii(value: string): string {
  return encrypt(value);
}

export function safeDecrypt(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return value ?? null;
  if (!isEncrypted(value)) return value;
  try {
    return decrypt(value);
  } catch {
    // Wrong key or corrupt row: surface a marker, never the ciphertext.
    return null;
  }
}

export interface GuestPiiInput {
  fullName: string;
  dateOfBirth?: string | null;
}

/** Encrypt the guest's PII fields for storage. */
export function encryptGuestPii(input: GuestPiiInput): {
  fullName: string;
  dateOfBirth: string | null;
} {
  return {
    fullName: encrypt(input.fullName),
    dateOfBirth: input.dateOfBirth ? encrypt(input.dateOfBirth) : null,
  };
}
