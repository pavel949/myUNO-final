import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT_UI_LABELS } from './UI-labels';
import { CONTENT_PROPOSAL_EDITOR_KEYS, CONTENT_PROPOSAL_EDITOR_DRAFTS } from '@/modules/content/content-proposal-editor.seed';
import { CONTENT_PROPOSAL_REVIEW_KEYS, CONTENT_PROPOSAL_REVIEW_DRAFTS } from '@/modules/content/content-proposal-review.seed';
import PropertyContentPage from './page';
import PropertyContentReviewPage from '@/app/(admin)/app/admin/property-content-proposals/page';
const mocks = vi.hoisted(() => ({ user: { identityId: 'employee', isAdmin: false } as { identityId: string; isAdmin: boolean } | null, locale: 'ru', tMany: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => ({ value: mocks.locale }) }) }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`Redirect:${url}`); } }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: async () => mocks.user }));
vi.mock('@/modules/content', () => ({ tMany: mocks.tMany }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

describe('contributor pages and registered Russian copy', () => {
  beforeEach(() => { mocks.user = { identityId: 'employee', isAdmin: false }; mocks.locale = 'ru'; mocks.tMany.mockReset().mockResolvedValue({}); });
  it('registers each editor label with reviewed-later English and Russian defaults', () => {
    expect(CONTENT_PROPOSAL_EDITOR_KEYS.map(row => row.key).sort()).toEqual(Object.keys(CONTENT_UI_LABELS).sort());
    for (const row of CONTENT_PROPOSAL_EDITOR_KEYS) expect(row.en).toBe(CONTENT_UI_LABELS[row.key]);
    for (const row of [...CONTENT_PROPOSAL_EDITOR_KEYS, ...CONTENT_PROPOSAL_REVIEW_KEYS]) {
      expect(row.status).toBe('needs_review'); expect(row.namespace).toBe('property');
      expect(row.en.trim()).not.toBe(''); expect(row.ru).toMatch(/[А-Яа-яЁё]/u);
    }
  });
  it('keeps employee entry available with Russian drafts before seeding and preserves login destination', async () => {
    const page = await PropertyContentPage();
    expect(page.props.initialLocale).toBe('ru');
    for (const row of CONTENT_PROPOSAL_EDITOR_KEYS) expect(page.props.labels[row.key]).toBe(CONTENT_PROPOSAL_EDITOR_DRAFTS[row.key].ru);
    mocks.user = null;
    await expect(PropertyContentPage()).rejects.toThrow('Redirect:/login?next=%2Fproperty%2Fcontent');
  });
  it('denies non-admin review and uses registered reviewer drafts for an admin', async () => {
    await expect(PropertyContentReviewPage()).rejects.toThrow('Redirect:/');
    mocks.user = { identityId: 'admin', isAdmin: true };
    const page = await PropertyContentReviewPage();
    const review = page.props.children[2];
    for (const row of CONTENT_PROPOSAL_REVIEW_KEYS) expect(review.props.labels[row.key]).toBe(CONTENT_PROPOSAL_REVIEW_DRAFTS[row.key].ru);
  });
});
