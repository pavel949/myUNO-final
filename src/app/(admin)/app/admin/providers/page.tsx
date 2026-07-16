import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { redirect } from 'next/navigation';
import { ProvidersClient } from './providers-client';

export const metadata = {
  title: 'Admin · Provider Vetting',
};

export default async function AdminProvidersPage() {
  const user = await getCurrentUser();

  if (!user?.isAdmin) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-surface-paper p-24">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-heading-1 font-bold mb-32">Provider Vetting Queue</h1>
        <ProvidersClient />
      </div>
    </div>
  );
}
