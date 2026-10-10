import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { OWNER_VISIBLE_STATEMENT_STATUSES } from '@/modules/finance/statement-signoff.service';

const state = vi.hoisted(() => ({ user: { identityId: 'owner-a' } as { identityId: string } | null, rows: [] as any[] }));
const findMany = vi.hoisted(() => vi.fn(async ({ where }: any) => state.rows.filter(row =>
  row.ownerIdentityId === where.ownerIdentityId && (!where.status || where.status.in.includes(row.status)) &&
  (!where.unit || row.unit.status !== where.unit.status.not)
)));
const track = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('@/lib/prisma', () => ({ prisma: { ownerStatement: { findMany } } }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: async () => state.user }));
vi.mock('@/modules/analytics', () => ({ track }));
import { GET } from './route';

beforeEach(() => {
  state.user = { identityId: 'owner-a' };
  vi.clearAllMocks();
  const date = new Date('2026-08-01T00:00:00Z');
  state.rows = ['draft', ...OWNER_VISIBLE_STATEMENT_STATUSES].map((status, index) => ({
    id: `statement-${status}`, ownerIdentityId: 'owner-a', status,
    unit: { id: 'old-unit', name: 'Old home', projectId: 'project-a', status: 'offboarded', ownerIdentityId: 'new-owner' },
    periodStart: date, periodEnd: date, createdAt: date, publishedAt: status === 'draft' ? null : date,
    noiTh: 100001 + index, ownerShareTh: 80001 + index, ledgerEntries: [],
  }));
  state.rows.push({ ...state.rows[1], id: 'foreign-statement', ownerIdentityId: 'owner-b' });
});

describe('owner statement list confidentiality and historical entitlement', () => {
  it('excludes drafts and foreign owners while preserving all visible historical states', async () => {
    const response = await GET(new NextRequest('http://localhost/api/owner/statements'));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.count).toBe(5);
    expect(result.statements.map((row: any) => row.id)).toEqual(OWNER_VISIBLE_STATEMENT_STATUSES.map(status => `statement-${status}`));
    expect(result.statements[0].noiTh).toBe(100002);
    expect(JSON.stringify(result)).not.toContain('statement-draft');
    expect(JSON.stringify(result)).not.toContain('foreign-statement');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      ownerIdentityId: 'owner-a', status: { in: OWNER_VISIBLE_STATEMENT_STATUSES },
    } }));
    expect(track).toHaveBeenCalledTimes(5);
    expect(track.mock.calls.some((call: any) => call[2]?.statementId === 'statement-draft')).toBe(false);
  });
  it('does not disclose unpublished totals on a currently live owned unit', async () => {
    for (const row of state.rows) row.unit.status = 'live';
    const response = await GET(new NextRequest('http://localhost/api/owner/statements'));
    const result = await response.json();
    expect(result.count).toBe(5);
    expect(result.statements.some((row: any) => row.status === 'draft')).toBe(false);
    expect(result.statements.some((row: any) => row.noiTh === 100001)).toBe(false);
  });
  it('returns an empty beneficiary-scoped list for an authenticated nonowner', async () => {
    state.user = { identityId: 'never-owner' };
    const response = await GET(new NextRequest('http://localhost/api/owner/statements'));
    expect(await response.json()).toEqual({ success: true, statements: [], count: 0 });
    expect(track).not.toHaveBeenCalled();
  });
  it('requires authentication before reading or tracking statements', async () => {
    state.user = null;
    expect((await GET(new NextRequest('http://localhost/api/owner/statements'))).status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });
});
