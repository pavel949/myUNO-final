import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ThreadClient from './thread-client';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
const labels = {
  'messages.thread.loading': 'Loading conversation', 'messages.thread.not_found': 'Conversation not found',
  'messages.thread.error_generic': 'Could not send. Please try again.', 'messages.thread.back': 'Messages',
  'messages.thread.placeholder': 'Write a message', 'messages.thread.send': 'Send',
};
const thread = { id: 'fixture-thread', participants: [], messages: [] };
afterEach(() => { vi.unstubAllGlobals(); });

describe('conversation interrupted requests', () => {
  it('leaves loading and presents a recoverable error when the conversation request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(<ThreadClient threadId={thread.id} labels={labels} />);
    expect(await screen.findByText('Could not send. Please try again.')).toBeInTheDocument();
    expect(screen.queryByText('Loading conversation')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Messages' })).toHaveAttribute('href', '/messages');
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
