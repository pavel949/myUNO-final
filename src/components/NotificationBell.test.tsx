import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { NotificationBell } from './NotificationBell';

afterEach(() => { vi.unstubAllGlobals(); });
const labels = { aria: 'Notifications', empty: 'No notifications', markAll: 'Mark all read' };
const data = { notifications: [{ id: 'private', title: 'Private message', body: 'Personal content', readAt: null, createdAt: new Date().toISOString() }], unreadCount: 1 };

it('clears private notifications on revoked access and ignores a superseded successful response', async () => {
  let reads = 0;
  let resolveOld!: (value: unknown) => void;
  const fetchMock = vi.fn(async () => {
    reads++;
    if (reads === 1) return { ok: true, json: async () => data };
    if (reads === 2) return new Promise(resolve => { resolveOld = resolve; });
    return { ok: false, status: 401 };
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<NotificationBell labels={labels} />);
  fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
  await screen.findByText('Private message');
  fireEvent(window, new Event('focus'));
  await waitFor(() => expect(reads).toBe(2));
  fireEvent(window, new Event('focus'));
  await screen.findByText('No notifications');
  await act(async () => resolveOld({ ok: true, json: async () => data }));
  expect(screen.queryByText('Private message')).not.toBeInTheDocument();
  expect(screen.queryByText('1')).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith('/api/notifications', { cache: 'no-store' });
});

it('refreshes persisted notification state when a tab becomes visible again', async () => {
  let latest = { notifications: [], unreadCount: 0 } as typeof data;
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => latest })));
  render(<NotificationBell labels={labels} />);
  fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
  await screen.findByText('No notifications');
  latest = data;
  fireEvent(document, new Event('visibilitychange'));
  await screen.findByText('Private message');
});
