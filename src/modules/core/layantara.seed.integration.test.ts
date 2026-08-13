import { describe, it, expect, beforeEach } from 'vitest';
import { db as prisma, resetDb, createIdentity } from '@/test/util';
import { seedLayantara, LAYANTARA_CATEGORIES } from './layantara.seed';
import { computePriceBreakdown } from './availability.service';

describe('seedLayantara (LY-4)', () => {
  beforeEach(async () => {
    await resetDb();
    await createIdentity({ isAdmin: true });
  });

  it('seeds the project, all 39 villas with correct category counts, and the concierge', async () => {
    await seedLayantara(prisma);

    const project = await prisma.project.findUnique({ where: { slug: 'layantara' } });
    expect(project).not.toBeNull();
    expect(project!.status).toBe('live');

    const counts = await prisma.unit.groupBy({
      by: ['categoryKey'],
      where: { projectId: project!.id },
      _count: true,
    });
    const byCategory = Object.fromEntries(counts.map((c) => [c.categoryKey, c._count]));
    expect(byCategory).toEqual({
      standard_2br: 2,
      standard_3br: 5,
      superior_2br: 21,
      superior_3br: 3,
      grand_deluxe_3br: 8,
    });

    const units = await prisma.unit.findMany({ where: { projectId: project!.id } });
    expect(units).toHaveLength(39);
    // Every villa: live, manager-confirmed bookings, licence gate satisfied
    expect(units.every((u) => u.status === 'live')).toBe(true);
    expect(units.every((u) => u.instantBook === false)).toBe(true);
    expect(units.every((u) => u.permittedUseConfirmedAt !== null)).toBe(true);

    const services = await prisma.service.findMany({
      where: { provider_id: 'layantara-concierge' },
    });
    expect(services).toHaveLength(5);
    expect(services.every((s) => s.priceModel === 'quote')).toBe(true);
  });

  it('is idempotent — a second run changes no counts', async () => {
    await seedLayantara(prisma);
    const before = {
      projects: await prisma.project.count(),
      units: await prisma.unit.count(),
      overrides: await prisma.configOverride.count(),
      keys: await prisma.contentKey.count(),
      translations: await prisma.translation.count(),
      services: await prisma.service.count(),
    };

    await seedLayantara(prisma);
    const after = {
      projects: await prisma.project.count(),
      units: await prisma.unit.count(),
      overrides: await prisma.configOverride.count(),
      keys: await prisma.contentKey.count(),
      translations: await prisma.translation.count(),
      services: await prisma.service.count(),
    };

    expect(after).toEqual(before);
  });

  it('hides the demo showcase project from the public catalog', async () => {
    await prisma.project.create({
      data: {
        slug: 'ignatev-showcase',
        name: 'Ignatev Estate',
        areaLabelKey: 'project.ignatev.location',
        descriptionKey: 'project.ignatev.description',
        latitude: 8.6883,
        longitude: 98.3997,
        address: 'Phuket',
        handbookKey: 'project.ignatev.handbook',
        status: 'live',
      },
    });

    await seedLayantara(prisma);

    const showcase = await prisma.project.findUnique({ where: { slug: 'ignatev-showcase' } });
    expect(showcase!.status).toBe('draft');
  });

  it('prices a seeded Superior 2BR at the exact retail grid figure on a peak date', async () => {
    await seedLayantara(prisma);
    const project = await prisma.project.findUnique({ where: { slug: 'layantara' } });
    const unit = await prisma.unit.findFirst({
      where: { projectId: project!.id, categoryKey: 'superior_2br' },
    });

    const breakdown = await computePriceBreakdown(
      prisma,
      unit!.id,
      new Date('2026-12-25'),
      new Date('2026-12-27'), // 2 peak nights (minNights = 2)
      2,
      new Date('2026-12-20') // no early-bird
    );

    expect(breakdown.lines.every((l) => l.applied_from === 'category_season')).toBe(true);
    expect(breakdown.lines.every((l) => l.nightly_thb === 1127200)).toBe(true);
    expect(breakdown.total_thb).toBe(2 * 1127200);
  });

  it('the category grid in code matches the brief counts (94 bedrooms total)', () => {
    // 2×2 + 5×3 + 21×2 + 3×3 + 8×3 = 94 bedrooms across 39 villas
    const roster = [
      { count: 2, cat: 'standard_2br' },
      { count: 5, cat: 'standard_3br' },
      { count: 21, cat: 'superior_2br' },
      { count: 3, cat: 'superior_3br' },
      { count: 8, cat: 'grand_deluxe_3br' },
    ];
    const bedrooms = roster.reduce((sum, r) => {
      const spec = LAYANTARA_CATEGORIES.find((c) => c.key === r.cat)!;
      return sum + r.count * spec.bedrooms;
    }, 0);
    expect(bedrooms).toBe(94);
    expect(roster.reduce((s, r) => s + r.count, 0)).toBe(39);
  });
});
