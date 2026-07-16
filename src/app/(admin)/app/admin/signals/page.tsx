import { Metadata } from 'next';
import { getAdminSignals } from '@/app/actions/getAdminSignals';
import { SignalsList } from '@/app/components/admin/SignalsList';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Buyer Signals',
};

export default async function SignalsPage() {
  const user = await getCurrentUser();
  if (!user?.identityId) {
    redirect('/login');
  }

  const isAdmin = await prisma.identity.findUnique({
    where: { id: user.identityId },
    select: { isAdmin: true },
  });

  if (!isAdmin?.isAdmin) {
    redirect('/app');
  }

  const { signals } = await getAdminSignals();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Buyer Signals</h1>
          <p className="mt-2 text-gray-600">
            Monitor and manage buyer interest signals across the platform.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">
                All Signals ({signals.length})
              </h2>
            </div>
          </div>
          <div className="p-6">
            <SignalsList signals={signals} />
          </div>
        </div>
      </div>
    </div>
  );
}
