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
