import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(), parse: vi.fn(), plan: vi.fn(), apply: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/app/libs/onboardingGuard', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('@/modules/integrations/layantara/workbook-import', () => ({
  parseReservationsWorkbook: mocks.parse,
  planWorkbookImport: mocks.plan,
  applyWorkbookImport: mocks.apply,
  WorkbookReconciliationRequired: class extends Error {
    constructor(public readonly plan: unknown) { super('WORKBOOK_RECONCILIATION_REQUIRED'); }
  },
}));
import { POST } from './route';
import { WorkbookReconciliationRequired, type ImportPlan } from '@/modules/integrations/layantara/workbook-import';

const plan: ImportPlan = {
  systemId: 'source', environment: 'test', today: '2026-10-06', stays: [], problems: [], untouchedProtections: [],
  applyBlockers: [{ rowNumber: 3, ref: 'PAID-ROW', message: 'source_payment_unverified', paymentStatus: 'Paid', amountPaidRaw: '500' }],
  summary: { create: 0, create_cancelled: 0, change: 0, cancel: 0, unchanged: 0, skip: 0, reservations: 0, problems: 0 },
};
const request = (mode: string, sourceMode?: string) => ({ formData: async () => ({
  get: (key: string) => key === 'mode' ? mode : key === 'sourceMode' ? sourceMode : key === 'file' ? { size: 1, arrayBuffer: async () => new ArrayBuffer(1) } : { blockId: 'untrusted-client-block' },
}) }) as unknown as NextRequest;

describe('workbook import reconciliation responses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actorIdentityId: 'admin' });
    mocks.parse.mockReturnValue({ rows: [], problems: [], sourcePayments: [] });
    mocks.plan.mockResolvedValue(plan);
  });

  it('returns a read-only 200 preview with source payment blockers', async () => {
    const response = await POST(request('preview'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ mode: 'preview', applyBlockers: plan.applyBlockers });
    expect(mocks.apply).not.toHaveBeenCalled();
  });

  it('returns 422 with the reviewable plan when apply requires reconciliation', async () => {
    mocks.apply.mockRejectedValue(new WorkbookReconciliationRequired(plan));
    const response = await POST(request('apply'));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: 'WORKBOOK_RECONCILIATION_REQUIRED', mode: 'preview', applyBlockers: plan.applyBlockers,
    });
  });
  it('requests server-reviewed mode without accepting client protection identities', async () => {
    const response = await POST(request('preview', 'reviewed_source'));
    expect(response.status).toBe(200);
    expect(mocks.plan).toHaveBeenCalledWith({}, mocks.parse.mock.results[0].value,
      expect.any(Date), { reviewedSource: true });
    expect(mocks.apply).not.toHaveBeenCalled();
  });

  it('keeps default uploads on the legacy guarded path', async () => {
    await POST(request('preview', 'untrusted-mode'));
    expect(mocks.plan).toHaveBeenCalledWith({}, mocks.parse.mock.results[0].value,
      expect.any(Date), { reviewedSource: false });
  });

});
