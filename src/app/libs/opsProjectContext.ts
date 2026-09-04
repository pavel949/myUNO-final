import type { CurrentUser } from '@/app/actions/getCurrentUser';
import type { PrismaClient } from '@prisma/client';
import { getStaffProjectIds } from './projectScope';

export interface OpsProjectContext {
  /** Project ids passed to board/queries. `undefined` = admin, all projects. */
  queryProjectIds: string[] | undefined;
  /** Selected single-project filter, or null for aggregated view. */
  activeProjectId: string | null;
  staffProjectIds: string[];
  isAdmin: boolean;
}

/**
 * Resolve which project(s) an ops surface should scope to.
 * Staff with multiple assignments can aggregate (default) or drill into one project.
 * Admins can view all projects or filter to one.
 */
export function resolveOpsProjectContext(
  user: CurrentUser,
  requestedProjectId?: string | null
): OpsProjectContext {
  const staffProjectIds = getStaffProjectIds(user);
  const isAdmin = user.isAdmin;
  const requested =
    typeof requestedProjectId === 'string' && requestedProjectId.trim()
      ? requestedProjectId.trim()
      : null;

  if (isAdmin) {
    return {
      queryProjectIds: requested ? [requested] : undefined,
      activeProjectId: requested,
      staffProjectIds,
      isAdmin: true,
    };
  }

  if (requested && staffProjectIds.includes(requested)) {
    return {
      queryProjectIds: [requested],
      activeProjectId: requested,
      staffProjectIds,
      isAdmin: false,
    };
  }

  return {
    queryProjectIds: staffProjectIds,
    activeProjectId: null,
    staffProjectIds,
    isAdmin: false,
  };
}

/** Preserve the active project filter when linking between ops surfaces. */
export function opsHref(path: string, projectId: string | null): string {
  if (!projectId) {
    return path;
  }
  const [pathname, existingQuery] = path.split('?');
  const params = new URLSearchParams(existingQuery || '');
  params.set('projectId', projectId);
  return `${pathname}?${params.toString()}`;
}

export function validatedActiveProjectId(
  activeProjectId: string | null,
  switchableProjectIds: string[]
): string | null {
  return activeProjectId && switchableProjectIds.includes(activeProjectId)
    ? activeProjectId
    : null;
}

export async function loadOpsSwitcherProjects(
  db: PrismaClient,
  context: OpsProjectContext
): Promise<Array<{ id: string; name: string }>> {
  const projectIds = context.isAdmin
    ? (
        await db.project.findMany({
          where: { status: { in: ['live', 'draft'] } },
          select: { id: true },
          orderBy: { name: 'asc' },
        })
      ).map((project) => project.id)
    : context.staffProjectIds;

  return db.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

export function opsBoardScope(
  context: OpsProjectContext,
  activeProjectId: string | null
): { projectIds: string[] } | undefined {
  if (context.isAdmin && !activeProjectId) {
    return undefined;
  }
  if (activeProjectId) {
    return { projectIds: [activeProjectId] };
  }
  if (context.queryProjectIds?.length) {
    return { projectIds: context.queryProjectIds };
  }
  return { projectIds: [] };
}
