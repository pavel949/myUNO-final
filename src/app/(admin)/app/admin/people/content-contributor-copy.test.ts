import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPeoplePage from './page';
import { CONTENT_CONTRIBUTOR_ROLE_KEYS, CONTENT_CONTRIBUTOR_ROLE_LOCALE_DRAFTS } from '@/modules/content/content-contributor-role.seed';

const mocks = vi.hoisted(() => ({
  locale: undefined as string | undefined,
  tMany: vi.fn(),
  requireAdminPage: vi.fn(),
  projects: vi.fn(),
}));
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => mocks.locale ? { value: mocks.locale } : undefined }) }));
vi.mock('@/modules/content', () => ({ tMany: mocks.tMany }));
vi.mock('@/app/libs/requireAdminPage', () => ({ requireAdminPage: mocks.requireAdminPage }));
vi.mock('@/lib/prisma', () => ({ prisma: { project: { findMany: mocks.projects } } }));

describe('contributor role localization registration and pre-seed rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.locale = undefined;
    mocks.tMany.mockResolvedValue({});
    mocks.projects.mockResolvedValue([]);
  });

  it('registers every new role picker key in all four locales as needs_review', () => {
    const keys = [
      'content_contributor', 'scope_unit', 'scope_shared_content', 'content_scope_note',
      'unit', 'unit_search', 'unit_choose', 'units_loading', 'units_error',
      'units_none', 'units_refine', 'units_retry', 'content_workspace_link',
    ].map(key => `admin.people.${key}`);
    expect(CONTENT_CONTRIBUTOR_ROLE_KEYS.map(row => row.key).sort()).toEqual(keys.sort());
    expect(new Set(CONTENT_CONTRIBUTOR_ROLE_KEYS.map(row => row.key)).size).toBe(keys.length);
    for (const row of CONTENT_CONTRIBUTOR_ROLE_KEYS) {
      expect(row.status).toBe('needs_review');
      expect(row.namespace).toBe('admin');
      for (const locale of ['en', 'ru', 'th', 'zh'] as const) {
        expect(row[locale].trim().length).toBeGreaterThan(0);
        expect(CONTENT_CONTRIBUTOR_ROLE_LOCALE_DRAFTS[row.key][locale]).toBe(row[locale]);
      }
      expect(row.ru).toMatch(/[А-Яа-яЁё]/u);
      expect(row.th).toMatch(/[\u0E00-\u0E7F]/u);
      expect(row.zh).toMatch(/[\u4E00-\u9FFF]/u);
    }
  });

  it.each([undefined, 'ru', 'en', 'th', 'zh'])('renders registered drafts with no seeded rows for locale %s', async locale => {
    mocks.locale = locale;
    const page = await AdminPeoplePage();
    const expectedLocale = locale ?? 'ru';
    for (const row of CONTENT_CONTRIBUTOR_ROLE_KEYS) {
      expect(page.props.labels[row.key]).toBe(row[expectedLocale as 'ru' | 'en' | 'th' | 'zh']);
    }
    expect(mocks.requireAdminPage).toHaveBeenCalledOnce();
    expect(mocks.tMany).toHaveBeenCalledWith(expect.anything(), expect.any(Array), expectedLocale, {
      requestedLocaleFallbacks: Object.fromEntries(CONTENT_CONTRIBUTOR_ROLE_KEYS.map(row => [row.key, row[expectedLocale as 'ru' | 'en' | 'th' | 'zh']])),
    });
  });

  it('uses Russian drafts when the content store is unavailable', async () => {
    mocks.tMany.mockRejectedValue(new Error('Content store unavailable'));
    const page = await AdminPeoplePage();
    expect(page.props.labels['admin.people.unit']).toBe('Конкретный объект');
    expect(page.props.labels['admin.people.scope_shared_content']).toBe(CONTENT_CONTRIBUTOR_ROLE_LOCALE_DRAFTS['admin.people.scope_shared_content'].ru);
  });

  it('preserves CMS-edited requested-locale wording when supplied by the content resolver', async () => {
    mocks.tMany.mockResolvedValue({ 'admin.people.unit': 'Выбранный объект' });
    const page = await AdminPeoplePage();
    expect(page.props.labels['admin.people.unit']).toBe('Выбранный объект');
  });
});
