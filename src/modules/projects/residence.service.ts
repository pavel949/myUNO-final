import { PrismaClient } from '@prisma/client';
import { getProjectAnnouncements } from '@/modules/comms';
import { listPublicServices } from '@/modules/services';

/**
 * What a resident sees (doc 07 F-RES, S6 without the stay card).
 *
 * A resident had **no surface at all**. The role existed, the permission matrix
 * had a column for it, staff could grant it — and there was nowhere for the
 * person to go afterwards. Someone living in a myUNO building could not read an
 * announcement, open the handbook, or order a service.
 *
 * Everything here is scoped to the projects where they actually hold the role.
 * A resident of one building sees that building, and nothing tells them another
 * exists.
 */

export interface ResidenceAnnouncement {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
  isPinned: boolean;
  isImportant: boolean;
  postedAs: string;
  organizationName: string | null;
  isRead: boolean;
}

export interface ResidenceService {
  id: string;
  title: string;
  categoryKey: string;
  basePriceThb: number | null;
  priceModel: string;
  providerName: string | null;
}

export interface Residence {
  projectId: string;
  projectName: string;
  projectSlug: string;
  handbookKey: string;
  /** Units they are a resident of, when the role was granted at unit scope. */
  units: { id: string; name: string }[];
  announcements: ResidenceAnnouncement[];
  services: ResidenceService[];
}

export async function getResidences(
  db: PrismaClient,
  identityId: string
): Promise<Residence[]> {
  const assignments = await db.roleAssignment.findMany({
    where: { identityId, role: 'resident', status: 'active' },
    select: {
      projectId: true,
      unit: { select: { id: true, name: true, projectId: true } },
    },
  });

  if (assignments.length === 0) return [];

  // A resident role can be scoped to a project or to a single unit inside one.
  // Either way the building is what they live in, so both resolve to a project.
  const projectIds = new Set<string>();
  const unitsByProject = new Map<string, { id: string; name: string }[]>();

  for (const assignment of assignments) {
    const projectId = assignment.projectId ?? assignment.unit?.projectId;
    if (!projectId) continue;
    projectIds.add(projectId);

    if (assignment.unit) {
      const list = unitsByProject.get(projectId) ?? [];
      if (!list.some((u) => u.id === assignment.unit!.id)) {
        list.push({ id: assignment.unit.id, name: assignment.unit.name });
      }
      unitsByProject.set(projectId, list);
    }
  }

  const projects = await db.project.findMany({
    where: { id: { in: [...projectIds] } },
    select: { id: true, name: true, slug: true, handbookKey: true },
    orderBy: { name: 'asc' },
  });

  return Promise.all(
    projects.map(async (project) => {
      // The comms module already knows how to filter by audience and expiry;
      // asking it is what keeps an owners-only notice off a resident's screen.
      const announcements = await getProjectAnnouncements(db, project.id, identityId);
      const services = await listPublicServices(db, project.id);

      return {
        projectId: project.id,
        projectName: project.name,
        projectSlug: project.slug,
        handbookKey: project.handbookKey,
        units: unitsByProject.get(project.id) ?? [],
        announcements: announcements.slice(0, 10).map((a) => ({
          id: a.id,
          title: a.title,
          body: a.body,
          createdAt: a.createdAt,
          isPinned: a.isPinned,
          isImportant: a.isImportant,
          postedAs: a.postedAs,
          organizationName: a.organization?.name ?? null,
          isRead: Boolean(a.isRead),
        })),
        services: services.slice(0, 12).map((s: Record<string, unknown>) => ({
          id: s.id as string,
          title: s.title as string,
          categoryKey: s.categoryKey as string,
          basePriceThb: (s.basePriceThb as number | null) ?? null,
          priceModel: s.priceModel as string,
          providerName:
            ((s.provider as { name?: string } | undefined)?.name as string | undefined) ?? null,
        })),
      };
    })
  );
}
