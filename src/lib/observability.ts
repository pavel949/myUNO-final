/**
 * Structured logging and error reporting (P1-5).
 *
 * Before this, a production failure reached `console.error` with a free-text
 * message and stopped there: no way to tie a user's report to the request that
 * broke, no way to search, and — worse — no scrubbing, so a Prisma unique-key
 * violation would print the guest's email into the log verbatim. CLAUDE.md says
 * builders never log PII, and the old handler had no way to keep that promise.
 *
 * What this is: structured JSON on stdout, carrying a correlation id, with PII
 * scrubbed on the way out. On Vercel that lands in the platform log and is
 * searchable by id, which is what makes a support conversation tractable —
 * "quote me the reference on the error page" and the request is found.
 *
 * What this is deliberately **not**: an alerting system. Nothing here pages
 * anyone. Wiring a vendor or a log drain is an ops decision with a cost, and
 * writing an adapter that pretends to have sent somewhere would repeat the
 * mistake this codebase has already made twice. `reportError` is the seam a real
 * transport attaches to, and until one exists it says so rather than implying
 * otherwise.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** The header a correlation id travels on, in and out. */
export const CORRELATION_ID_HEADER = 'x-correlation-id';

export function newCorrelationId(): string {
  // randomUUID exists in both the Node and Edge runtimes Next uses.
  return globalThis.crypto?.randomUUID?.() ?? `cid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Accept an inbound id only if it looks like one we issued. */
export function sanitiseCorrelationId(value: string | null | undefined): string | null {
  if (!value) return null;
  // Bounded and alphanumeric: an id is echoed into logs and response headers, so
  // an attacker-supplied value must not be able to forge log lines or inject
  // header content.
  return /^[A-Za-z0-9_-]{8,64}$/.test(value) ? value : null;
}

// --- PII scrubbing -------------------------------------------------------

/** Field names whose values never belong in a log, whatever they contain. */
const SENSITIVE_KEYS = [
  'password',
  'hashedpassword',
  'passport',
  'passportnumber',
  'token',
  'secret',
  'authorization',
  'cookie',
  'sessiontoken',
  'apikey',
  'api_key',
  'encryptionkey',
  'cardnumber',
  'cvv',
  'dateofbirth',
  'dob',
  'email',
  'phone',
  'phonenumber',
];

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/** +66 92 240 7355, 0922407355, +7 916 123-45-67 — loose on purpose. */
const PHONE_PATTERN = /(?:\+\d[\d\s().-]{7,}\d)|(?:\b0\d{8,10}\b)/g;
/**
 * A run of digits long enough to be a card number, with no word-boundary
 * requirement: a passport is letters then digits (`AB1234567`), and a boundary
 * would miss the digits precisely because a letter precedes them.
 */
const LONG_DIGITS_PATTERN = /\d{9,}/g;
/** Passport-shaped: one or two letters then six to nine digits. */
const DOCUMENT_PATTERN = /\b[A-Z]{1,2}\d{6,9}\b/gi;

/** Redact PII from a free-text string. */
export function scrubText(text: string): string {
  return text
    .replace(EMAIL_PATTERN, '[email]')
    .replace(PHONE_PATTERN, '[phone]')
    .replace(DOCUMENT_PATTERN, '[document]')
    .replace(LONG_DIGITS_PATTERN, '[number]');
}

/**
 * Redact PII from an arbitrary value, by key name and by content.
 *
 * Depth-limited: an error object can carry a cyclic or enormous graph, and a
 * logger that hangs or explodes on one is worse than no logger.
 */
export function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[truncated]';
  if (value == null) return value;

  if (typeof value === 'string') return scrubText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => scrubValue(item, depth + 1));
  }

  if (value instanceof Date) return value.toISOString();

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEYS.includes(key.toLowerCase())
        ? '[redacted]'
        : scrubValue(item, depth + 1);
    }
    return out;
  }

  return String(value);
}

// --- Emitting ------------------------------------------------------------

export interface LogFields {
  correlationId?: string | null;
  route?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  [key: string]: unknown;
}

interface LogRecord extends LogFields {
  level: LogLevel;
  message: string;
  timestamp: string;
}

/**
 * Emit one structured record.
 *
 * JSON on a single line, because that is what a log drain can parse and a human
 * can still read. Tests silence it via LOG_SILENT so a suite that deliberately
 * exercises failure paths does not bury its own output.
 */
export function log(level: LogLevel, message: string, fields: LogFields = {}): void {
  if (process.env.LOG_SILENT === '1') return;

  const record: LogRecord = {
    level,
    message: scrubText(message),
    timestamp: new Date().toISOString(),
    ...(scrubValue(fields) as LogFields),
  };

  const line = JSON.stringify(record);

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export interface ReportedError {
  correlationId: string | null;
  fingerprint: string;
}

/**
 * Best-effort push to an ops alert channel — a Slack (or Discord/PagerDuty
 * generic-webhook-compatible) endpoint that accepts a JSON POST with a `text`
 * field. This is the transport `reportError`'s own comment used to say did
 * not exist (Q47/"nothing alerts you when something breaks"). It follows the
 * same seam pattern as the payment and email seams elsewhere in this
 * codebase: with `ALERT_WEBHOOK_URL` unset, it is a correct no-op; set it and
 * a real incident starts paging without a code change.
 *
 * Deliberately narrow for a first version: no retry, no queue, no dedup — a
 * genuine incident storm can still flood the channel. That is a known,
 * accepted limitation, not a silent gap, and cheaper to fix once it is a real
 * problem than to build speculatively now (CLAUDE.md: no invented scope).
 * Expected 4xx traffic (`fields.expected`) never pages — only failures the
 * caller did not already classify as the caller's own mistake.
 */
function pushAlert(
  errorName: string,
  message: string,
  fields: LogFields,
  fingerprint: string
): void {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  if (process.env.LOG_SILENT === '1') return;
  if (fields.expected === true) return;

  const summary = `[myUNO] ${errorName}: ${scrubText(message).slice(0, 200)}`;
  const payload = {
    text: summary, // Slack/Discord read this field; other targets can read the rest.
    ...(scrubValue({
      correlationId: fields.correlationId ?? null,
      route: fields.route,
      statusCode: fields.statusCode,
      fingerprint,
      timestamp: new Date().toISOString(),
    }) as Record<string, unknown>),
  };

  // Fire-and-forget: an alert transport failing must never fail the request
  // that triggered it. The structured log line is the record of truth either way.
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

/**
 * Record an error, scrubbed and correlated.
 *
 * Returns the correlation id so the caller can hand it to the user: an error
 * page that shows a reference someone can quote is the difference between a
 * bug report we can act on and "it broke yesterday".
 */
export function reportError(error: unknown, fields: LogFields = {}): ReportedError {
  const correlationId = fields.correlationId ?? null;

  const isError = error instanceof Error;
  const name = isError ? error.name : typeof error;
  const message = isError ? error.message : String(error);

  log('error', message, {
    ...fields,
    correlationId,
    errorName: name,
    // The stack is scrubbed like everything else: a Prisma constraint violation
    // puts the offending value straight into its message, and that value is
    // routinely an email address.
    stack: isError ? error.stack : undefined,
  });

  // Groups the same failure across requests without needing a vendor to do it.
  const fingerprint = `${name}:${scrubText(message).slice(0, 120)}`;

  pushAlert(name, message, fields, fingerprint);

  return { correlationId, fingerprint };
}
