import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity } from '@/test/util';

const currentUser = vi.hoisted(() => vi.fn());
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: currentUser }));
import { DELETE, POST, PUT } from './route';

const req = (method: string, body: unknown) =>
  new NextRequest('http://localhost/api/admin/secrets', { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });

describe('/api/admin/secrets — founder key register', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('refuses anonymous callers and ordinary users, whatever they send', async () => {
    currentUser.mockResolvedValue(null);
    expect((await PUT(req('PUT', { name: 'X', value: 'v' }))).status).toBe(401);
    const guest = await createIdentity();
    currentUser.mockResolvedValue({ identityId: guest.id, isAdmin: false, roles: [] });
    expect((await PUT(req('PUT', { name: 'X', value: 'v' }))).status).toBe(403);
    expect((await POST(req('POST', { name: 'X' }))).status).toBe(403);
    expect((await DELETE(req('DELETE', { name: 'X' }))).status).toBe(403);
    expect(await db.secretVaultEntry.count()).toBe(0);
  });

  it('lets an admin save, reveal (no-store) and delete; rejects invalid names', async () => {
    const admin = await createIdentity({ isAdmin: true });
    currentUser.mockResolvedValue({ identityId: admin.id, isAdmin: true, roles: [] });
    expect((await PUT(req('PUT', { name: 'OMISE_SECRET_KEY', value: 'skey_test_123456789' }))).status).toBe(200);
    const shown = await POST(req('POST', { name: 'OMISE_SECRET_KEY' }));
    expect(shown.headers.get('cache-control')).toBe('no-store');
    expect(await shown.json()).toEqual({ value: 'skey_test_123456789' });
    expect((await PUT(req('PUT', { name: 'bad name', value: 'v' }))).status).toBe(400);
    expect((await DELETE(req('DELETE', { name: 'OMISE_SECRET_KEY' }))).status).toBe(200);
    expect((await POST(req('POST', { name: 'OMISE_SECRET_KEY' }))).status).toBe(404);
  });
});
