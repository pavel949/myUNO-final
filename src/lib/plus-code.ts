import { OpenLocationCode } from 'open-location-code';

/**
 * Google Plus Codes → latitude/longitude.
 *
 * Entering a project's position as raw decimal degrees is error-prone work:
 * the two numbers look alike, a transposed pair puts a Phuket villa in the
 * Indian Ocean, and nothing about "98.295063" tells a person whether it is
 * right. A Plus Code is one short token that can be copied straight out of
 * Google Maps, and a wrong one fails visibly rather than landing somewhere
 * plausible.
 *
 * Two forms exist, and the difference matters:
 *
 *   Full   `6MVWX7RW+32`        self-contained, decodes on its own
 *   Short  `X7RW+32 Choeng Thale`  relative — meaningless without a reference
 *
 * Google Maps shows the short form, so that is the one people will paste. A
 * short code names a spot within roughly 50 km of a reference point, which is
 * why `referenceLatitude`/`referenceLongitude` are required to resolve one:
 * the same `X7RW+32` denotes a different place near Bangkok than near Phuket.
 * The reference comes from configuration (`geo.plus_code_reference_*`), never
 * hard-coded, so operating outside Phuket is a config change rather than a
 * code change.
 *
 * The trailing locality ("Choeng Thale, Thalang District, Phuket") is human
 * sugar that carries no positional information; it is stripped and ignored.
 */

const olc = new OpenLocationCode();

export interface PlusCodeReference {
  referenceLatitude: number;
  referenceLongitude: number;
}

export interface PlusCodeResult {
  latitude: number;
  longitude: number;
  /** The self-contained code, worth storing so the input can be re-checked. */
  fullCode: string;
}

export class PlusCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlusCodeError';
  }
}

/**
 * Pull the code out of whatever was pasted.
 *
 * Accepts `X7RW+32`, `X7RW+32 Choeng Thale, Phuket`, `6MVWX7RW+32`, and the
 * same with stray whitespace or lowercase — all of which are things a person
 * legitimately copies from Maps. Everything after the first token is dropped.
 */
export function extractPlusCode(input: string): string | null {
  if (!input) return null;

  // A Plus Code is base-20 over a restricted alphabet, always containing '+'.
  // Anchoring to that character is what separates it from the locality text.
  const match = input.trim().toUpperCase().match(/([23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{0,7})/);
  return match ? match[1] : null;
}

/**
 * Decode a Plus Code to coordinates.
 *
 * Throws `PlusCodeError` with a message meant for the person who typed it,
 * rather than returning null — a silently ignored bad code would leave the
 * previous coordinates in place and look like it worked.
 */
export function decodePlusCode(
  input: string,
  reference: PlusCodeReference
): PlusCodeResult {
  const code = extractPlusCode(input);

  if (!code) {
    throw new PlusCodeError(
      'No Plus Code found. Expected something like "X7RW+32 Choeng Thale, Phuket".'
    );
  }

  let fullCode: string;

  if (olc.isFull(code)) {
    fullCode = code;
  } else if (olc.isShort(code)) {
    const { referenceLatitude, referenceLongitude } = reference;
    if (
      !Number.isFinite(referenceLatitude) ||
      !Number.isFinite(referenceLongitude)
    ) {
      throw new PlusCodeError(
        'A short Plus Code needs a reference point, and none is configured (geo.plus_code_reference_*).'
      );
    }
    // recoverNearest picks the instance of this short code closest to the
    // reference — the reason the reference has to be roughly right.
    fullCode = olc.recoverNearest(code, referenceLatitude, referenceLongitude);
  } else {
    throw new PlusCodeError(`"${code}" is not a valid Plus Code.`);
  }

  const area = olc.decode(fullCode);

  return {
    // The centre of the code's area, not a corner: a Plus Code denotes a small
    // rectangle (~14x14 m at 10 digits), and the centre is the honest single
    // point to represent it.
    latitude: round6(area.latitudeCenter),
    longitude: round6(area.longitudeCenter),
    fullCode,
  };
}

/**
 * Coordinates → Plus Code, for showing an existing project's position in the
 * form people can check against Google Maps.
 */
export function encodePlusCode(latitude: number, longitude: number): string {
  return olc.encode(latitude, longitude, 10);
}

/**
 * Six decimal places is ~11 cm and matches the column (`Decimal(9,6)`).
 * Rounding here rather than at the database keeps what is stored identical to
 * what was shown when it was entered.
 */
function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
