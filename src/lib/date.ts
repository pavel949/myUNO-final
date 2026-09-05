/**
 * Calendar days, done once.
 *
 * The platform had no date library and no shared date module. `daysBetween`,
 * month-day extraction and `toISOString().slice(0, 10)` were hand-rolled in
 * `availability.service.ts`, `ical-parse.ts`, the iCal export route and
 * `unit-ical-conflicts.ts` — four implementations of the same two ideas, none
 * of them tested directly.
 *
 * ## The distinction this module exists to enforce
 *
 * Two different things get stored in a JavaScript `Date`, and conflating them
 * is where the bugs live:
 *
 *   **A calendar day** — a check-in date, a blocked date, a pricing-rule
 *   window. Postgres holds these as `date` (`@db.Date`) and Prisma hands them
 *   back as UTC midnight. "2026-11-10" means that day in Phuket, not an
 *   instant. Use `toCalendarDay` / `daysBetween` / `addDays`.
 *
 *   **An instant** — `new Date()`, `createdAt`, `checkedInAt`. To ask "what
 *   day is it?" of an instant you must name a timezone, because the answer
 *   differs by one for seven hours of every day. Use `calendarDayIn` /
 *   `monthDayIn`.
 *
 * The old helpers normalised with `setHours(0, 0, 0, 0)` and read months with
 * `getMonth()` — both **server-local**. They happen to be correct on Vercel
 * because that runs UTC, which means a single `TZ` environment change would
 * have silently shifted every season boundary and every nights calculation
 * with nothing failing. These functions name their timezone instead of
 * inheriting one.
 *
 * No dependency: `Intl.DateTimeFormat` with the `en-CA` locale yields
 * `YYYY-MM-DD` directly and knows every zone's offset, including historical
 * ones. Thailand has no daylight saving, but the correctness here does not
 * rest on that.
 */

/**
 * Where the platform operates. `Project.timezone` is the real source and
 * defaults to this; use the project's value wherever one is in hand, and this
 * only as the fallback for code with no project in scope.
 */
export const DEFAULT_TIME_ZONE = 'Asia/Bangkok';

/** A calendar day with no time and no zone: `YYYY-MM-DD`. */
export type CalendarDay = string;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const CALENDAR_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Formatters are expensive to construct and are pure, so they are built once
 * per zone. A handful of zones will ever be used.
 */
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function dayFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    // en-CA renders ISO-ordered YYYY-MM-DD, which is why it is chosen over
    // building the string from parts.
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/**
 * The calendar day an **instant** falls on, in the named zone.
 *
 * This is the one to reach for when comparing "now" against a stored date:
 * at 06:00 in Phuket the UTC day is still yesterday, so a UTC-based answer is
 * wrong for seven hours out of every twenty-four.
 */
export function calendarDayIn(instant: Date, timeZone: string = DEFAULT_TIME_ZONE): CalendarDay {
  return dayFormatter(timeZone).format(instant);
}

/** `MM-DD` of an instant in the named zone — season boundaries are year-agnostic. */
export function monthDayIn(instant: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  return calendarDayIn(instant, timeZone).slice(5);
}

/**
 * The calendar day a **stored `@db.Date` value** represents.
 *
 * Prisma returns those at UTC midnight, so this reads them back in UTC
 * deliberately — passing such a value through `calendarDayIn` with a
 * behind-UTC zone would move it to the previous day.
 */
export function toCalendarDay(date: Date): CalendarDay {
  return date.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` → the UTC-midnight `Date` that Postgres round-trips as that day. */
export function startOfCalendarDayUtc(day: CalendarDay): Date {
  if (!CALENDAR_DAY_PATTERN.test(day)) {
    throw new Error(`Not a calendar day (expected YYYY-MM-DD): ${day}`);
  }
  const parsed = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Not a valid calendar day: ${day}`);
  }
  return parsed;
}

/** Midnight UTC of the day a stored date falls on — the normal form for day maths. */
export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

/**
 * Whole calendar days from `start` to `end`; negative when `end` precedes
 * `start`. For a stay this is the number of nights.
 *
 * Both ends are normalised to UTC midnight first, so a time component on
 * either side cannot round the answer up or down.
 */
export function daysBetween(start: Date, end: Date): number {
  const from = startOfUtcDay(start).getTime();
  const to = startOfUtcDay(end).getTime();
  return Math.round((to - from) / MS_PER_DAY);
}

/** `n` days after `date` (negative goes back), preserving UTC-midnight shape. */
export function addDays(date: Date, n: number): Date {
  const base = startOfUtcDay(date);
  return new Date(base.getTime() + n * MS_PER_DAY);
}

/**
 * Whole days from an **instant** to a **stored calendar day**, counted in the
 * named zone.
 *
 * The asymmetry is the point: "how many days before check-in was this booked"
 * compares a timestamp against a date, and the timestamp has to be resolved to
 * a day in the guest's zone before the subtraction means anything.
 */
export function daysUntil(
  instant: Date,
  targetDay: Date,
  timeZone: string = DEFAULT_TIME_ZONE
): number {
  const today = startOfCalendarDayUtc(calendarDayIn(instant, timeZone));
  return daysBetween(today, targetDay);
}
