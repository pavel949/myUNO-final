import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendEmail, EmailDeliveryRetryableError } from './email.seam';
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
const input = { to: 'synthetic@example.test', subject: 'Synthetic', body: 'Isolated', idempotencyKey: 'notification/test-id', retryTransient: true };
describe('notification email provider request', () => {
  it('sends a bounded provider request with the stable delivery key', async () => {
    vi.stubEnv('RESEND_API_KEY', 'synthetic-test-key');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'provider-test-ack' }) });
    vi.stubGlobal('fetch', fetchMock);
    expect(await sendEmail(input)).toBe('provider-test-ack');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ headers: { 'Idempotency-Key': input.idempotencyKey }, signal: expect.any(AbortSignal) });
  });
  it.each([429, 500, 503])('leaves HTTP %s retryable without exposing provider response content', async status => {
    vi.stubEnv('RESEND_API_KEY', 'synthetic-test-key');
    const text = vi.fn().mockResolvedValue('private provider details');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status, text }));
    await expect(sendEmail(input)).rejects.toBeInstanceOf(EmailDeliveryRetryableError);
    expect(text).not.toHaveBeenCalled();
  });
  it('does not retry a permanent rejection or log its body', async () => {
    vi.stubEnv('RESEND_API_KEY', 'synthetic-test-key');
    const text = vi.fn().mockResolvedValue('private provider details');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, text }));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await sendEmail(input)).toBeNull();
    expect(text).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('[RESEND ERROR]', 401);
  });
});
