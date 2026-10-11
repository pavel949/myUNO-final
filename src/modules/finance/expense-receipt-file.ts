import { createHash } from 'crypto'; // unprefixed on purpose: this file is reachable from the finance barrel, which a client component imports (see CLAUDE.md, module rule 2 exception)
import { decrypt, encrypt } from '@/lib/encryption';

/**
 * The bytes of an expense receipt: what is accepted, and how it is sealed.
 *
 * ## No new cryptography
 * Sealing is the platform's existing contract, `lib/encryption` (AES-256-GCM,
 * `iv:tag:ciphertext`), over the file's base64 text — the same shape as the
 * regulatory-evidence store. The only thing added here is an integrity check:
 * the plaintext SHA-256 recorded at upload is compared at download, so a
 * ciphertext swapped between rows is refused instead of served.
 *
 * ## What is accepted
 * Four types, decided from the file's CONTENT as well as its declared type: a
 * declared `image/png` whose bytes are an HTML page is refused. SVG is not
 * accepted (it can carry script), and the download is always an attachment with
 * `nosniff`, so a stored file is never rendered by the browser as a page.
 *
 * The 4 MB ceiling is the hosting platform's request-body limit (4.5 MB) minus
 * multipart overhead, so an accepted file is one that can actually arrive.
 */
export const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;

export const RECEIPT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type ReceiptMime = (typeof RECEIPT_MIME_TYPES)[number];

export const RECEIPT_EXTENSIONS: Record<ReceiptMime, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export type ReceiptFileErrorCode = 'empty' | 'too_large' | 'unsupported_type' | 'content_mismatch';

export class ReceiptFileError extends Error {
  readonly code: ReceiptFileErrorCode;
  constructor(code: ReceiptFileErrorCode, message: string) {
    super(message);
    this.name = 'ReceiptFileError';
    this.code = code;
  }
}

export class ReceiptIntegrityError extends Error {
  constructor() {
    super('Receipt failed its integrity check');
    this.name = 'ReceiptIntegrityError';
  }
}

export function isReceiptMime(value: unknown): value is ReceiptMime {
  return typeof value === 'string' && (RECEIPT_MIME_TYPES as readonly string[]).includes(value);
}

/** The type the bytes actually are, from their leading signature. */
export function sniffReceiptType(bytes: Buffer): ReceiptMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
    bytes.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString('latin1') === '%PDF-') {
    return 'application/pdf';
  }
  return null;
}

export interface ValidatedReceipt {
  mime: ReceiptMime;
  sizeBytes: number;
  sha256: string;
}

export function validateReceiptFile(declaredMime: string, bytes: Buffer): ValidatedReceipt {
  if (bytes.length === 0) throw new ReceiptFileError('empty', 'The file is empty.');
  if (bytes.length > MAX_RECEIPT_BYTES) {
    throw new ReceiptFileError('too_large', 'The file is larger than 4 MB.');
  }
  if (!isReceiptMime(declaredMime)) {
    throw new ReceiptFileError('unsupported_type', 'Only PDF, JPEG, PNG and WebP files are accepted.');
  }
  if (sniffReceiptType(bytes) !== declaredMime) {
    throw new ReceiptFileError('content_mismatch', 'The file content does not match its type.');
  }
  return {
    mime: declaredMime,
    sizeBytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

export function sealReceipt(bytes: Buffer): string {
  return encrypt(bytes.toString('base64'));
}

export function openReceipt(ciphertext: string, expectedSha256: string): Buffer {
  const bytes = Buffer.from(decrypt(ciphertext), 'base64');
  if (createHash('sha256').update(bytes).digest('hex') !== expectedSha256) {
    throw new ReceiptIntegrityError();
  }
  return bytes;
}
