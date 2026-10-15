import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getConfig: vi.fn(async () => ['cash', 'bank_transfer']) }));
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock('@/modules/config', () => mocks);
vi.mock('@/lib/prisma', () => ({ prisma: { unit: { findUnique: async () => ({ projectId: 'project-a' }) } } }));
vi.mock('@/modules/booking', () => ({ resolveStayCancellationPolicyForDates: async () => ({ name: 'season', steps: [] }) }));
vi.mock('@/lib/i18n', () => ({ getLabels: async (keys: Record<string, string>, _locale?: string, drafts?: Record<string, Record<string, string>>) =>
  Object.fromEntries(Object.entries(keys).map(([key, fallback]) => [key, drafts?.[key]?.ru ?? fallback])),
}));
vi.mock('./review-client', () => ({ default: () => null }));
import BookingReviewPage from './page';

beforeEach(() => { vi.clearAllMocks(); });

it('passes the existing Russian season draft and localized approval step into review', async () => {
  const page = await BookingReviewPage({ searchParams: { unitId: 'unit-a', startDate: '2027-01-10', endDate: '2027-01-13' } });
  const client = page.props.children;
  expect(client.props.defaultPolicy).toBe('Условия сезона');
  expect(client.props.methods).toEqual(['cash', 'bank_transfer']);
  expect(client.props.stepsLabels).toMatchObject({ review: 'Проверка', approval: 'Одобрение', pay: 'Оплата' });
  expect(mocks.getConfig).toHaveBeenCalledWith(expect.anything(), 'booking.payment.methods_enabled', { projectId: 'project-a' });
});

it('rejects a foreign project before selecting payment methods for a direct unit link', async () => {
  await expect(BookingReviewPage({ searchParams: {
    unitId: 'unit-a', projectId: 'foreign-project', startDate: '2027-01-10', endDate: '2027-01-13',
  } })).rejects.toThrow('redirect:/search');
  expect(mocks.getConfig).not.toHaveBeenCalled();
});

it('accepts a matching project on a direct unit link', async () => {
  const page = await BookingReviewPage({ searchParams: {
    unitId: 'unit-a', projectId: 'project-a', startDate: '2027-01-10', endDate: '2027-01-13',
  } });
  expect(page.props.children.props.projectId).toBe('project-a');
});
