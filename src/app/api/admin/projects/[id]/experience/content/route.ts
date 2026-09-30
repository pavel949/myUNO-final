import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { ensureContentKey, updateTranslation } from '@/modules/content';
import { PROJECT_EXPERIENCE_CONTENT_FIELDS, projectExperienceContentKey } from '@/modules/projects/project-experience';

const supported = new Set(PROJECT_EXPERIENCE_CONTENT_FIELDS.map(field => field.key));
const locales = new Set(['en', 'ru', 'th']);

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, slug: true, descriptionKey: true, handbookKey: true },
  });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const field = typeof body?.field === 'string' ? body.field : '';
  const locale = typeof body?.locale === 'string' ? body.locale : '';
  const value = typeof body?.value === 'string' ? body.value : null;
  if (!supported.has(field) || !locales.has(locale) || value === null) {
    return NextResponse.json({ error: 'Invalid project content update' }, { status: 400 });
  }

  const key = projectExperienceContentKey(project, field);
  await ensureContentKey(prisma, key, 'project', `Project Experience: ${field}`, true);
  const contentKey = await prisma.contentKey.findUnique({ where: { key }, select: { id: true } });
  if (!contentKey) return NextResponse.json({ error: 'Content key unavailable' }, { status: 500 });

  await updateTranslation(prisma, {
    contentKeyId: contentKey.id,
    locale,
    value,
    identityId: guard.actorIdentityId,
  });

  return NextResponse.json({ ok: true, key });
}
