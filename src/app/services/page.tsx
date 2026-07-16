import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { redirect } from 'next/navigation';
import ServicesClient from './services-client';

export const metadata = {
  title: 'Services',
};

export default async function ServicesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Get the project context from the user's roles
  const userRole = user.roles[0];
  if (!userRole?.projectId) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-surface-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-heading-1">Services</h1>
          <p className="text-text-secondary mt-2">Browse vetted services available for your property</p>
        </div>
        <ServicesClient projectId={userRole.projectId} />
      </div>
    </div>
  );
}
