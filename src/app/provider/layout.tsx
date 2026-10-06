import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import { StitchWorkspaceShell } from '@/components/stitch/StitchShells';

export const dynamic = 'force-dynamic';

export default async function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/provider');
  }

  const isMember = user.roles.some(
    (role) => role.role === 'provider_member' && role.providerId
  );

  const labels = await getLabels({
    'provider.portal.eyebrow': 'myUNO',
    'provider.portal.title': 'Provider workspace',
    'provider.portal.nav_orders': 'My Orders',
    'provider.portal.nav_services': 'My Services',
    'provider.portal.nav_remittances': 'Remittances',
  });

  return (
    <StitchWorkspaceShell
      eyebrow={labels['provider.portal.eyebrow']}
      title={labels['provider.portal.title']}
      items={
        isMember
          ? [
              { href: '/provider', label: labels['provider.portal.nav_orders'] },
              { href: '/provider/services', label: labels['provider.portal.nav_services'] },
              { href: '/provider/remittances', label: labels['provider.portal.nav_remittances'] },
            ]
          : []
      }
    >
      <div className="p-20 md:p-32">
        <div className="mx-auto max-w-5xl">{children}</div>
      </div>
    </StitchWorkspaceShell>
  );
}
