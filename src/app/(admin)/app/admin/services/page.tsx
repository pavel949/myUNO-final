import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { redirect } from 'next/navigation';
import ServicesClient from './services-client';

export const metadata = {
  title: 'Service Approvals',
};

export default async function ServicesPage() {
  const user = await getCurrentUser();

  if (!user?.isAdmin) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-surface-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-heading-1 mb-8">Service Approvals</h1>
        <ServicesClient />
      </div>
    </div>
  );
}
