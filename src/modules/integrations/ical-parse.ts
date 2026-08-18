import { ICalEvent } from './ical-import';

/**
 * A small RFC 5545 reader, scoped to what an OTA availability feed contains.
 *
 * Airbnb, Booking.com and Agoda publish the same narrow shape: VEVENTs with a
 * UID, a DTSTART and a DTEND, usually as whole dates, with the guest's name or
 * a reservation code in SUMMARY. This reads exactly that and ignores the rest of
 * the standard — no recurrence, no alarms, no timezone database — because
 * pretending to support what has never appeared in these feeds would be a
 * larger lie than not supporting it.
 *
 * Written here rather than pulled from a library on purpose: the parsing is
 * twenty lines of real work, and an availability feed is a thing we must be able
 * to reason about exactly when a villa is double-sold.
 */

export interface ParseResult {
  events: ICalEvent[];
  /** Events dropped because they could not be trusted, with the reason. */
  skipped: Array<{ reason: string; uid?: string }>;
}

/**
 * Undo RFC 5545 line folding: a CRLF followed by a space or tab continues the
 * previous line. Feeds wrap at 75 octets, so a long SUMMARY arrives split.
 */
function unfold(text: string): string[] {
  const normalised = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const out: string[] = [];

  for (const line of normalised.split('\n')) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }

  return out;
}

/** `DTSTART;VALUE=DATE:20260910` → name `DTSTART`, params, value `20260910`. */
function splitLine(line: string): { name: string; params: string; value: string } | null {
  const colon = line.indexOf(':');
  if (colon === -1) return null;

  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const semi = left.indexOf(';');

  return semi === -1
    ? { name: left.toUpperCase(), params: '', value }
    : {
        name: left.slice(0, semi).toUpperCase(),
        params: left.slice(semi + 1).toUpperCase(),
        value,
      };
}

/** RFC 5545 TEXT escaping, as far as these feeds use it. */
function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/**
 * `20260910` or `20260910T140000Z` → a Date at UTC midnight of that day.
 *
 * Availability is counted in nights, not moments: a stay that starts at 14:00
 * local occupies the whole of that date as far as the calendar is concerned, and
 * `blocked_date` stores dates. Times are therefore read and then truncated,
 * rather than being carried into a comparison that would make a 14:00 arrival
 * look like a different day depending on the reader's timezone.
 */
function parseICalDate(value: string): Date | null {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(value.trim());
  if (!match) return null;

  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));

  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Parse an iCal document into availability events.
 *
 * Anything malformed is skipped with a reason rather than throwing: one bad
 * VEVENT in a feed of forty must not cost us the other thirty-nine, and a feed
 * that silently imports nothing is worse than one that says what it dropped.
 */
export function parseICal(text: string): ParseResult {
  const events: ICalEvent[] = [];
  const skipped: ParseResult['skipped'] = [];

  if (!text || !text.includes('BEGIN:VEVENT')) {
    return { events, skipped };
  }

  let current: Partial<ICalEvent> & { hasDtEnd?: boolean } | null = null;

  for (const line of unfold(text)) {
    if (line.startsWith('BEGIN:VEVENT')) {
      current = {};
      continue;
    }

    if (line.startsWith('END:VEVENT')) {
      if (!current) continue;

      const { uid, dtStart, dtEnd, summary, description } = current;

      if (!uid) {
        skipped.push({ reason: 'no UID — cannot be imported idempotently' });
      } else if (!dtStart) {
        skipped.push({ reason: 'no DTSTART', uid });
      } else if (!dtEnd) {
        // DTEND is optional in RFC 5545; for a DATE-valued event its absence
        // means a single day. Treating that as "no end" would block nothing.
        events.push({
          uid,
          summary: summary ?? '',
          dtStart,
          dtEnd: new Date(dtStart.getTime() + 24 * 60 * 60 * 1000),
          description,
        });
      } else if (dtEnd <= dtStart) {
        // A zero or negative range would create a block that covers nothing, so
        // it is reported rather than imported as a silent no-op.
        skipped.push({ reason: 'DTEND is not after DTSTART', uid });
      } else {
        events.push({ uid, summary: summary ?? '', dtStart, dtEnd, description });
      }

      current = null;
      continue;
    }

    if (!current) continue;

    const parsed = splitLine(line);
    if (!parsed) continue;

    switch (parsed.name) {
      case 'UID':
        current.uid = parsed.value.trim();
        break;
      case 'SUMMARY':
        current.summary = unescapeText(parsed.value);
        break;
      case 'DESCRIPTION':
        current.description = unescapeText(parsed.value);
        break;
      case 'DTSTART': {
        const date = parseICalDate(parsed.value);
        if (date) current.dtStart = date;
        break;
      }
      case 'DTEND': {
        const date = parseICalDate(parsed.value);
        if (date) current.dtEnd = date;
        break;
      }
      default:
        break;
    }
  }

  return { events, skipped };
}
