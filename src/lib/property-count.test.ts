import { describe, expect, it } from 'vitest';
import { formatPropertyCount } from './property-count';
describe('shared localized property count labels', () => {
  it.each([[0,'спален'],[1,'спальня'],[2,'спальни'],[4,'спальни'],[5,'спален'],[11,'спален'],[12,'спален'],[14,'спален'],[21,'спальня'],[22,'спальни'],[25,'спален'],[101,'спальня'],[111,'спален'],[1.5,'спальни']] as const)('uses Russian bedroom grammar for %s', (count, noun) => {
    expect(formatPropertyCount('{count} спален', count, 'ru')).toBe(`${count} ${noun}`);
    expect(formatPropertyCount('{count} спальни', count, 'ru-RU')).toBe(`${count} ${noun}`);
  });
  it('preserves prefix, suffix and labels before the count', () => {
    expect(formatPropertyCount('Вместимость: {count} гостей · вилла', 2, 'ru')).toBe('Вместимость: 2 гостя · вилла');
    expect(formatPropertyCount('Гостей: {count}', 1, 'ru')).toBe('Гостей: 1');
    expect(formatPropertyCount('{count} ванных', 1, 'ru')).toBe('1 ванная');
    expect(formatPropertyCount('От {count} ночей', 1, 'ru')).toBe('От 1 ночи');
    expect(formatPropertyCount('От {count} ночей', 2, 'ru')).toBe('От 2 ночей');
    expect(formatPropertyCount('{count} ночей', 1, 'ru')).toBe('1 ночь');
  });
  it.each([['en','{count} bedrooms'],['th','{count} ห้องนอน'],['zh','{count} 间卧室']])('preserves supplied %s copy', (locale, template) => {
    expect(formatPropertyCount(template, 2, locale)).toBe(template.replace('{count}', '2'));
  });
  it('does not rewrite custom editorial copy without recognized count nouns', () => {
    expect(formatPropertyCount('Комнат: {count}', 1, 'ru')).toBe('Комнат: 1');
  });
});

 describe('case-aware property counts', () => {
  it.each([[1, 'гостя'], [2, 'гостей'], [5, 'гостей'], [11, 'гостей'], [21, 'гостя']] as const)('keeps до genitive for %s', (count, noun) => {
    expect(formatPropertyCount('до {count} гостей', count, 'ru')).toBe(`до ${count} ${noun}`);
  });
  it.each([[1, 'объект'], [2, 'объекта'], [5, 'объектов'], [11, 'объектов'], [21, 'объект']] as const)('inflects %s properties', (count, noun) => {
    expect(formatPropertyCount('{count} объектов', count, 'ru')).toBe(`${count} ${noun}`);
  });
  it('preserves neutral labels and abbreviations', () => {
    for (const template of ['Гостей: {count}', 'Максимум гостей: {count}', 'Спален: {count}', '{count} сп.', '{count} ванн.'])
      expect(formatPropertyCount(template, 1, 'ru')).toBe(template.replace('{count}', '1'));
  });
});
