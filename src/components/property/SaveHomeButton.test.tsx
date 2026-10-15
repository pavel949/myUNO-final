import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SaveHomeButton, SavedHomesProvider } from './SaveHomeButton';
import { stayUxDefaults } from '@/modules/content/stay-ux.seed';
const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('reads once for all cards and updates only after server acknowledgment', async () => {
  let acknowledge: (response: unknown) => void = () => {};
  const fetcher = vi.fn(async (_url: string, options?: RequestInit) => options?.method === 'PUT'
    ? new Promise(resolve => { acknowledge = resolve; })
    : { ok: true, json: async () => ({ unitIds: ['home'] }) });
  vi.stubGlobal('fetch', fetcher);
  render(<SavedHomesProvider><SaveHomeButton unitId="home" copy={stayUxDefaults('en')} /><SaveHomeButton unitId="other" copy={stayUxDefaults('en')} /></SavedHomesProvider>);
  const button = await screen.findByRole('button', { name: 'Saved home' });
  expect(fetcher).toHaveBeenCalledOnce();
  fireEvent.click(button);
  expect(button).toHaveAttribute('aria-pressed', 'true');
  expect(button).toBeDisabled();
  acknowledge({ ok: true, json: async () => ({ saved: false }) });
  await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'false'));
});

it('keeps state on save failure instead of showing false success', async () => {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, options?: RequestInit) => options?.method === 'PUT'
    ? { ok: false, status: 503 } : { ok: true, json: async () => ({ unitIds: [] }) }));
  render(<SavedHomesProvider><SaveHomeButton unitId="home" copy={stayUxDefaults('en')} /></SavedHomesProvider>);
  const button = screen.getByRole('button', { name: 'Save home' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await screen.findByRole('alert');
  expect(button).toHaveAttribute('aria-pressed', 'false');
});
