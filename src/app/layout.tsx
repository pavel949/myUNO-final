import type { Metadata } from 'next';
import './globals.css';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'myUNO',
  description: 'Operating platform for serviced living in Phuket',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  const navLabels = await getLabels({
    'nav.find_stay': 'Find a stay',
    'nav.trust': 'Trust',
    'nav.login': 'Log in',
    'nav.register': 'Sign up',
    'nav.logout': 'Log out',
    'nav.my_trips': 'My trips',
    'nav.owner_dashboard': 'Owner dashboard',
    'nav.mc_portal': 'MC portal',
    'nav.admin': 'Admin',
    'nav.menu': 'Menu',
  });

  const footerLabels = await getLabels({
    'nav.footer.brand_column': 'myUNO',
    'nav.footer.home': 'Home',
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
    <html lang="en">
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
            trust: navLabels['nav.trust'],
            login: navLabels['nav.login'],
            register: navLabels['nav.register'],
            logout: navLabels['nav.logout'],
            myTrips: navLabels['nav.my_trips'],
            ownerDashboard: navLabels['nav.owner_dashboard'],
            mcPortal: navLabels['nav.mc_portal'],
            admin: navLabels['nav.admin'],
            menu: navLabels['nav.menu'],
          }}
        />
        <div className="flex-1">{children}</div>
        <Footer
          labels={{
            brandColumn: footerLabels['nav.footer.brand_column'],
            home: footerLabels['nav.footer.home'],
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
