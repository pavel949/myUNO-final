/**
 * Deterministic formatting for client components.
 *
 * `date.toLocaleDateString()` with no arguments uses the *runtime's* locale and
 * timezone. The server renders in en-US / UTC and the browser in the guest's
 * ru-RU / local zone, so the two disagree and React throws hydration error #425
 * ("Text content does not match server-rendered HTML"), falling back to client
 * rendering. Dates and amounts therefore always carry an explicit locale and the
 * destination's timezone — the same text on both sides, in every browser.
 *
 * en-GB: day-first numeric dates, 24-hour time, comma thousands separator —
 * unambiguous for Russian, Thai and English readers alike.
 */
export const UI_LOCALE = 'en-GB';
export const APP_TZ = 'Asia/Bangkok';
