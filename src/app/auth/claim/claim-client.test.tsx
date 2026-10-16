import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ClaimClient from './claim-client';
const h = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), params: new URLSearchParams(), fetch: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push, refresh: h.refresh }), useSearchParams: () => h.params }));
const labels = { title: 'Set your password', subtitle: 'Your own account', claimingFor: 'Account', password: 'New password', passwordConfirm: 'Confirm password',
  submit: 'Activate account', submitting: 'Activating', errorMismatch: 'Passwords do not match', errorGeneric: 'Could not activate', errorInvalid: 'Invalid link', loading: 'Loading' };
beforeEach(() => { vi.clearAllMocks(); h.params = new URLSearchParams({ token: 'synthetic-token', next: '/property' }); vi.stubGlobal('fetch', h.fetch);
  h.fetch.mockImplementation(async (url: string) => ({ ok: true, json: async () => url.includes('/claim/') ? { identity: { email: 'employee@example.test', firstName: 'Synthetic', lastName: 'Employee' } } : { success: true } })); });
async function fill() { fireEvent.change(await screen.findByLabelText('New password'), { target: { value: 'synthetic-password' } });
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'synthetic-password' } }); }
describe('employee claims their own account', () => {
  it('uses the employee-entered password to activate and sign in, then opens assigned workspace', async () => {
    render(<ClaimClient labels={labels} />); await fill(); fireEvent.click(screen.getByRole('button', { name: 'Activate account' }));
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/property'));
    expect(h.refresh).toHaveBeenCalledTimes(1);
    expect(h.fetch.mock.calls.slice(1).map(([url, options]) => [url, JSON.parse(options.body)])).toEqual([
      ['/api/auth/claim', { token: 'synthetic-token', password: 'synthetic-password' }],
      ['/api/auth/login', { email: 'employee@example.test', password: 'synthetic-password' }],
    ]);
    expect(screen.getByLabelText('New password')).toHaveAttribute('autoComplete', 'new-password');
  });
  it.each(['https://external.example/', '//external.example/', '/\\external.example/', 'javascript:alert(1)'])('does not follow unsafe next destination %s', async next => {
    h.params.set('next', next); render(<ClaimClient labels={labels} />); await fill(); fireEvent.click(screen.getByRole('button', { name: 'Activate account' }));
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/trips'));
  });
  it('offers the same safe login destination if claim succeeded but automatic login failed', async () => {
    h.fetch.mockImplementation(async (url: string) => ({ ok: url !== '/api/auth/login', json: async () => url.includes('/claim/') ? { identity: { email: 'employee@example.test' } } : { success: true } }));
    render(<ClaimClient labels={labels} />); await fill(); fireEvent.click(screen.getByRole('button', { name: 'Activate account' }));
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/login?next=%2Fproperty'));
  });
  it('does not submit mismatched passwords or invent a successful login', async () => {
    render(<ClaimClient labels={labels} />); await fill(); fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'different-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Activate account' })); expect(await screen.findByText('Passwords do not match')).toBeVisible();
    expect(h.fetch).toHaveBeenCalledTimes(1); expect(h.push).not.toHaveBeenCalled();
  });
});
