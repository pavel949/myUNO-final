import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { getLabels } from '@/lib/i18n';
import { clearTranslationCache } from './content.service';
import { PROPERTY_CATEGORY_UI_DRAFTS } from './property-category-ui-drafts';
import { CONSOLIDATED_RELEASE_KEYS } from './consolidated-release.seed';
import ProjectCategoryPage from '@/app/(public)/projects/[slug]/categories/[categoryKey]/page';

const state = vi.hoisted(() => ({ locale: 'ru', query: vi.fn(), bookable: false }));
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: state.query } }));
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => ({ value: state.locale }) }) }));
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => createElement('img', { src, alt }) }));
vi.mock('@/modules/projects', () => ({
  getPublicProjectBySlug: async () => ({
    id: 'project-1', slug: 'example', name: 'Original Project',
    categories: [{ id: 'category-1', key: 'category', name: 'Original Category', titleKey: 'category.title', descriptionKey: 'category.description', bedrooms: 3, unitCount: 5, fromNightlyThb: null, galleryUrls: ['/category.jpg'] }],
    units: [{ id: 'unit-1', categoryKey: 'category', name: 'Original Home', bookable: state.bookable, titleKey: 'unit.title', descriptionKey: 'unit.description', views: [], unitFeatures: [], coverUrl: '/home.jpg', photoScope: 'room_type', maxGuests: 6, grossAreaSqm: 100, sizeSqm: 100 }],
  }),
}));

beforeEach(() => {
  clearTranslationCache();
  state.locale = 'ru';
  state.bookable = false;
  state.query.mockReset().mockResolvedValue([]);
});

const defaults = Object.fromEntries(Object.entries(PROPERTY_CATEGORY_UI_DRAFTS).map(([key, row]) => [key, row.en]));
const placeholders = (value: string) => value.match(/\{[a-zA-Z_]+\}/g)?.sort() || [];
const renderPage = async () => renderToStaticMarkup(await ProjectCategoryPage({ params: { slug: 'example', categoryKey: 'category' } }));

