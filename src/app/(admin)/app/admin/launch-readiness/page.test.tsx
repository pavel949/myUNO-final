import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ guard: vi.fn(), readiness: vi.fn(), vault: vi.fn(), labels: vi.fn() }));
vi.mock('@/app/libs/requireAdminPage', () => ({ requireAdminPage: mocks.guard }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/launch-readiness', () => ({ collectLaunchReadiness: mocks.readiness }));
vi.mock('@/modules/config', () => ({ listVaultEntries: mocks.vault }));
vi.mock('@/lib/i18n', () => ({ getLabels: mocks.labels, getRequestLocale: () => 'en' }));
vi.mock('@/components/premium/StitchPage', () => ({ PageHeading: ({ title, subtitle }: { title: string; subtitle: string }) => <div>{title}{subtitle}</div> }));
vi.mock('./keys-register', () => ({ default: () => null }));
import LaunchReadinessPage from './page';

describe('launch configuration page safety boundary', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.guard.mockResolvedValue({ identityId: 'admin' });
    mocks.readiness.mockResolvedValue({ items: [], blockingOpen: 0 });
    mocks.vault.mockResolvedValue([]);
    mocks.labels.mockImplementation(async (defaults: Record<string, string>) => {
      const oldDbCopy: Record<string, string> = {
        'admin.launch.subtitle': 'The code side is done.',
        'admin.launch.headline.ready': 'Nothing blocks launch.',
        'admin.launch.state.ok': 'Ready',
      };
      return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, oldDbCopy[key] ?? fallback]));
    });
  });

  it('does not start private reads before the admin guard has resolved', async () => {
    let allow!: () => void;
    mocks.guard.mockReturnValue(new Promise<void>((resolve) => { allow = resolve; }));
    const pending = LaunchReadinessPage();
    await Promise.resolve();
    expect(mocks.readiness).not.toHaveBeenCalled();
    expect(mocks.vault).not.toHaveBeenCalled();
    expect(mocks.labels).not.toHaveBeenCalled();
    allow();
    await pending;
  });

  it('does not read configuration or vault metadata after denied/failed authorization', async () => {
    mocks.guard.mockRejectedValue(new Error('denied'));
    await expect(LaunchReadinessPage()).rejects.toThrow('denied');
    expect(mocks.readiness).not.toHaveBeenCalled();
    expect(mocks.vault).not.toHaveBeenCalled();
    expect(mocks.labels).not.toHaveBeenCalled();
  });

  it('cannot reuse old all-clear CMS translations for the narrower configuration check', async () => {
    render(await LaunchReadinessPage());
    expect(screen.getByText('These configuration checks passed. Live operation still needs verification.')).toBeTruthy();
    expect(screen.queryByText('Nothing blocks launch.')).toBeNull();
    const requested = mocks.labels.mock.calls[0][0];
    expect(requested).not.toHaveProperty('admin.launch.subtitle');
    expect(requested).not.toHaveProperty('admin.launch.headline.ready');
    expect(requested).not.toHaveProperty('admin.launch.state.ok');
  });
});
