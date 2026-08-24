import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { resetDb, createProject, createUnit } from '@/test/util';

vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: async () => null,
}));

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { GET } from './route';

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/units/x');
}

describe('GET /api/units/[unitId] — satang-to-baht display boundary (Q47)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('converts baseNightlyThb to baht for the guest-facing unit page', async () => {
    const project = await createProject({ status: 'live' });
    // 500000 satang stored — the guest must see ฿5,000/night, not ฿500,000.
    const unit = await createUnit({
      projectId: project.id,
      status: 'live',
      baseNightlyThb: 500000,
    });

    const response = await GET(makeRequest(), { params: { unitId: unit.id } });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.baseNightlyThb).toBe(5000);
  });
});
