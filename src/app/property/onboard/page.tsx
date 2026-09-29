import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import PropertySubmissionWizard from './wizard';

export const dynamic = 'force-dynamic';
export default async function PropertyOnboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/property/onboard');
  const [projects, areas] = await Promise.all([prisma.project.findMany({
    where: { status: 'live' }, orderBy: { name: 'asc' },
    select: { id: true, name: true, address: true },
    take: 500,
  }), prisma.area.findMany({ where: { status: 'live' }, select: { id: true, slug: true }, orderBy: { sort: 'asc' } })]);
  return <PropertySubmissionWizard projects={projects} areas={areas} />;
}
