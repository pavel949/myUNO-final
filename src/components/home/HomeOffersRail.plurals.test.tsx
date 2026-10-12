import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HomeIntentProvider } from './HomeIntentProvider';
import { HomeOffersRail, type HomeOfferItem, type HomeOffersLabels } from './HomeOffersRail';

const modes = { stay: 'Проживание', monthly: 'Месяц', buy: 'Покупка' };
const labels: HomeOffersLabels = {
  tablist: 'Варианты', mode: modes, title: modes, body: modes, cta: modes,
  empty: 'Нет', bedrooms: 'спален', bathrooms: 'ванных', sqm: 'м²',
  guests: 'Гостей: {count}', open: 'Открыть', noPhoto: 'Фото готовятся',
};
describe('rendered home property card grammar', () => {
  it.each([[1, 'спальня', 'ванная'], [2, 'спальни', 'ванные'], [5, 'спален', 'ванных']] as const)(
    'renders the Russian card for %s rooms with its factual price and link unchanged', (count, bedroom, bathroom) => {
      const item: HomeOfferItem = {
        key: 'unit:synthetic', intent: 'stay', name: 'Синтетическая вилла',
        projectName: 'Тестовый проект', projectId: 'synthetic', href: '/units/synthetic',
        imageSrc: '/placeholder.svg', imageIllustrative: true, bedrooms: count,
        bathrooms: count, guests: 2, priceMode: 'base_nightly', priceText: '1 000 ฿',
      };
      const html = renderToStaticMarkup(<HomeIntentProvider initialIntent="stay" locale="ru" destination="test"><HomeOffersRail items={[item]} labels={labels} /></HomeIntentProvider>);
      expect(html).toContain(`${count} ${bedroom} · ${count} ${bathroom}`);
      expect(html).toContain('Гостей: 2');
      expect(html).toContain('1 000 ฿');
      expect(html).toContain('href="/units/synthetic"');
    },
  );
});
