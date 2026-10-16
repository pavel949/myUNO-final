import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ThreadClient from './thread-client';

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const labels = {
  'messages.thread.loading': 'Loading conversation', 'messages.thread.not_found': 'Conversation not found',
  'messages.thread.error_generic': 'Could not send. Please try again.', 'messages.thread.back': 'Messages',
  'messages.thread.retry': 'Try again', 'messages.thread.load_error': 'Refresh failed. Draft kept.',
  'messages.thread.empty': 'Start a conversation',
  'messages.thread.placeholder': 'Write a message', 'messages.thread.send': 'Send',
};
const thread = { id: 'fixture-thread', participants: [], messages: [] };
afterEach(() => { vi.unstubAllGlobals(); });

describe('conversation interrupted requests', () => {
  it('leaves loading and presents a recoverable error when the conversation request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(<ThreadClient threadId={thread.id} labels={labels} />);
    expect(await screen.findByText('Refresh failed. Draft kept.')).toBeInTheDocument();
    expect(screen.queryByText('Loading conversation')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Messages' })).toHaveAttribute('href', '/messages');
  });

  it('retries a failed conversation load and clears the failure after recovery', async () => {
    let recovered = false;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/auth/me')) return { ok: true, json: async () => ({ id: 'guest', roles: [] }) };
      if (!recovered) throw new Error('offline');
      return { ok: true, json: async () => ({ thread }) };
    }));
    render(<ThreadClient threadId={thread.id} labels={labels} />);
    expect(await screen.findByText('Refresh failed. Draft kept.')).toBeInTheDocument();
    recovered = true;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('textbox', { name: 'Write a message' })).toBeInTheDocument();
    expect(screen.queryByText('Refresh failed. Draft kept.')).not.toBeInTheDocument();
  });

  it('preserves the reply and request ID after a lost acknowledgement', async () => {
    const postBodies: Array<{ body: string; requestId: string }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        postBodies.push(JSON.parse(String(init.body)));
        if (postBodies.length === 1) throw new Error('offline');
        return { ok: true, json: async () => ({ message: 'persisted-reply' }) };
      }
      return { ok: true, json: async () => url.includes('/auth/me') ? { id: 'guest-fixture', roles: [] } : { thread } };
    }));
    render(<ThreadClient threadId={thread.id} labels={labels} />);
    const input = await screen.findByRole('textbox', { name: 'Write a message' });
    fireEvent.change(input, { target: { value: 'My specific question' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(postBodies).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).not.toBeDisabled());
    expect(input).toHaveValue('My specific question');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(postBodies).toHaveLength(2));
    expect(postBodies[1]).toEqual(postBodies[0]);
    await waitFor(() => expect(input).toHaveValue(''));
  });
});


it('refreshes on focus and refuses a late response after access has been revoked', async () => {
  let reads = 0;
  let resolveOld!: (value: unknown) => void;
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes('/auth/me')) return { ok: true, json: async () => ({ id: 'guest', roles: [] }) };
    reads++;
    if (reads === 1) return { ok: true, json: async () => ({ thread }) };
    if (reads === 2) return new Promise(resolve => { resolveOld = resolve; });
    return { ok: false, status: 403 };
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<ThreadClient threadId={thread.id} labels={labels} />);
  await screen.findByRole('textbox', { name: 'Write a message' });
  fireEvent(window, new Event('focus'));
  await waitFor(() => expect(reads).toBe(2));
  fireEvent(window, new Event('focus'));
  await screen.findByText('Conversation not found');
  await act(async () => resolveOld({ ok: true, json: async () => ({ thread }) }));
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith(`/api/threads/${thread.id}`, { cache: 'no-store' });
});
