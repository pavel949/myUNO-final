import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import ServicesClient from './services-client';

export const metadata = {
  title: 'My Services',
};

export default async function ProviderServicesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Check if user is a provider member
  const providerRole = user.roles.find((r) => r.role === 'provider_member');
  if (!providerRole) {
    redirect('/');
  }

  // Get the provider ID from the role assignment
  const roleAssignment = await prisma.roleAssignment.findFirst({
    where: {
      identityId: user.identityId,
      role: 'provider_member',
      status: 'active',
    },
  });

  if (!roleAssignment?.providerId) {
    redirect('/');
  }

  const providerId = roleAssignment.providerId;

  // Get provider info
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    select: {
      id: true,
      name: true,
      status: true,
    },
  });

  if (!provider) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-surface-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-heading-1">My Services</h1>
          <p className="text-text-secondary mt-2">Provider: {provider.name}</p>
        </div>
        <ServicesClient providerId={providerId} />
      </div>
    </div>
  );
}
