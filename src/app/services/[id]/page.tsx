import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const metadata = {
  title: 'Service Details',
};

interface ServiceDetailPageProps {
  params: {
    id: string;
  };
}

export default async function ServiceDetailPage({
  params,
}: ServiceDetailPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // In a real implementation, you'd fetch the service data server-side
  // For now, we'll rely on client-side fetching in a future iteration
  const serviceId = params.id;

  return (
    <div className="min-h-screen bg-surface-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/services"
          className="text-brand-teal hover:underline mb-6 inline-flex items-center"
        >
          ← Back to Services
        </Link>

        <div className="bg-white rounded-lg p-8">
          <h1 className="text-heading-1 mb-4">Loading service details...</h1>
          <p className="text-text-secondary">Service ID: {serviceId}</p>
        </div>
      </div>
    </div>
  );
}
