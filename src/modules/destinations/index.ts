export interface DestinationDeskConfig {
  slug: string;
  code: string;
  marketCode: string;
  supportedLocales: readonly string[];
  defaultLocale: string;
  sourceMarkets: readonly string[];
  titleKey: string;
  bodyKey: string;
  languagesKey: string;
}

export interface DestinationConfig {
  key: string;
  slug: string;
  name: string;
  countryCode: string;
  currency: string;
  timezone: string;
  defaultLocale: string;
  supportedLocales: readonly string[];
  primaryCity: string;
  heroTitle: string;
  heroSubtitle: string;
  emergencyPhone: string;
  desks: readonly DestinationDeskConfig[];
}

const DESTINATIONS: Record<string, DestinationConfig> = {
  phuket: {
    key: 'phuket',
    slug: 'phuket',
    name: 'Phuket',
    countryCode: 'TH',
    currency: 'THB',
    timezone: 'Asia/Bangkok',
    defaultLocale: 'en',
    supportedLocales: ['en', 'ru', 'th', 'zh'],
    primaryCity: 'Phuket',
    heroTitle: 'Phuket, better connected.',
    heroSubtitle: 'Stay, buy, own and get trusted local services through one connected property network.',
    emergencyPhone: '191',
    desks: [
      { slug: 'thailand', code: 'TH', marketCode: 'TH', supportedLocales: ['th', 'en'], defaultLocale: 'th', sourceMarkets: ['Thailand'], titleKey: 'desks.thailand.title', bodyKey: 'desks.thailand.body', languagesKey: 'desks.thailand.languages' },
      { slug: 'russian-speaking', code: 'RU', marketCode: 'RU', supportedLocales: ['ru', 'en'], defaultLocale: 'ru', sourceMarkets: ['Russia', 'Kazakhstan', 'CIS', 'Russian-speaking world'], titleKey: 'desks.russian.title', bodyKey: 'desks.russian.body', languagesKey: 'desks.russian.languages' },
      { slug: 'greater-china', code: 'CN', marketCode: 'CN', supportedLocales: ['zh', 'en'], defaultLocale: 'zh', sourceMarkets: ['Mainland China', 'Hong Kong', 'Greater China'], titleKey: 'desks.china.title', bodyKey: 'desks.china.body', languagesKey: 'desks.china.languages' },
      { slug: 'middle-east', code: 'ME', marketCode: 'ME', supportedLocales: ['en'], defaultLocale: 'en', sourceMarkets: ['UAE', 'Saudi Arabia', 'Israel', 'Middle East'], titleKey: 'desks.middle_east.title', bodyKey: 'desks.middle_east.body', languagesKey: 'desks.middle_east.languages' },
      { slug: 'europe', code: 'EU', marketCode: 'EU', supportedLocales: ['en'], defaultLocale: 'en', sourceMarkets: ['United Kingdom', 'France', 'Germany', 'Europe'], titleKey: 'desks.europe.title', bodyKey: 'desks.europe.body', languagesKey: 'desks.europe.languages' },
    ],
  },
};

export function getDestination(key = process.env.NEXT_PUBLIC_MYUNO_DESTINATION || 'phuket'): DestinationConfig {
  return DESTINATIONS[key] ?? DESTINATIONS.phuket;
}

export function destinationPath(path: string, _destination = getDestination()): string {
  // Single-destination deployments preserve canonical URLs. Multi-destination
  // routing can prepend a destination slug without changing domain services.
  return path;
}

export function allDestinations(): DestinationConfig[] {
  return Object.values(DESTINATIONS);
}

export function getDestinationDesk(slug: string, destination = getDestination()): DestinationDeskConfig | null {
  return destination.desks.find((desk) => desk.slug === slug) ?? null;
}
