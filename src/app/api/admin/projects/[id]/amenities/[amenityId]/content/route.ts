import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { projectExperienceAccess } from '@/app/libs/projectExperienceGuard';
import { ensureContentKey, updateTranslation } from '@/modules/content';
import {
  PROJECT_AMENITY_CONTENT_FIELDS,
  projectAmenityContentKey,
  type ProjectAmenityContentField,
} from '@/modules/projects';

const locales = new Set(['en','ru','th']);
const fields = new Set<string>(PROJECT_AMENITY_CONTENT_FIELDS);

async function getAmenity(projectId: string, amenityId: string) {
  return prisma.projectAmenity.findFirst({
    where: { id: amenityId, projectId },
    select: {
      id: true, name: true, shortDescription: true, description: true,
      accessInstructions: true, terms: true,
    },
  });
}

export async function GET(_req: NextRequest, { params }: { params: { id: string; amenityId: string } }) {
  const guard = await projectExperienceAccess(params.id);
  if ('error' in guard) return guard.error;
  const amenity = await getAmenity(params.id, params.amenityId);
  if (!amenity) return NextResponse.json({ error: 'Amenity not found' }, { status: 404 });

  const keys = PROJECT_AMENITY_CONTENT_FIELDS.map(field => projectAmenityContentKey(amenity.id, field));
  const rows = await prisma.contentKey.findMany({
    where: { key: { in: keys } },
    select: { key: true, translations: { select: { locale: true, value: true, status: true } } },
  });
  const byKey = new Map(rows.map(row => [row.key, row.translations]));
  const fallback = {
    name: amenity.name,
    shortDescription: amenity.shortDescription,
    description: amenity.description,
    accessInstructions: amenity.accessInstructions,
    terms: amenity.terms,
  };

  return NextResponse.json({
    fields: PROJECT_AMENITY_CONTENT_FIELDS.map(field => ({
      field,
      fallback: fallback[field],
      translations: Object.fromEntries((byKey.get(projectAmenityContentKey(amenity.id, field)) ?? []).map(item => [
        item.locale, { value: item.value, status: item.status },
      ])),
    })),
  });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string; amenityId: string } }) {
  const guard = await projectExperienceAccess(params.id);
  if ('error' in guard) return guard.error;
  const amenity = await getAmenity(params.id, params.amenityId);
  if (!amenity) return NextResponse.json({ error: 'Amenity not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const field = typeof body?.field === 'string' ? body.field : '';
  const locale = typeof body?.locale === 'string' ? body.locale : '';
  const value = typeof body?.value === 'string' ? body.value : null;
  if (!fields.has(field) || !locales.has(locale) || value === null) {
    return NextResponse.json({ error: 'Invalid amenity translation update' }, { status: 400 });
  }

  const typedField = field as ProjectAmenityContentField;
  const key = projectAmenityContentKey(amenity.id, typedField);
  await ensureContentKey(prisma, key, 'project_amenity', `Project amenity ${typedField}`, true);
  const contentKey = await prisma.contentKey.findUnique({ where: { key }, select: { id: true } });
  if (!contentKey) return NextResponse.json({ error: 'Content key unavailable' }, { status: 500 });
  await updateTranslation(prisma, {
    contentKeyId: contentKey.id,
    locale,
    value,
    identityId: guard.user.identityId,
  });
  return NextResponse.json({ ok: true });
}