describe('category UI registered locale drafts', () => {
  it('covers only static registered copy with matching RU/EN placeholders', () => {
    for (const [key, row] of Object.entries(PROPERTY_CATEGORY_UI_DRAFTS)) {
      expect(key.startsWith('project_category.')).toBe(true);
      expect(row.ru).toMatch(/[А-Яа-яЁё]/);
      expect(placeholders(row.ru)).toEqual(placeholders(row.en));
    }
    for (const row of CONSOLIDATED_RELEASE_KEYS.filter(row => row.key.startsWith('project_category.'))) {
      expect(row.status).toBe('needs_review');
      expect(PROPERTY_CATEGORY_UI_DRAFTS[row.key].ru).toBe(row.ru);
    }
    const seed = readFileSync('src/modules/content/seed.ts', 'utf8');
    const media = PROPERTY_CATEGORY_UI_DRAFTS['project_category.representative_media'];
    expect(seed).toContain(`en: '${media.en}', ru: '${media.ru}'`);
  });

  it('preserves the existing discovery copy resolver without duplicate category registration', () => {
    const page = readFileSync('src/app/(public)/projects/[slug]/categories/[categoryKey]/page.tsx', 'utf8');
    expect(page).toContain('const discovery = await discoveryCopy(locale);');
    expect(page).toContain('{discovery.open} →');
    expect(page).not.toContain("'discovery.open':");
    expect(Object.keys(PROPERTY_CATEGORY_UI_DRAFTS)).not.toContain('discovery.open');
  });

  it.each([0, 1, 2, 5, 11, 21, 22, 25])('uses count-neutral wording for %i without incorrect plurals', async count => {
    const ru = await getLabels(defaults, 'ru', PROPERTY_CATEGORY_UI_DRAFTS);
    const en = await getLabels(defaults, 'en', PROPERTY_CATEGORY_UI_DRAFTS);
    expect(ru['project_category.bedrooms'].replace('{count}', String(count))).toBe(`Спален: ${count}`);
    expect(ru['project_category.available'].replace('{count}', String(count))).toBe(`Объектов в категории: ${count}`);
    expect(ru['project_category.guests'].replace('{count}', String(count))).toBe(`Максимум гостей: ${count}`);
    expect(en['project_category.bedrooms'].replace('{count}', String(count))).toBe(`Bedrooms: ${count}`);
    expect(en['project_category.available'].replace('{count}', String(count))).toBe(`Homes in this category: ${count}`);
    expect(en['project_category.guests'].replace('{count}', String(count))).toBe(`Maximum guests: ${count}`);
  });

  it('prefers RU drafts to EN-only CMS rows, including warm-cache resolution', async () => {
    state.query.mockResolvedValue(Object.entries(defaults).map(([key, value]) => ({ key, locale: 'en', value })));
    await getLabels(defaults, 'en', PROPERTY_CATEGORY_UI_DRAFTS);
    const labels = await getLabels(defaults, 'ru', PROPERTY_CATEGORY_UI_DRAFTS);
    for (const [key, row] of Object.entries(PROPERTY_CATEGORY_UI_DRAFTS)) expect(labels[key]).toBe(row.ru);
  });

  it('preserves selected-locale CMS copy, including intentionally Latin RU copy', async () => {
    state.query.mockResolvedValue([
      { key: 'project_category.back', locale: 'ru', value: 'myUNO Editorial Navigation' },
      { key: 'project_category.back', locale: 'en', value: 'Custom return label' },
    ]);
    expect((await getLabels(defaults, 'ru', PROPERTY_CATEGORY_UI_DRAFTS))['project_category.back']).toBe('myUNO Editorial Navigation');
    expect((await getLabels(defaults, 'en', PROPERTY_CATEGORY_UI_DRAFTS))['project_category.back']).toBe('Custom return label');
  });

  it('retains registered RU/EN defaults when the label store is unreachable', async () => {
    state.query.mockRejectedValue(new Error('unreachable'));
    for (const locale of ['ru', 'en'] as const) {
      const labels = await getLabels(defaults, locale, PROPERTY_CATEGORY_UI_DRAFTS);
      for (const [key, row] of Object.entries(PROPERTY_CATEGORY_UI_DRAFTS)) expect(labels[key]).toBe(row[locale]);
    }
  });

  it('renders RU functional copy, honest inquiry/media notices, and original accessible names', async () => {
    state.query.mockResolvedValue([
      { key: 'category.description', locale: 'ru', value: 'Оригинальное описание категории' },
      { key: 'unit.description', locale: 'ru', value: 'Оригинальное описание объекта' },
    ]);
    const html = await renderPage();
    for (const text of ['Назад к комплексу', 'Спален: 3', 'Объектов в категории: 5', 'Узнать об этом доме', 'Фотографии категории', 'Объекты в этой категории', 'Максимум гостей: 6', 'Представительные фото типа номера', 'Точные фотографии и условия онлайн-бронирования ещё уточняются.', 'Смотреть объект', 'Оригинальное описание категории', 'Оригинальное описание объекта']) expect(html).toContain(text);
    expect(html).toContain('alt="Original Category"');
    expect(html).toContain('alt="Original Home"');
    expect(html).toContain('/projects/example#lead-form');
    expect(html).not.toContain('Проверить доступность');
    expect(html).not.toContain('Back to project');
    expect(html).not.toContain('฿');
  });

  it('keeps EN navigation and the existing bookable-only availability path', async () => {
    state.locale = 'en';
    state.bookable = true;
    const html = await renderPage();
    for (const text of ['Back to project', 'Bedrooms: 3', 'Homes in this category: 5', 'Category gallery', 'Maximum guests: 6', 'Representative room-type photos', 'View home', 'Check availability']) expect(html).toContain(text);
    expect(html).toContain('/search?');
    expect(html).not.toContain('/projects/example#lead-form');
    expect(html).not.toContain('Exact photos or online booking terms are still being completed.');
  });
});
