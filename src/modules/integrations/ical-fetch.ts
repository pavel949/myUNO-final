/**
 * Fetching an OTA calendar feed.
 *
 * The URL belongs to a third party, so everything here is a guard: a feed that
 * hangs must not hold a cron slot open, a feed that returns a gigabyte must not
 * exhaust memory, and a URL pointed at our own network must not turn the sync
 * job into a way to read internal services.
 */

/** A feed that takes longer than this is treated as down. */
const FETCH_TIMEOUT_MS = 15_000;

/** Airbnb's largest published calendars are tens of kilobytes. */
const MAX_BYTES = 5 * 1024 * 1024;

export class ICalFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ICalFetchError';
  }
}

/**
 * Reject anything that is not a public http(s) URL.
 *
 * Feed URLs are operator-supplied and stored, so without this the sync job is a
 * server-side request forgery primitive: point an integration at
 * `http://169.254.169.254/` or `http://localhost:5432` and the job fetches it
 * from inside our network on a schedule. Blocking the hostnames is coarse — it
 * cannot see through DNS that resolves to a private address — so this is a first
 * line, not the only one, and it is worth revisiting if feeds ever come from
 * anywhere less trusted than an operator typing an Airbnb link.
 */
export function assertSafeFeedUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ICalFetchError('Feed URL is not a valid URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ICalFetchError(`Feed URL must be http or https, got ${url.protocol}`);
  }

  const host = url.hostname.toLowerCase();
  const isPrivate =
    host === 'localhost' ||
    host === '::1' ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);

  if (isPrivate) {
    throw new ICalFetchError(`Feed URL points at a private address (${host})`);
  }

  return url;
}

/**
 * Fetch a calendar feed as text.
 *
 * Content-Type is not enforced: feeds are served as `text/calendar`,
 * `text/plain` and occasionally `application/octet-stream` depending on the
 * platform, and refusing on that basis would reject working feeds. The parser
 * decides whether the body is really a calendar.
 */
export async function fetchICalFeed(rawUrl: string): Promise<string> {
  const url = assertSafeFeedUrl(rawUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { Accept: 'text/calendar, text/plain, */*' },
    });

    if (!response.ok) {
      throw new ICalFetchError(`Feed responded ${response.status}`);
    }

    const declaredLength = Number(response.headers.get('content-length') ?? 0);
    if (declaredLength > MAX_BYTES) {
      throw new ICalFetchError(`Feed is ${declaredLength} bytes, over the ${MAX_BYTES} cap`);
    }

    const body = await response.text();

    // Checked again after reading: content-length is a claim, not a promise, and
    // a chunked response carries none at all.
    if (body.length > MAX_BYTES) {
      throw new ICalFetchError(`Feed body is over the ${MAX_BYTES} byte cap`);
    }

    return body;
  } catch (error) {
    if (error instanceof ICalFetchError) throw error;
    if ((error as Error)?.name === 'AbortError') {
      throw new ICalFetchError(`Feed did not respond within ${FETCH_TIMEOUT_MS}ms`);
    }
    throw new ICalFetchError(
      `Could not fetch feed: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    clearTimeout(timeout);
  }
}
