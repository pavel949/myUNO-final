import type { Metadata } from 'next';
// Self-hosted variable cuts (OFL). next/font/google fetches CSS from Google at
// compile time; GitHub Actions then crashed when a font URL had no extension
// (`Cannot read properties of null (reading '1')` in the Google loader).
import '@fontsource-variable/outfit/wght.css';
import '@fontsource-variable/manrope/wght.css';
import '@fontsource-variable/noto-sans-thai/wght.css';
import './globals.css';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { siteUrl } from '@/lib/seo';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { availableSurfaces, type Landing } from '@/modules/core';
import { getActiveStayId } from '@/app/actions/getActiveStay';
import type { RoleType } from '@prisma/client';
import { getDestination } from '@/modules/destinations';

const SURFACE_LABEL_KEYS = {
  active_stay: 'nav.stay',
  admin: 'nav.admin',
  staff: 'nav.ops',
  management_company: 'nav.mc_portal',
  juristic: 'nav.juristic_portal',
  provider: 'nav.provider_portal',
  owner: 'nav.owner_dashboard',
  resident: 'nav.residence',
  buyer: 'nav.buying',
  guest: 'nav.my_trips',
  public: 'nav.find_stay',
} as const satisfies Record<Landing['reason'], string>;

const destination = getDestination();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: 'myUNO',
  description: `Stay, buy, own and access trusted local services in ${destination.name} through one connected property network.`,
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const locale = getRequestLocale();

  const navLabels = await getLabels({
    'nav.find_stay': 'Stay',
    'nav.monthly': 'Monthly',
    'nav.buy': 'Buy',
    'nav.homes': 'Homes',
    'nav.sell': 'Sell',
    'nav.list_property': locale === 'ru' ? 'Разместить объект' : locale === 'th' ? 'ลงประกาศที่พัก' : 'List your property',
    'nav.request_management': locale === 'ru' ? 'Передать в управление' : locale === 'th' ? 'ให้ myUNO จัดการ' : 'Property management',
    'nav.explore': 'Explore',
    'nav.areas': 'Areas',
    'nav.projects': 'Projects',
    'nav.services': 'Services',
    'nav.owners': 'Own',
    'nav.partners': 'Partners',
    'nav.about': 'About',
    'nav.language': 'Language',
    'nav.locale.en': 'EN',
    'nav.locale.ru': 'RU',
    'nav.locale.th': 'TH',
    'nav.locale.zh': '中文',
    'nav.trust': 'Trust',
    'nav.help': 'Help',
    'nav.global': 'Global',
    'nav.login': 'Log in',
    'nav.register': 'Sign up',
    'nav.logout': 'Log out',
    'nav.my_trips': 'My trips',
    'nav.saved': 'Saved',
    'nav.my_listings': locale === 'ru' ? 'Мои объявления' : locale === 'th' ? 'ประกาศของฉัน' : 'My listings',
    'nav.developers': 'Developers',
    'nav.buyers': 'Buyers',
    'nav.management': 'Management',
    'nav.messages': 'Messages',
    'nav.tickets': 'My requests',
    'nav.orders': 'My orders',
    'nav.stay': 'My stay',
    'nav.residence': 'My residence',
    'nav.juristic_portal': 'Juristic portal',
    'nav.buying': 'Buying',
    'nav.bell_aria': 'Notifications',
    'nav.bell_empty': 'No notifications yet.',
    'nav.bell_mark_all': 'Mark all read',
    'nav.owner_dashboard': 'Owner dashboard',
    'nav.provider_portal': 'Provider portal',
    'nav.mc_portal': 'MC portal',
    'nav.ops': 'Ops',
    'nav.admin': 'Admin',
    'nav.account': 'Account',
    'nav.menu': 'Menu',
    'nav.more': 'More',
    'nav.my_uno': 'My UNO',
  });

  const activeBookingId = user ? await getActiveStayId() : null;
  const roleLinks = user
    ? availableSurfaces({
        isAdmin: user.isAdmin,
        roles: user.roles.map((r) => r.role as RoleType),
        activeBookingId,
      })
        .filter((surface) => surface.path !== '/trips')
        .map((surface) => ({
          href: surface.path,
          label: navLabels[SURFACE_LABEL_KEYS[surface.reason]],
        }))
    : [];

  const footerLabels = await getLabels({
    'nav.footer.brand_name': 'myUNO',
    'nav.footer.brand_tagline': `Property, stays and services connected across ${destination.name}.`,
    'nav.footer.brand_column': 'Explore',
    'nav.footer.home': 'Home',
    'nav.footer.stay': 'Stay',
    'nav.footer.monthly': 'Monthly',
    'nav.footer.buy': 'Buy',
    'nav.footer.sell': 'Sell',
    'nav.footer.list_property': locale === 'ru' ? 'Разместить объект' : locale === 'th' ? 'ลงประกาศที่พัก' : 'List your property',
    'nav.footer.request_management': locale === 'ru' ? 'Передать в управление' : locale === 'th' ? 'ให้ myUNO จัดการ' : 'Property management',
    'nav.footer.areas': 'Areas',
    'nav.footer.projects': 'Projects',
    'nav.footer.services': 'Services',
    'nav.footer.trust': 'Trust',
    'nav.footer.about': 'About',
    'nav.footer.help': 'Help Center',
    'nav.footer.global': 'Global desks',
    'nav.footer.research': 'Research',
    'nav.footer.videos': 'Videos',
    'nav.footer.ombudsman': 'Ombudsman',
    'nav.footer.legal_index': 'Legal',
    'nav.language': 'Language',
    'nav.footer.audience_column': 'Property',
    'nav.footer.owners': 'Own',
    'nav.footer.guests': 'Guests',
    'nav.footer.providers': 'Providers',
    'nav.footer.partners_column': 'Partners',
    'nav.footer.developers': 'Developers',
    'nav.footer.buyers': 'Buyers',
    'nav.footer.management': 'Management',
    'nav.footer.legal_column': 'Legal',
    'nav.footer.terms': 'Terms',
    'nav.footer.privacy': 'Privacy',
    'nav.footer.company_line':
      'Ignatev Estate Co., Ltd · DBD 083-5-56602358-7 · Pavel Ignatev · pavel@ignatevestate.com',
    'nav.footer.copyright': '© 2026 myUNO. All rights reserved.',
  });

  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col">
        <Navbar
          user={
            user
              ? {
                  firstName: user.firstName,
                  isAdmin: user.isAdmin,
                  roles: Array.from(new Set(user.roles.map((r) => r.role))),
                }
              : null
          }
          labels={{
            stay: navLabels['nav.find_stay'],
            monthly: navLabels['nav.monthly'],
            buy: navLabels['nav.buy'],
            homes: navLabels['nav.homes'],
            sell: navLabels['nav.sell'],
            rentOut: navLabels['nav.list_property'],
            manage: navLabels['nav.request_management'],
            explore: navLabels['nav.explore'],
            areas: navLabels['nav.areas'],
            projects: navLabels['nav.projects'],
            services: navLabels['nav.services'],
            owners: navLabels['nav.owners'],
            partners: navLabels['nav.partners'],
            about: navLabels['nav.about'],
            trust: navLabels['nav.trust'],
            help: navLabels['nav.help'],
            global: navLabels['nav.global'],
            language: navLabels['nav.language'],
            login: navLabels['nav.login'],
            register: navLabels['nav.register'],
            logout: navLabels['nav.logout'],
            myTrips: navLabels['nav.my_trips'],
            saved: navLabels['nav.saved'],
            addProperty: navLabels['nav.my_listings'],
            developers: navLabels['nav.developers'],
            buyers: navLabels['nav.buyers'],
            management: navLabels['nav.management'],
            messages: navLabels['nav.messages'],
            tickets: navLabels['nav.tickets'],
            orders: navLabels['nav.orders'],
            account: navLabels['nav.account'],
            menu: navLabels['nav.menu'],
            more: navLabels['nav.more'],
            myUno: navLabels['nav.my_uno'],
          }}
          roleLinks={roleLinks}
          bellLabels={{
            aria: navLabels['nav.bell_aria'],
            empty: navLabels['nav.bell_empty'],
            markAll: navLabels['nav.bell_mark_all'],
          }}
          locale={locale}
          localeOptions={{
            en: navLabels['nav.locale.en'],
            ru: navLabels['nav.locale.ru'],
            th: navLabels['nav.locale.th'],
            zh: navLabels['nav.locale.zh'],
          }}
        />

        <div className="flex-1">{children}</div>

        <Footer
          locale={locale}
          labels={{
            brandName: footerLabels['nav.footer.brand_name'],
            brandTagline: footerLabels['nav.footer.brand_tagline'],
            brandColumn: footerLabels['nav.footer.brand_column'],
            home: footerLabels['nav.footer.home'],
            stay: footerLabels['nav.footer.stay'],
            monthly: footerLabels['nav.footer.monthly'],
            buy: footerLabels['nav.footer.buy'],
            sell: footerLabels['nav.footer.sell'],
            rentOut: footerLabels['nav.footer.list_property'],
            manage: footerLabels['nav.footer.request_management'],
            areas: footerLabels['nav.footer.areas'],
            projects: footerLabels['nav.footer.projects'],
            services: footerLabels['nav.footer.services'],
            trust: footerLabels['nav.footer.trust'],
            about: footerLabels['nav.footer.about'],
            help: footerLabels['nav.footer.help'],
            global: footerLabels['nav.footer.global'],
            research: footerLabels['nav.footer.research'],
            videos: footerLabels['nav.footer.videos'],
            ombudsman: footerLabels['nav.footer.ombudsman'],
            audienceColumn: footerLabels['nav.footer.audience_column'],
            owners: footerLabels['nav.footer.owners'],
            guests: footerLabels['nav.footer.guests'],
            providers: footerLabels['nav.footer.providers'],
            partnersColumn: footerLabels['nav.footer.partners_column'],
            developers: footerLabels['nav.footer.developers'],
            buyers: footerLabels['nav.footer.buyers'],
            management: footerLabels['nav.footer.management'],
            legalColumn: footerLabels['nav.footer.legal_column'],
            terms: footerLabels['nav.footer.terms'],
            privacy: footerLabels['nav.footer.privacy'],
            legalIndex: footerLabels['nav.footer.legal_index'],
            language: navLabels['nav.language'],
            companyLine: footerLabels['nav.footer.company_line'],
            copyright: footerLabels['nav.footer.copyright'],
          }}
          localeOptions={{
            en: navLabels['nav.locale.en'],
            ru: navLabels['nav.locale.ru'],
            th: navLabels['nav.locale.th'],
            zh: navLabels['nav.locale.zh'],
          }}
        />
      </body>
    </html>
  );
}
