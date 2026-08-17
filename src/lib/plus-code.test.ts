import { describe, it, expect } from 'vitest';
import {
  extractPlusCode,
  decodePlusCode,
  encodePlusCode,
  PlusCodeError,
} from './plus-code';

// Phuket. The reference only has to be within ~50 km of the code's real
// location for recoverNearest to pick the right instance.
const PHUKET = { referenceLatitude: 7.9519, referenceLongitude: 98.3381 };

describe('Plus Codes', () => {
  describe('extractPlusCode', () => {
    it('takes the code out of a full Google Maps paste', () => {
      // Exactly what Maps puts on the clipboard.
      expect(
        extractPlusCode('X7RW+32 Choeng Thale, Thalang District, Phuket')
      ).toBe('X7RW+32');
    });

    it('accepts a bare code, a full code, lowercase and stray spacing', () => {
      expect(extractPlusCode('X7RW+32')).toBe('X7RW+32');
      expect(extractPlusCode('6MVWX7RW+32')).toBe('6MVWX7RW+32');
      expect(extractPlusCode('  x7rw+32  ')).toBe('X7RW+32');
    });

    it('returns null when there is no code', () => {
      expect(extractPlusCode('Choeng Thale, Phuket')).toBeNull();
      expect(extractPlusCode('')).toBeNull();
      expect(extractPlusCode('7.9519, 98.3381')).toBeNull();
    });
  });

  describe('decodePlusCode', () => {
    it('resolves the short code from the brief against the Phuket reference', () => {
      const result = decodePlusCode(
        'X7RW+32 Choeng Thale, Thalang District, Phuket',
        PHUKET
      );

      expect(result.fullCode).toBe('6MVWX7RW+32');
      // Choeng Thale / Bang Tao on the west coast. Loose bounds on purpose:
      // this asserts "the right part of Phuket", not a coordinate fingerprint.
      expect(result.latitude).toBeGreaterThan(7.9);
      expect(result.latitude).toBeLessThan(8.1);
      expect(result.longitude).toBeGreaterThan(98.2);
      expect(result.longitude).toBeLessThan(98.4);
    });

    it('decodes a full code without needing the reference to be near it', () => {
      const viaFull = decodePlusCode('6MVWX7RW+32', {
        referenceLatitude: 0,
        referenceLongitude: 0,
      });
      const viaShort = decodePlusCode('X7RW+32', PHUKET);

      // A full code carries its own position, so a useless reference changes
      // nothing — this is what makes the full form safe to store.
      expect(viaFull.latitude).toBe(viaShort.latitude);
      expect(viaFull.longitude).toBe(viaShort.longitude);
    });

    it('round-trips through encode', () => {
      const decoded = decodePlusCode('X7RW+32', PHUKET);
      expect(encodePlusCode(decoded.latitude, decoded.longitude)).toBe(
        decoded.fullCode
      );
    });

    it('rounds to six places, matching the Decimal(9,6) column', () => {
      const { latitude, longitude } = decodePlusCode('X7RW+32', PHUKET);
      expect(latitude.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(6);
      expect(longitude.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(6);
    });

    // Failing loudly is the point: a silently ignored bad code would leave the
    // old coordinates in place and look like it had worked.
    it('rejects text with no code in it', () => {
      expect(() => decodePlusCode('Choeng Thale, Phuket', PHUKET)).toThrow(
        PlusCodeError
      );
    });

    it('rejects a code with characters outside the alphabet', () => {
      // 'A', 'B', 'D', 'E' etc. are excluded from the Plus Code alphabet
      // precisely so codes cannot spell words.
      expect(() => decodePlusCode('ABCD+EF', PHUKET)).toThrow(PlusCodeError);
    });

    it('refuses a short code when no usable reference is configured', () => {
      expect(() =>
        decodePlusCode('X7RW+32', {
          referenceLatitude: NaN,
          referenceLongitude: NaN,
        })
      ).toThrow(/reference point/i);
    });

    it('resolves the same short code differently near a different reference', () => {
      // The whole reason a reference is required: a short code is not unique
      // on its own. Bangkok is ~700 km from Phuket.
      const phuket = decodePlusCode('X7RW+32', PHUKET);
      const bangkok = decodePlusCode('X7RW+32', {
        referenceLatitude: 13.7563,
        referenceLongitude: 100.5018,
      });

      expect(bangkok.fullCode).not.toBe(phuket.fullCode);
      expect(Math.abs(bangkok.latitude - phuket.latitude)).toBeGreaterThan(1);
    });
  });
});
