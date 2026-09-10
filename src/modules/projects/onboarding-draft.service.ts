import type { PrismaClient } from '@prisma/client';

export async function listOnboardingTemplates(db: PrismaClient) {
  return db.propertyOnboardingTemplate.findMany({
    where: { active: true },
    orderBy: [{ propertyType: 'asc' }, { templateKey: 'asc' }, { version: 'desc' }],
  });
}

export async function getProjectOnboardingDraft(db: PrismaClient, projectId: string) {
  return db.projectOnboardingDraft.findUnique({
    where: { projectId },
    include: { template: true },
  });
}

export async function saveProjectOnboardingDraft(db: PrismaClient, input: {
  projectId: string;
  templateId?: string | null;
  lastStage?: string | null;
  stageData?: Record<string, unknown>;
  updatedByIdentityId: string;
}) {
  const project = await db.project.findUnique({ where: { id: input.projectId }, select: { id: true } });
  if (!project) throw new Error('Project not found');

  let inherited: Record<string, unknown> | undefined;
  if (input.templateId) {
    const template = await db.propertyOnboardingTemplate.findUnique({ where: { id: input.templateId } });
    if (!template || !template.active) throw new Error('Onboarding template not found');
    inherited = template.configuration as Record<string, unknown>;
  }

  const existing = await db.projectOnboardingDraft.findUnique({ where: { projectId: input.projectId } });
  const nextStageData = {
    ...((existing?.stageData as Record<string, unknown> | null) || {}),
    ...(input.stageData || {}),
  };

  return db.projectOnboardingDraft.upsert({
    where: { projectId: input.projectId },
    create: {
      projectId: input.projectId,
      templateId: input.templateId || null,
      stageData: nextStageData as any,
      inheritedConfiguration: (inherited || {}) as any,
      lastStage: input.lastStage || null,
      updatedByIdentityId: input.updatedByIdentityId,
      autosavedAt: new Date(),
    },
    update: {
      ...(input.templateId !== undefined ? { templateId: input.templateId } : {}),
      ...(inherited !== undefined ? { inheritedConfiguration: inherited as any } : {}),
      stageData: nextStageData as any,
      ...(input.lastStage !== undefined ? { lastStage: input.lastStage } : {}),
      updatedByIdentityId: input.updatedByIdentityId,
      autosavedAt: new Date(),
    },
    include: { template: true },
  });
}
