import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { resetDb, createProject, createUnit } from '@/test/util';

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { POST } from './route';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/pricing/breakdown', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/pricing/breakdown — satang-to-baht display boundary (Q47)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('quotes the guest in baht, not the satang the engine computes internally', async () => {
    const project = await createProject();
    // 1000 satang/night stored — the quote for 3 nights must read ฿30, not ฿3000.
    const unit = await createUnit({
      projectId: project.id,
      baseNightlyThb: 1000,
      minNights: 1,
      maxGuests: 2,
    });

    const response = await POST(
      makeRequest({
        unitId: unit.id,
        startDate: '2025-01-15',
        endDate: '2025-01-18',
        guestCount: 2,
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.nights).toBe(3);
    expect(data.subtotal).toBe(30); // 3 nights x 1000 satang = 3000 satang = ฿30
    expect(data.total).toBe(30);
    expect(data.nightlyRate).toBe(10);
    expect(data.lines).toHaveLength(3);
    expect(data.lines[0].nightly_thb).toBe(10);
  });
});
