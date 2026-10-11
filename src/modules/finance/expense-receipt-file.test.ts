import { beforeAll, describe, expect, it } from 'vitest';
import {
  MAX_RECEIPT_BYTES,
  ReceiptFileError,
  ReceiptIntegrityError,
  openReceipt,
  sealReceipt,
  sniffReceiptType,
  validateReceiptFile,
} from './expense-receipt-file';

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 1)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 2)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 0, 0, 0]), Buffer.from('WEBP'), Buffer.alloc(16, 3)]);
const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(32, 4)]);

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
    return undefined;
  } catch (error) {
    if (error instanceof ReceiptFileError) return error.code;
    throw error;
  }
}

describe('receipt file validation', () => {
  it('recognises the four accepted types from their bytes', () => {
    expect(sniffReceiptType(JPEG)).toBe('image/jpeg');
    expect(sniffReceiptType(PNG)).toBe('image/png');
    expect(sniffReceiptType(WEBP)).toBe('image/webp');
    expect(sniffReceiptType(PDF)).toBe('application/pdf');
    expect(sniffReceiptType(Buffer.from('<html><script>alert(1)</script>'))).toBeNull();
  });

  it('accepts a file whose declared type matches its content and hashes it', () => {
    const ok = validateReceiptFile('image/png', PNG);
    expect(ok).toMatchObject({ mime: 'image/png', sizeBytes: PNG.length });
    expect(ok.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses HTML or SVG presented as an image, and any mismatch', () => {
    expect(codeOf(() => validateReceiptFile('image/png', Buffer.from('<html>x</html>')))).toBe('content_mismatch');
    expect(codeOf(() => validateReceiptFile('image/png', JPEG))).toBe('content_mismatch');
    expect(codeOf(() => validateReceiptFile('application/pdf', PNG))).toBe('content_mismatch');
    expect(codeOf(() => validateReceiptFile('image/svg+xml', Buffer.from('<svg onload=alert(1)>')))).toBe(
      'unsupported_type'
    );
    expect(codeOf(() => validateReceiptFile('text/html', PDF))).toBe('unsupported_type');
  });

  it('enforces the size bounds', () => {
    expect(codeOf(() => validateReceiptFile('image/png', Buffer.alloc(0)))).toBe('empty');
    const big = Buffer.concat([PNG, Buffer.alloc(MAX_RECEIPT_BYTES)]);
    expect(codeOf(() => validateReceiptFile('image/png', big))).toBe('too_large');
    const exact = Buffer.concat([PNG, Buffer.alloc(MAX_RECEIPT_BYTES - PNG.length)]);
    expect(codeOf(() => validateReceiptFile('image/png', exact))).toBeUndefined();
  });
});

describe('sealing', () => {
  beforeAll(() => {
    expect(process.env.ENCRYPTION_KEY).toMatch(/^[0-9a-f]{64}$/i);
  });

  it('round-trips and never stores the bytes in the clear', () => {
    const sealed = sealReceipt(PDF);
    expect(sealed.split(':')).toHaveLength(3);
    expect(sealed).not.toContain(PDF.toString('base64'));
    const { sha256 } = validateReceiptFile('application/pdf', PDF);
    expect(openReceipt(sealed, sha256).equals(PDF)).toBe(true);
  });

  it('refuses a ciphertext that belongs to different bytes (swapped row)', () => {
    const other = validateReceiptFile('image/png', PNG).sha256;
    expect(() => openReceipt(sealReceipt(PDF), other)).toThrow(ReceiptIntegrityError);
  });
});
