import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn(), execute: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: mocks.query, $executeRaw: mocks.execute } }));
import { checkRateLimit } from './rateLimit';

describe('shared rate limiter failure policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Math, 'random').mockReturnValue(1);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.execute.mockResolvedValue(1);
  });
  afterEach(() => vi.restoreAllMocks());

  it('keeps a known denial when the backoff update fails', async () => {
    mocks.query.mockResolvedValue([{ attempts: 6, remaining_ms: 1000, backoff: 1 }]);
    mocks.execute.mockRejectedValue(new Error('backoff write failed'));
    expect(await checkRateLimit('failure:known-denial')).toEqual({ allowed: false, retryAfterMs: 121000 });
  });

  it.each(['missing table', 'permission denied', 'connection unavailable'])('fails closed on %s', async (message) => {
    mocks.query.mockRejectedValue(new Error(message));
    expect(await checkRateLimit(`failure:${message}`)).toEqual({ allowed: false, retryAfterMs: 60000 });
    expect(console.error).toHaveBeenCalledWith('Shared rate limiter unavailable; request refused');
  });

  it('fails closed if the database returns no counter', async () => {
    mocks.query.mockResolvedValue([]);
    expect((await checkRateLimit('failure:empty')).allowed).toBe(false);
  });

  it('continues to allow a healthy shared counter within budget', async () => {
    mocks.query.mockResolvedValue([{ attempts: 5, remaining_ms: 1000, backoff: 1 }]);
    expect(await checkRateLimit('healthy:within-budget')).toEqual({ allowed: true });
  });
});
