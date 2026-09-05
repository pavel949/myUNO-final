import Link from 'next/link';
import { LocaleSwitcher } from './LocaleSwitcher';

export interface FooterLabels {
  brandColumn: string;
  home: string;
  residences: string;
  services: string;
  search: string;
  trust: string;
  about: string;
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
        { href: '/search', label: labels.search },
        { href: '/projects', label: labels.residences },
        { href: '/services', label: labels.services },
        { href: '/trust', label: labels.trust },
        { href: '/trust/ombudsman', label: labels.ombudsman },
        { href: '/about', label: labels.about },
      ],
    },
    {
      title: labels.audienceColumn,
      links: [
        { href: '/owners', label: labels.owners },
        { href: '/guests', label: labels.guests },
        { href: '/providers', label: labels.providers },
      ],
    },
    {
      title: labels.partnersColumn,
      links: [
        { href: '/developers', label: labels.developers },
        { href: '/buyers', label: labels.buyers },
        { href: '/management-companies', label: labels.management },
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
    <footer className="bg-text-ink text-surface-ivory py-40 px-24">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-40 mb-40">
          {columns.map((column) => (
            <div key={column.title}>
              <p className="font-bold mb-12">{column.title}</p>
              <ul className="space-y-8 text-small">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="hover:underline">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-16 border-t border-surface-ivory/20 pt-32">
          <div>
            <p className="text-small text-surface-ivory/60 mb-12">{labels.companyLine}</p>
            <p className="text-small text-surface-ivory/60">{labels.copyright}</p>
          </div>
          <LocaleSwitcher
            locale={locale}
            ariaLabel={labels.language}
            optionLabels={localeOptions}
            variant="onDark"
          />
        </div>
      </div>
    </footer>
  );
}
