/**
 * Types for Google's `open-location-code`, which ships as plain JavaScript.
 *
 * Only the surface `src/lib/plus-code.ts` uses is declared. Narrow on purpose:
 * a fuller guess at the library's API would be unverified, and anything not
 * declared here is not something we call.
 */
declare module 'open-location-code' {
  export interface CodeArea {
    latitudeLo: number;
    longitudeLo: number;
    latitudeHi: number;
    longitudeHi: number;
    codeLength: number;
    latitudeCenter: number;
    longitudeCenter: number;
  }

  export class OpenLocationCode {
    /** True for a self-contained code such as `6MVWX7RW+32`. */
    isFull(code: string): boolean;
    /** True for a reference-relative code such as `X7RW+32`. */
    isShort(code: string): boolean;
    isValid(code: string): boolean;
    /** Expands a short code to the full code nearest the reference point. */
    recoverNearest(
      shortCode: string,
      referenceLatitude: number,
      referenceLongitude: number
    ): string;
    decode(code: string): CodeArea;
    encode(latitude: number, longitude: number, codeLength?: number): string;
  }
}
