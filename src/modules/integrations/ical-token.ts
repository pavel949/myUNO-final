import crypto from 'crypto';

/**
 * Capability tokens for the per-unit iCal export feed (P0-5).
 *
 * The feed cannot use the session cookie: the consumers are Airbnb, Booking.com
 * and Google Calendar, which fetch a URL on a schedule with no session. So the
 * URL itself has to carry the authority, and the token is the whole of it —
 * anyone holding the link can read that unit's calendar.
 *
 * Derived rather than stored, so there is no table to migrate and no secret at
 * rest beyond the signing key. The trade is that a token cannot be revoked
 * individually; rotating `ICAL_FEED_SECRET` invalidates every feed at once.
 * That is the right shape for loop one, and a stored per-unit token with its own
 * revocation is the upgrade when feeds are handed to third parties at scale.
 */

const TOKEN_PURPOSE = 'ical-feed-v1';

function getFeedSecret(): string {
  const secret =
    process.env.ICAL_FEED_SECRET || process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ICAL_FEED_SECRET (or SESSION_SECRET) is required in production');
    }
    return 'dev-only-insecure-ical-secret';
  }
  return secret;
}

/** The token for a unit's feed. Stable, so a URL pasted into an OTA keeps working. */
export function icalFeedToken(unitId: string): string {
  return crypto
    .createHmac('sha256', getFeedSecret())
    .update(`${TOKEN_PURPOSE}:${unitId}`)
    .digest('base64url');
}

/**
 * Constant-time check. Length is compared first because timingSafeEqual throws
 * on a length mismatch, and that throw would itself leak the expected length.
 */
export function verifyIcalFeedToken(unitId: string, token: string | null | undefined): boolean {
  if (!token) return false;

  const expected = icalFeedToken(unitId);
  const provided = Buffer.from(token);
  const expectedBuf = Buffer.from(expected);

  if (provided.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(provided, expectedBuf);
}

/**
 * A stable, opaque UID for a feed event.
 *
 * iCal needs the UID to be the same on every fetch, or consumers treat each poll
 * as a new event. That does not mean it has to be our primary key: publishing
 * `booking-<uuid>` handed an internal identifier to every feed holder for no
 * benefit. Derived from the same secret, so it is stable without being the id.
 */
export function icalEventUid(kind: 'booking' | 'blocked', id: string): string {
  const digest = crypto
    .createHmac('sha256', getFeedSecret())
    .update(`${TOKEN_PURPOSE}:event:${kind}:${id}`)
    .digest('hex')
    .slice(0, 32);
  return `${kind}-${digest}@myuno.local`;
}

/** The full feed path, for the admin UI to show and for operators to paste. */
export function icalFeedPath(unitId: string): string {
  return `/api/units/${unitId}/ical/export?token=${icalFeedToken(unitId)}`;
}
