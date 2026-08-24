import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  scrubText,
  scrubValue,
  sanitiseCorrelationId,
  newCorrelationId,
  reportError,
  log,
} from './observability';

/**
 * P1-5. Two promises are being kept here, and both are testable.
 *
 * That a failure can be found: every record carries the request's correlation
 * id, so a user quoting a reference leads to the exact request.
 *
 * That finding it costs nothing: CLAUDE.md says builders never log PII, and the
 * handler this replaces printed error messages verbatim — including Prisma
 * constraint violations, which put the offending value straight into the text,
 * and that value is routinely a guest's email.
 */
describe('observability', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.LOG_SILENT;
    delete process.env.ALERT_WEBHOOK_URL;
  });

  describe('scrubbing free text', () => {
    it('redacts an email address', () => {
      expect(scrubText('failed for guest@example.com')).toBe('failed for [email]');
    });

    it('redacts the email a Prisma unique violation leaks', () => {
      // The exact shape seen in this repo's own CI logs.
      const prismaMessage =
        'Unique constraint failed on the fields: (`email`) with value (pavel@ignatevestate.com)';

      expect(scrubText(prismaMessage)).not.toContain('pavel@ignatevestate.com');
    });

    it('redacts an international phone number', () => {
      expect(scrubText('called +66 92 240 7355 twice')).toBe('called [phone] twice');
    });

    it('redacts a passport-shaped document number', () => {
      // Letters then digits, so a word-boundary rule would miss the digits
      // precisely because a letter precedes them.
      expect(scrubText('passport AB1234567 rejected')).toContain('[document]');
      expect(scrubText('passport AB1234567 rejected')).not.toContain('AB1234567');
    });

    it('redacts a long digit run, which may be a card number', () => {
      expect(scrubText('charged 4111111111111111')).toContain('[number]');
    });

    it('leaves ordinary text and short numbers alone', () => {
      // Over-redacting makes a log useless in the other direction.
      const message = 'booking 4 nights for 2 adults failed with status 409';
      expect(scrubText(message)).toBe(message);
    });
  });

  describe('scrubbing structured values', () => {
    it('redacts by field name whatever the value looks like', () => {
      const scrubbed = scrubValue({
        password: 'hunter2',
        passportNumber: 'AA123',
        token: 'abc',
        unitName: 'Villa A',
      }) as Record<string, unknown>;

      expect(scrubbed.password).toBe('[redacted]');
      expect(scrubbed.passportNumber).toBe('[redacted]');
      expect(scrubbed.token).toBe('[redacted]');
      expect(scrubbed.unitName).toBe('Villa A');
    });

    it('reaches into nested objects', () => {
      const scrubbed = scrubValue({
        booking: { guest: { email: 'x@y.com', firstName: 'Anna' } },
      }) as any;

      expect(scrubbed.booking.guest.email).toBe('[redacted]');
      expect(scrubbed.booking.guest.firstName).toBe('Anna');
    });

    it('stops at a depth limit rather than following a huge graph', () => {
      let deep: any = 'bottom';
      for (let i = 0; i < 20; i += 1) deep = { next: deep };

      expect(() => scrubValue(deep)).not.toThrow();
      expect(JSON.stringify(scrubValue(deep))).toContain('[truncated]');
    });

    it('survives a cyclic object', () => {
      // An error's cause chain can be cyclic; a logger that throws while logging
      // an error is the worst possible failure mode.
      const a: any = { name: 'a' };
      a.self = a;

      expect(() => scrubValue(a)).not.toThrow();
    });
  });

  describe('correlation ids', () => {
    it('mints ids that are unique', () => {
      const ids = new Set(Array.from({ length: 200 }, () => newCorrelationId()));
      expect(ids.size).toBe(200);
    });

    it('accepts an id that looks like one we issued', () => {
      const id = newCorrelationId();
      expect(sanitiseCorrelationId(id)).toBe(id);
    });

    it.each([
      ['too short', 'abc'],
      ['header injection', 'abc\r\nX-Admin: true'],
      ['log line forgery', 'aaaaaaaa"}\n{"level":"info'],
      ['spaces', 'not a valid id'],
      ['empty', ''],
    ])('refuses %s, which would let a caller forge log lines', (_label, value) => {
      expect(sanitiseCorrelationId(value)).toBeNull();
    });

    it('refuses an absurdly long id', () => {
      expect(sanitiseCorrelationId('a'.repeat(500))).toBeNull();
    });
  });

  describe('reporting an error', () => {
    it('emits one JSON line carrying the correlation id', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      reportError(new Error('something broke'), {
        correlationId: 'abcdefgh1234',
        route: '/api/bookings',
      });

      expect(spy).toHaveBeenCalledTimes(1);
      const record = JSON.parse(spy.mock.calls[0][0] as string);

      expect(record.level).toBe('error');
      expect(record.message).toBe('something broke');
      expect(record.correlationId).toBe('abcdefgh1234');
      expect(record.route).toBe('/api/bookings');
      expect(record.timestamp).toBeTruthy();
    });

    it('scrubs PII out of the message and the stack', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      reportError(new Error('no booking for guest@example.com'), { correlationId: 'abcdefgh1234' });

      const line = spy.mock.calls[0][0] as string;
      expect(line).not.toContain('guest@example.com');
      expect(line).toContain('[email]');
    });

    it('handles a thrown non-Error without losing the record', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = reportError('a bare string', { correlationId: 'abcdefgh1234' });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(result.fingerprint).toContain('a bare string');
    });

    it('fingerprints the same failure identically across requests', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const first = reportError(new Error('DB unreachable'), { correlationId: 'aaaaaaaa1111' });
      const second = reportError(new Error('DB unreachable'), { correlationId: 'bbbbbbbb2222' });

      // Groups without needing a vendor to do the grouping.
      expect(first.fingerprint).toBe(second.fingerprint);
      expect(first.correlationId).not.toBe(second.correlationId);
    });

    it('returns the id so a caller can show the user a reference', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(reportError(new Error('x'), { correlationId: 'abcdefgh1234' }).correlationId).toBe(
        'abcdefgh1234'
      );
    });
  });

  describe('pushing an ops alert (Q47 — "nothing alerts you when something breaks")', () => {
    it('is a no-op with no ALERT_WEBHOOK_URL configured', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null));

      reportError(new Error('DB unreachable'), { correlationId: 'abcdefgh1234' });

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('POSTs a scrubbed summary to the configured webhook', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      process.env.ALERT_WEBHOOK_URL = 'https://hooks.example.com/incoming/abc';
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null));

      reportError(new Error('no booking for guest@example.com'), {
        correlationId: 'abcdefgh1234',
        route: '/api/bookings',
        statusCode: 500,
      });

      // Fire-and-forget: let the unawaited fetch promise settle before asserting.
      await Promise.resolve();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://hooks.example.com/incoming/abc');
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.text).toContain('Error');
      expect(body.text).not.toContain('guest@example.com');
      expect(body.text).toContain('[email]');
      expect(body.correlationId).toBe('abcdefgh1234');
      expect(body.route).toBe('/api/bookings');
      expect(body.statusCode).toBe(500);
    });

    it('never pages for a caller-classified 4xx mistake', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      process.env.ALERT_WEBHOOK_URL = 'https://hooks.example.com/incoming/abc';
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null));

      reportError(new Error('validation failed'), {
        correlationId: 'abcdefgh1234',
        statusCode: 400,
        expected: true,
      });
      await Promise.resolve();

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('never throws or rejects the caller when the webhook itself fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      process.env.ALERT_WEBHOOK_URL = 'https://hooks.example.com/incoming/abc';
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));

      expect(() => reportError(new Error('DB unreachable'), { correlationId: 'abcdefgh1234' })).not.toThrow();
      await Promise.resolve();
    });
  });

  describe('log levels', () => {
    it('sends warnings to warn, not error', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      log('warn', 'slow query');

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('stays silent under LOG_SILENT so a failure-path suite is readable', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      process.env.LOG_SILENT = '1';

      log('error', 'boom');

      expect(spy).not.toHaveBeenCalled();
    });
  });
});
