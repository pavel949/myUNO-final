import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const state = vi.hoisted(() => ({ allowed: true, callback: null as null | ((message: unknown) => void) }));
const stop = vi.hoisted(() => vi.fn());
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: async () => ({ identityId: 'former-admin' }) }));
vi.mock('@/modules/comms/statement-thread-access', () => ({ canAccessThread: async () => state.allowed }));
vi.mock('@/modules/comms', () => ({ subscribeThread: (_id: string, callback: (message: unknown) => void) => { state.callback = callback; return stop; } }));
import { GET } from './route';
beforeEach(() => { state.allowed = true; state.callback = null; stop.mockClear(); });
describe('financial conversation stream authorization', () => {
  it('rejects a persisted participant who lacks current financial authority', async () => {
    state.allowed = false;
    const response = await GET(new NextRequest('http://localhost/api/threads/financial/stream'), { params: { threadId: 'financial' } });
    expect(response.status).toBe(404);
    expect(state.callback).toBeNull();
  });
  it('closes without emitting the next message after authority is revoked', async () => {
    const response = await GET(new NextRequest('http://localhost/api/threads/financial/stream'), { params: { threadId: 'financial' } });
    expect(response.status).toBe(200);
    const reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toBe(':heartbeat\n\n');
    state.allowed = false;
    state.callback!({ body: 'private financial message' });
    expect((await reader.read()).done).toBe(true);
    expect(stop).toHaveBeenCalledOnce();
  });
});
