import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import PropertySubmissionWizard from './wizard';

export const dynamic = 'force-dynamic';
export default async function PropertyOnboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/property/onboard');
  if (!user.isAdmin && !user.roles.some(r => r.role === 'owner' || r.role === 'mc_member')) redirect('/owners');
  const projects = await prisma.project.findMany({
    where: { status: 'live' }, orderBy: { name: 'asc' },
    select: { id: true, name: true, address: true },
    take: 500,
  });
  return <PropertySubmissionWizard projects={projects} />;
}
