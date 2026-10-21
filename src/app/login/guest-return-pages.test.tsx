import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from './page';
import RegisterPage from '@/app/register/page';
import NewTicketPage from '@/app/tickets/new/page';

const state = vi.hoisted(() => ({ user: { identityId: 'guest' } as { identityId: string } | null, redirect: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { state.redirect(url); throw new Error('redirect'); } }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: async () => state.user }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/i18n', () => ({ getLabels: async (labels: Record<string, string>) => labels }));
vi.mock('@/modules/config', () => ({ getCatalogKeys: async () => [] }));
vi.mock('./login-form', () => ({ LoginForm: () => null }));
vi.mock('@/app/register/register-form', () => ({ RegisterForm: () => null }));
vi.mock('@/app/tickets/new/new-ticket-client', () => ({ default: () => null }));

beforeEach(() => { state.user = { identityId: 'guest' }; state.redirect.mockClear(); });
describe('guest page return destinations', () => {
  it.each([LoginPage, RegisterPage])('returns a signed-in guest to the requested local workflow', async page => {
    const next = '/book/review?unitId=fixture&bookingIntent=fixture';
    await expect(page({ searchParams: { next } })).rejects.toThrow('redirect');
    expect(state.redirect).toHaveBeenCalledWith(next);
  });
  it.each([LoginPage, RegisterPage])('rejects an external return URL for a signed-in guest', async page => {
    await expect(page({ searchParams: { next: '//untrusted.test' } })).rejects.toThrow('redirect');
    expect(state.redirect).toHaveBeenCalledWith('/');
  });
  it('keeps the property and booking context through ticket sign-in', async () => {
    state.user = null;
    await expect(NewTicketPage({ searchParams: { projectId: 'project-a', unitId: 'unit-a', bookingId: 'booking-a', ignored: 'external' } })).rejects.toThrow('redirect');
    const next = '/tickets/new?projectId=project-a&unitId=unit-a&bookingId=booking-a';
    expect(state.redirect).toHaveBeenCalledWith(`/login?next=${encodeURIComponent(next)}`);
  });
});
