import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createProvider, createService, createProject } from '@/test/util';

vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: async () => null }));
vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { GET } from './route';

/**
 * Finding a service.
 *
 * The catalogue returned every active service, newest first, with no way to
 * search, filter by price or order the result — a list, not a marketplace.
 */
describe('GET /api/services — searching the catalogue', () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function vettedProvider() {
    const provider = await createProvider({ status: 'active' });
    await db.provider.update({ where: { id: provider.id }, data: { vetted_at: new Date() } });
    return provider;
  }

  async function service(opts: {
    providerId: string;
    titleEn: string;
    titleRu?: string;
    categoryKey?: string;
    basePriceThb?: number;
  }) {
    const created = await createService({
      providerId: opts.providerId,
      status: 'active',
      basePriceThb: opts.basePriceThb ?? 100_000,
    });
    await db.service.update({
      where: { id: created.id },
      data: {
        title: opts.titleEn,
        titleEn: opts.titleEn,
        titleRu: opts.titleRu ?? null,
        categoryKey: opts.categoryKey ?? 'cleaning',
      },
    });
    return created;
  }

  function call(query: string) {
    return GET(new NextRequest(`http://localhost/api/services?${query}`));
  }

  async function titlesOf(res: Response): Promise<string[]> {
    const body = await res.json();
    return body.services.map((s: { title: string }) => s.title);
  }

  it('finds a service by a word in its Russian title, not only the English one', async () => {
    // A Russian-speaking guest searching "уборка" must find the service whose
    // English title is "Cleaning". Asserted on the id, not the title: the
    // response returns whichever language the reader asked for, so matching on
    // a title would be testing the locale rather than the search.
    const provider = await vettedProvider();
    const cleaning = await service({
      providerId: provider.id,
      titleEn: 'Cleaning',
      titleRu: 'Уборка квартиры',
    });
    await service({ providerId: provider.id, titleEn: 'Airport transfer' });

    const res = await call(`q=${encodeURIComponent('уборка')}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.services.map((s: { id: string }) => s.id)).toEqual([cleaning.id]);
  });

  it('filters by category', async () => {
    const provider = await vettedProvider();
    await service({ providerId: provider.id, titleEn: 'Cleaning', categoryKey: 'cleaning' });
    await service({ providerId: provider.id, titleEn: 'Transfer', categoryKey: 'transfers' });

    expect(await titlesOf(await call('categoryKey=transfers'))).toEqual(['Transfer']);
  });

  it('filters on a price a person types in baht, not satang', async () => {
    // The param is named …Baht precisely so the two units cannot be confused:
    // ฿2,000 is 200,000 satang in the row.
    const provider = await vettedProvider();
    await service({ providerId: provider.id, titleEn: 'Cheap', basePriceThb: 100_000 });
    await service({ providerId: provider.id, titleEn: 'Dear', basePriceThb: 500_000 });

    expect(await titlesOf(await call('maxPriceBaht=2000'))).toEqual(['Cheap']);
    expect(await titlesOf(await call('minPriceBaht=2000'))).toEqual(['Dear']);
  });

  it('leaves a quote-priced service out of a price filter rather than treating it as free', async () => {
    const provider = await vettedProvider();
    const quoted = await createService({ providerId: provider.id, status: 'active', basePriceThb: 100 });
    await db.service.update({
      where: { id: quoted.id },
      data: { title: 'Quoted', priceModel: 'quote', basePriceThb: null },
    });
    await service({ providerId: provider.id, titleEn: 'Priced', basePriceThb: 100_000 });

    expect(await titlesOf(await call('maxPriceBaht=5000'))).toEqual(['Priced']);
    // With no price filter it is part of the catalogue as usual.
    expect((await titlesOf(await call(''))).sort()).toEqual(['Priced', 'Quoted']);
  });

  it('orders by price, cheapest first', async () => {
    const provider = await vettedProvider();
    await service({ providerId: provider.id, titleEn: 'Dear', basePriceThb: 500_000 });
    await service({ providerId: provider.id, titleEn: 'Cheap', basePriceThb: 100_000 });

    expect(await titlesOf(await call('sort=price_asc'))).toEqual(['Cheap', 'Dear']);
    expect(await titlesOf(await call('sort=price_desc'))).toEqual(['Dear', 'Cheap']);
  });

  it('falls back instead of failing on a sort it does not know', async () => {
    const provider = await vettedProvider();
    await service({ providerId: provider.id, titleEn: 'Cleaning' });

    const res = await call('sort=; drop table service');
    expect(res.status).toBe(200);
    expect((await res.json()).sort).toBe('recent');
  });

  it('reports a rating only where someone has reviewed, never zero', async () => {
    // A service nobody has reviewed is unknown, not bad. Reporting 0 would
    // bury every new provider beneath one grudging review.
    const provider = await vettedProvider();
    const project = await createProject();
    const reviewed = await service({ providerId: provider.id, titleEn: 'Reviewed' });
    await service({ providerId: provider.id, titleEn: 'Untouched' });

    const guest = await createIdentity();
    const order = await db.serviceOrder.create({
      data: {
        service_id: reviewed.id,
        provider_id: provider.id,
        project_id: project.id,
        orderer_identity_id: guest.id,
        orderer_role: 'guest',
        scheduled_start: new Date('2026-12-01T10:00:00.000Z'),
        scheduled_end: new Date('2026-12-01T11:00:00.000Z'),
        price_breakdown: {},
        total_thb: 100_000,
        take_rate_pct_snapshot: 15,
        status: 'fulfilled',
      },
    });
    await db.review.create({
      data: {
        target_type: 'service_order',
        target_id: order.id,
        author_identity_id: guest.id,
        rating: 4,
        status: 'published',
      },
    });

    const body = await (await call('')).json();
    const byTitle = Object.fromEntries(
      body.services.map((s: { title: string; averageRating: number | null }) => [
        s.title,
        s.averageRating,
      ])
    );
    expect(byTitle.Reviewed).toBe(4);
    expect(byTitle.Untouched).toBeNull();
  });
});
