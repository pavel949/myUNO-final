export const GLOBAL_DESKS = [
  { slug: 'thailand', code: 'TH', titleKey: 'desks.thailand.title', bodyKey: 'desks.thailand.body', languagesKey: 'desks.thailand.languages' },
  { slug: 'russian-speaking', code: 'RU', titleKey: 'desks.russian.title', bodyKey: 'desks.russian.body', languagesKey: 'desks.russian.languages' },
  { slug: 'greater-china', code: 'CN', titleKey: 'desks.china.title', bodyKey: 'desks.china.body', languagesKey: 'desks.china.languages' },
  { slug: 'middle-east', code: 'ME', titleKey: 'desks.middle_east.title', bodyKey: 'desks.middle_east.body', languagesKey: 'desks.middle_east.languages' },
  { slug: 'europe', code: 'EU', titleKey: 'desks.europe.title', bodyKey: 'desks.europe.body', languagesKey: 'desks.europe.languages' },
] as const;

export type GlobalDeskSlug = (typeof GLOBAL_DESKS)[number]['slug'];

export function getGlobalDesk(slug: string) {
  return GLOBAL_DESKS.find((desk) => desk.slug === slug) ?? null;
}
