import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { db, resetDb } from '@/test/util';
import { createSessionToken, SESSION_COOKIE_NAME } from './session';
import { confirmPasswordReset } from './auth';
import { changeAccountPassword, revokeAllSessions } from '@/modules/core';
import { POST as passwordLogin } from '@/app/api/auth/login/route';
import { POST as passwordRegister } from '@/app/api/auth/register/route';
import { GET as googleCallback } from '@/app/api/auth/callback/google/route';

const mail = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('./email', () => ({ sendEmail: mail.send }));
vi.mock('react', async (original) => ({ ...(await original<typeof import('react')>()), cache: <T>(fn: T) => fn }));
let cookieValue: string | undefined;
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (name: string) => name === SESSION_COOKIE_NAME && cookieValue ? { value: cookieValue } : undefined }) }));
import { getSessionUser } from '@/lib/session';

function barrier() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
const request = (path: string, body: unknown) => new NextRequest(`http://localhost${path}`, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
async function identity() {
  return db.identity.create({ data: { firstName: 'Test', lastName: 'Owner', email: 'race@example.com', status: 'active', hashedPassword: await bcrypt.hash('OldPass123', 4) } });
}
async function reset(identityId: string, token = 'test-reset-proof') {
  await db.oneTimeToken.create({ data: { identityId, purpose: 'password_reset', tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 60_000) } });
  return confirmPasswordReset({ token, newPassword: 'RecoveredPass123' });
}
async function google() {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(url.includes('oauth2.googleapis.com')
    ? { access_token: 'test-token' }
    : { id: 'test-google', email: 'race@example.com', verified_email: true, given_name: 'Real', family_name: 'Owner' }), { status: 200 })));
  return googleCallback(new NextRequest('http://localhost/api/auth/callback/google?code=test&state=test-state', { headers: { cookie: 'google_oauth_state=test-state' } }));
}

describe('credential proof survives only its own session generation', () => {
  beforeEach(async () => { await resetDb(); cookieValue = undefined; mail.send.mockReset().mockResolvedValue(undefined); });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it.each(['reset', 'google'] as const)('rejects a delayed old-password login after %s recovery', async (method) => {
    const owner = await identity();
    const entered = barrier(), resume = barrier();
    vi.spyOn(bcrypt, 'compare').mockImplementationOnce(async () => { entered.resolve(); await resume.promise; return true; });
    const pending = passwordLogin(request('/api/auth/login', { email: owner.email, password: 'OldPass123' }));
    await entered.promise;
    if (method === 'reset') await reset(owner.id); else await google();
    resume.resolve();
    const response = await pending;
    cookieValue = response.cookies.get(SESSION_COOKIE_NAME)?.value;
    expect(cookieValue).toBeTruthy();
    expect(await getSessionUser()).toBeNull();
  });

  it('rejects a registration cookie delayed across verified Google takeover', async () => {
    const entered = barrier(), resume = barrier();
    mail.send.mockImplementationOnce(async () => { entered.resolve(); await resume.promise; });
    const pending = passwordRegister(request('/api/auth/register', { firstName: 'Unverified', lastName: 'Registrant', email: 'race@example.com', password: 'OldPass123' }));
    await entered.promise;
    const recovered = await google();
    resume.resolve();
    const response = await pending;
    cookieValue = response.cookies.get(SESSION_COOKIE_NAME)?.value;
    expect(cookieValue).toBeTruthy();
    expect(await getSessionUser()).toBeNull();
    cookieValue = recovered.cookies.get(SESSION_COOKIE_NAME)?.value;
    expect((await getSessionUser())?.email).toBe('race@example.com');
  });

  it('refuses a stale password-change proof rather than overwriting a reset', async () => {
    const owner = await identity();
    const entered = barrier(), resume = barrier();
    vi.spyOn(bcrypt, 'compare').mockImplementationOnce(async () => { entered.resolve(); await resume.promise; return true; });
    const pending = changeAccountPassword(db, owner.id, 'OldPass123', 'StaleReplacement123');
    const rejected = expect(pending).rejects.toMatchObject({ code: 'STALE_CREDENTIALS' });
    await entered.promise;
    await reset(owner.id);
    const recovered = await db.identity.findUniqueOrThrow({ where: { id: owner.id } });
    resume.resolve();
    await rejected;
    const after = await db.identity.findUniqueOrThrow({ where: { id: owner.id } });
    expect(after.hashedPassword).toBe(recovered.hashedPassword);
    expect(after.sessionsValidFrom).toEqual(recovered.sessionsValidFrom);
  });

  it('does not revive a password-change response after another logout', async () => {
    const owner = await identity();
    const changed = await changeAccountPassword(db, owner.id, 'OldPass123', 'NewPassword123');
    await revokeAllSessions(db, owner.id);
    cookieValue = createSessionToken(owner.id, changed.sessionsValidFrom.getTime());
    expect(await getSessionUser()).toBeNull();
  });

  it('consumes a reset link once even when both requests validate it before hashing', async () => {
    const owner = await identity();
    const token = 'one-use-test-token';
    await db.oneTimeToken.create({ data: { identityId: owner.id, purpose: 'password_reset', tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 60_000) } });
    const bothEntered = barrier();
    let calls = 0;
    const originalHash = bcrypt.hash.bind(bcrypt);
    vi.spyOn(bcrypt, 'hash').mockImplementation(async (password: string, rounds: number | string) => {
      calls += 1;
      if (calls === 2) bothEntered.resolve();
      await bothEntered.promise;
      return originalHash(password, rounds);
    });
    const results = await Promise.allSettled([
      confirmPasswordReset({ token, newPassword: 'ReplacementOne123' }),
      confirmPasswordReset({ token, newPassword: 'ReplacementTwo123' }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });
});
