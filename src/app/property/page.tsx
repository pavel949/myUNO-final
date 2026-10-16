import { createEmployeeCreationService } from '@/modules/onboarding/employee-creation.service';
import { EmployeeCreationError } from '@/modules/onboarding/employee-creation.schema';
import { EMPLOYEE_CREATION_LABELS, EMPLOYEE_CREATION_DRAFTS } from '@/modules/content/employee-creation.seed';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { getPropertyWorkspaces } from '@/modules/core/property-workspaces';
import { PROPERTY_WORKSPACE_LABELS, PROPERTY_WORKSPACE_DRAFTS } from '@/modules/content/property-workspace.seed';

export const dynamic = 'force-dynamic';
export default async function PropertyWorkspacePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=%2Fproperty');
  const workspaces = await getPropertyWorkspaces(prisma, user.identityId);
  const creation = await createEmployeeCreationService(prisma).list(user.identityId).catch(error => {
    if (error instanceof EmployeeCreationError && error.status === 403) return null;
    throw error;
  });
  const showCreation = !!creation && (creation.spaces.length > 0 || creation.items.length > 0);
  const creationLabels = showCreation ? await getLabels(EMPLOYEE_CREATION_LABELS, undefined, EMPLOYEE_CREATION_DRAFTS) : {};
  const labels = await getLabels(PROPERTY_WORKSPACE_LABELS, undefined, PROPERTY_WORKSPACE_DRAFTS);
  return <main className="stitch-workspace mx-auto max-w-5xl px-16 py-32">
    <h1 className="font-display text-display-xl text-text-ink">{labels['property.workspace.title']}</h1>
    <p className="mt-12 text-text-secondary">{labels['property.workspace.intro']}</p>
    {!workspaces.length && !showCreation && <p className="stitch-panel mt-24 p-20" role="status">{labels['property.workspace.empty']}</p>}
    <ul className="mt-24 grid gap-16 sm:grid-cols-2">{workspaces.map(workspace => <li key={workspace} className="stitch-panel p-20">
      <h2 className="font-semibold">{labels[`property.workspace.${workspace}`]}</h2>
      <p className="mt-12 text-small text-text-secondary">{labels[`property.workspace.${workspace}_note`]}</p>
      <Link href={`/property/${workspace}`} className="mt-16 inline-block text-brand-andaman underline">{labels['property.workspace.open']}</Link>
    </li>)}{showCreation && <li className="stitch-panel p-20"><h2 className="font-semibold">{creationLabels['property.creation.title']}</h2><p className="mt-12 text-small text-text-secondary">{creationLabels['property.creation.intro']}</p><Link href="/property/create" className="mt-16 inline-block text-brand-andaman underline">{labels['property.workspace.open']}</Link></li>}</ul>
  </main>;
}
