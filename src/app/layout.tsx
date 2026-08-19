import type { Metadata } from 'next';
import './globals.css';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { siteUrl } from '@/lib/seo';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { availableSurfaces, type Landing } from '@/modules/core';
import { getActiveStayId } from '@/app/actions/getActiveStay';
import type { RoleType } from '@prisma/client';

/** One content key per kind of surface, so the menu names match the landing. */
const SURFACE_LABEL_KEYS = {
  active_stay: 'nav.stay',
  admin: 'nav.admin',
  staff: 'nav.ops',
  management_company: 'nav.mc_portal',
  juristic: 'nav.juristic_portal',
  provider: 'nav.provider_portal',
  owner: 'nav.owner_dashboard',
  resident: 'nav.residence',
  public: 'nav.find_stay',
} as const satisfies Record<Landing['reason'], string>;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: 'myUNO',
  description: 'Operating platform for serviced living in Phuket',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const locale = getRequestLocale();

  const navLabels = await getLabels({
    'nav.find_stay': 'Find a stay',
    'nav.residences': 'Residences',
    'nav.services': 'Services',
    'nav.trust': 'Trust',
    'nav.login': 'Log in',
    'nav.register': 'Sign up',
    'nav.logout': 'Log out',
    'nav.my_trips': 'My trips',
    'nav.messages': 'Messages',
    'nav.tickets': 'My requests',
    'nav.orders': 'My orders',
    'nav.stay': 'My stay',
    'nav.residence': 'My residence',
    'nav.juristic_portal': 'Juristic portal',
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
  });

  // The surfaces this person's roles give them, from the same policy the `/app`
  // landing redirects on — so the menu can never offer a different set of hats
  // than the landing picks between.
  const activeBookingId = user ? await getActiveStayId(user.identityId) : null;
  const roleLinks = user
    ? availableSurfaces({
        isAdmin: user.isAdmin,
        roles: user.roles.map((r) => r.role as RoleType),
        activeBookingId,
      }).map((surface) => ({
        href: surface.path,
        label: navLabels[SURFACE_LABEL_KEYS[surface.reason]],
      }))
    : [];

  const footerLabels = await getLabels({
    'nav.footer.brand_column': 'myUNO',
    'nav.footer.home': 'Home',
    'nav.footer.residences': 'Residences',
    'nav.footer.trust': 'Trust',
    'nav.footer.audience_column': 'For Everyone',
    'nav.footer.owners': 'Owners',
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
      <body className="min-h-screen flex flex-col">
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
            findStay: navLabels['nav.find_stay'],
            residences: navLabels['nav.residences'],
            services: navLabels['nav.services'],
            trust: navLabels['nav.trust'],
            login: navLabels['nav.login'],
            register: navLabels['nav.register'],
            logout: navLabels['nav.logout'],
            myTrips: navLabels['nav.my_trips'],
            messages: navLabels['nav.messages'],
            tickets: navLabels['nav.tickets'],
            orders: navLabels['nav.orders'],
            account: navLabels['nav.account'],
            menu: navLabels['nav.menu'],
          }}
          roleLinks={roleLinks}
          bellLabels={{
            aria: navLabels['nav.bell_aria'],
            empty: navLabels['nav.bell_empty'],
            markAll: navLabels['nav.bell_mark_all'],
          }}
          locale={locale}
        />
        <div className="flex-1">{children}</div>
        <Footer
          labels={{
            brandColumn: footerLabels['nav.footer.brand_column'],
            home: footerLabels['nav.footer.home'],
            residences: footerLabels['nav.footer.residences'],
            trust: footerLabels['nav.footer.trust'],
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
            companyLine: footerLabels['nav.footer.company_line'],
            copyright: footerLabels['nav.footer.copyright'],
          }}
        />
      </body>
    </html>
  );
}
