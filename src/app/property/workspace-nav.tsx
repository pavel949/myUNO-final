import { createEmployeeCreationService } from '@/modules/onboarding/employee-creation.service';
import { EmployeeCreationError } from '@/modules/onboarding/employee-creation.schema';
import { EMPLOYEE_CREATION_LABELS, EMPLOYEE_CREATION_DRAFTS } from '@/modules/content/employee-creation.seed';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { getPropertyWorkspaces, type PropertyWorkspace } from '@/modules/core/property-workspaces';
import { PROPERTY_WORKSPACE_LABELS, PROPERTY_WORKSPACE_DRAFTS } from '@/modules/content/property-workspace.seed';

const workspacePaths: Record<PropertyWorkspace, string> = {
  content: '/property/content', pricing: '/property/pricing',
  'booking-mode': '/property/booking-mode', access: '/property/access',
};

/** Visible links use the same current identity/ancestor checks as the destinations. */
export default async function PropertyWorkspaceNav({ identityId, current }: {
  identityId: string; current: PropertyWorkspace | 'create';
}) {
  const workspaces = await getPropertyWorkspaces(prisma, identityId);
  const creation = await createEmployeeCreationService(prisma).list(identityId).catch(error => {
    if (error instanceof EmployeeCreationError && error.status === 403) return null;
    throw error;
  });
  const showCreation = !!creation && (creation.spaces.length > 0 || creation.items.length > 0);
  const creationLabels = showCreation ? await getLabels(EMPLOYEE_CREATION_LABELS, undefined, EMPLOYEE_CREATION_DRAFTS) : {};
  if (!workspaces.length && !showCreation) return null;
  const labels = await getLabels(PROPERTY_WORKSPACE_LABELS, undefined, PROPERTY_WORKSPACE_DRAFTS);
  return <nav aria-label={labels['property.workspace.navigation']} className="flex flex-wrap gap-16 px-20 py-12 text-small">
    {workspaces.map(workspace => <Link key={workspace} href={workspacePaths[workspace]}
      aria-current={current === workspace ? 'page' : undefined} className="text-brand-andaman underline">
      {labels[`property.workspace.${workspace}`]}
    </Link>)}
    {showCreation && <Link href="/property/create" aria-current={current === 'create' ? 'page' : undefined} className="text-brand-andaman underline">{creationLabels['property.creation.title']}</Link>}
  </nav>;
}
