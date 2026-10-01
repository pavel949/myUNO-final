import Link from 'next/link';
import { LocaleSwitcher } from './LocaleSwitcher';

export interface FooterLabels {
  brandName: string;
  brandTagline: string;
  brandColumn: string;
  home: string;
  stay: string;
  monthly: string;
  buy: string;
  sell: string;
  areas: string;
  projects: string;
  services: string;
  trust: string;
  about: string;
  help: string;
  global: string;
  ombudsman: string;
  audienceColumn: string;
  owners: string;
  guests: string;
  providers: string;
  partnersColumn: string;
  developers: string;
  buyers: string;
  management: string;
  legalColumn: string;
  terms: string;
  privacy: string;
  legalIndex: string;
  language: string;
  companyLine: string;
  copyright: string;
}

interface FooterProps {
  labels: FooterLabels;
  locale: string;
  localeOptions: { en: string; ru: string; th: string; zh: string };
}

export function Footer({ labels, locale, localeOptions }: FooterProps) {
  const columns = [
    {
      title: labels.brandColumn,
      links: [
        { href: '/', label: labels.home },
        { href: '/search', label: labels.stay },
        { href: '/homes?intent=rent', label: labels.monthly },
        { href: '/homes?intent=buy', label: labels.buy },
        { href: '/sell', label: labels.sell },
        { href: '/areas', label: labels.areas },
        { href: '/projects', label: labels.projects },
        { href: '/services', label: labels.services },
      ],
    },
    {
      title: labels.audienceColumn,
      links: [
        { href: '/owners', label: labels.owners },
        { href: '/guests', label: labels.guests },
        { href: '/providers', label: labels.providers },
        { href: '/trust', label: labels.trust },
        { href: '/about', label: labels.about },
        { href: '/help', label: labels.help },
        { href: '/desks', label: labels.global },
      ],
    },
    {
      title: labels.partnersColumn,
      links: [
        { href: '/developers', label: labels.developers },
        { href: '/buyers', label: labels.buyers },
        { href: '/management-companies', label: labels.management },
        { href: '/trust/ombudsman', label: labels.ombudsman },
      ],
    },
    {
      title: labels.legalColumn,
      links: [
        { href: '/legal', label: labels.legalIndex },
        { href: '/legal/terms', label: labels.terms },
        { href: '/legal/privacy', label: labels.privacy },
      ],
    },
  ];

  return (
    <footer className="bg-text-ink px-20 py-48 text-surface-ivory md:px-32 md:py-64">
      <div className="mx-auto max-w-7xl">
        <div className="mb-48 flex flex-col justify-between gap-24 border-b border-surface-ivory/15 pb-32 md:flex-row md:items-end">
          <div>
            <p className="font-display text-display font-semibold tracking-[-0.02em]">{labels.brandName}</p>
            <p className="mt-8 max-w-md text-small text-surface-ivory/60">
              {labels.brandTagline}
            </p>
          </div>
          <LocaleSwitcher
            locale={locale}
            ariaLabel={labels.language}
            optionLabels={localeOptions}
            variant="onDark"
          />
        </div>

        <div className="mb-48 grid grid-cols-2 gap-x-24 gap-y-40 md:grid-cols-4">
          {columns.map((column) => (
            <div key={column.title}>
              <p className="mb-16 text-small font-semibold text-surface-ivory">{column.title}</p>
              <ul className="space-y-10 text-small text-surface-ivory/70">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="transition-colors duration-micro hover:text-surface-ivory">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-8 border-t border-surface-ivory/15 pt-24 md:flex-row md:items-end md:justify-between">
          <p className="max-w-3xl text-small text-surface-ivory/50">{labels.companyLine}</p>
          <p className="shrink-0 text-small text-surface-ivory/50">{labels.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
