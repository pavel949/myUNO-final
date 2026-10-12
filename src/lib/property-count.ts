/** Inflect known count nouns in the supplied localized label, preserving its
 * surrounding editorial copy. Non-Russian labels and label-before-count forms
 * (for example "Гостей: {count}") stay untouched apart from interpolation. */
export function formatPropertyCount(template: string, count: number, locale: string): string {
  let value = template;
  if (locale.split('-')[0].toLowerCase() === 'ru') {
    const category = new Intl.PluralRules('ru').select(count);
    const pick = (one: string, few: string, many: string, other = few) =>
      category === 'one' ? one : category === 'few' ? few : category === 'many' ? many : other;
    value = value.replace(/(\{count\}\s+)(спальня|спальни|спален)(?=$|\s|[.,·])/g,
      (_match, prefix: string) => prefix + pick('спальня', 'спальни', 'спален'));
    value = value.replace(/(\{count\}\s+)(ванная|ванные|ванных)(?=$|\s|[.,·])/g,
      (_match, prefix: string) => prefix + pick('ванная', 'ванные', 'ванных', 'ванной'));
    value = value.replace(/(\{count\}\s+)(гость|гостя|гостей)(?=$|\s|[.,·])/g,
      (_match, prefix: string) => prefix + pick('гость', 'гостя', 'гостей'));
    // "От" requires the genitive, unlike a standalone "1 ночь" badge.
    const from = /(?:^|\s)[Оо]т\s+\{count\}/.test(value);
    value = value.replace(/(\{count\}\s+)(ночь|ночи|ночей)(?=$|\s|[.,·])/g,
      (_match, prefix: string) => prefix + (from ? pick('ночи', 'ночей', 'ночей', 'ночи') : pick('ночь', 'ночи', 'ночей')));
  }
  return value.replace(/\{count\}/g, String(count));
}
