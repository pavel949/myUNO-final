import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getPublicProjectBySlug } from '@/modules/projects';

const MARKER = 'myuno_property_submission_v1';
const allowedKinds = new Set(['home', 'resort', 'management']);
const allowedOffers = new Set(['short_stay', 'monthly', 'yearly', 'sale']);
type Submission = { kind: string; projectId: string | null; proposedProject: string; unitName: string; bedrooms: number | null; bathrooms: number | null; sizeSqm: number | null; floor: string; description: string; offers: string[]; contact: string; status: 'draft' | 'submitted' };

function normalize(body: Record<string, unknown>): Submission {
  const kind = String(body.kind || '');
  if (!allowedKinds.has(kind)) throw new Error('Choose what you are adding.');
  const offers = Array.isArray(body.offers) ? body.offers.filter((v): v is string => typeof v === 'string' && allowedOffers.has(v)) : [];
  const num = (v: unknown) => v === '' || v === null || v === undefined ? null : Number(v);
  const bedrooms = num(body.bedrooms), bathrooms = num(body.bathrooms), sizeSqm = num(body.sizeSqm);
  if ([bedrooms, bathrooms, sizeSqm].some(v => v !== null && (!Number.isFinite(v) || v < 0))) throw new Error('Invalid property measurements.');
  return {
    kind, projectId: typeof body.projectId === 'string' && body.projectId ? body.projectId : null,
    proposedProject: String(body.proposedProject || '').trim().slice(0, 160),
    unitName: String(body.unitName || '').trim().slice(0, 160),
    bedrooms, bathrooms, sizeSqm, floor: String(body.floor || '').trim().slice(0, 40),
    description: String(body.description || '').trim().slice(0, 3000),
    offers, contact: String(body.contact || '').trim().slice(0, 160),
    status: body.status === 'submitted' ? 'submitted' : 'draft',
  };
}

async function authorized() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  if (!user.isAdmin && !user.roles.some(r => r.role === 'owner' || r.role === 'mc_member')) {
    return { error: NextResponse.json({ error: 'Owner or property manager membership required' }, { status: 403 }) } as const;
  }
  return { user } as const;
}

export async function GET() {
  const access = await authorized();
  if ('error' in access) return access.error;
  const rows = await prisma.crmOpportunity.findMany({
    where: { identityId: access.user.identityId, source: MARKER },
    select: { id: true, createdAt: true, updatedAt: true, requirements: true },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });
  return NextResponse.json({ items: rows });
}

export async function POST(req: NextRequest) {
  const access = await authorized();
  if ('error' in access) return access.error;
  try {
    const data = normalize(await req.json());
    if (data.projectId) {
      const project = await prisma.project.findFirst({ where: { id: data.projectId, status: 'live' }, select: { id: true, slug: true } });
      if (!project || !await getPublicProjectBySlug(project.slug)) return NextResponse.json({ error: 'Choose an available project.' }, { status: 400 });
    }
    if (data.status === 'submitted' && (!data.unitName || (!data.projectId && !data.proposedProject) || !data.offers.length)) {
      return NextResponse.json({ error: 'Complete your property, residence and offering before submitting.' }, { status: 400 });
    }
    const row = await prisma.crmOpportunity.create({
      data: {
        identityId: access.user.identityId, type: data.offers.includes('sale') && data.offers.length === 1 ? 'sale' : 'management',
        stage: 'new', title: data.unitName || 'New property draft', source: MARKER,
        projectId: data.projectId, requirements: data,
      },
      select: { id: true, requirements: true },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid submission' }, { status: 400 }); }
}

export async function PATCH(req: NextRequest) {
  const access = await authorized();
  if ('error' in access) return access.error;
  try {
    const body = await req.json();
    const id = typeof body.id === 'string' ? body.id : '';
    const existing = await prisma.crmOpportunity.findFirst({ where: { id, identityId: access.user.identityId, source: MARKER }, select: { id: true, requirements: true } });
    if (!existing) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    const previous = existing.requirements as Record<string, unknown>;
    if (previous.status === 'submitted') return NextResponse.json({ error: 'Submitted applications cannot be edited. Contact the myUNO team.' }, { status: 409 });
    const data = normalize({ ...previous, ...body });
    if (data.projectId) {
      const project = await prisma.project.findFirst({ where: { id: data.projectId, status: 'live' }, select: { id: true } });
      if (!project) return NextResponse.json({ error: 'Choose an available project.' }, { status: 400 });
    }
    if (data.status === 'submitted' && (!data.unitName || (!data.projectId && !data.proposedProject) || !data.offers.length)) return NextResponse.json({ error: 'Complete your property, residence and offering before submitting.' }, { status: 400 });
    const row = await prisma.crmOpportunity.update({ where: { id }, data: { title: data.unitName || 'New property draft', projectId: data.projectId, type: data.offers.includes('sale') && data.offers.length === 1 ? 'sale' : 'management', requirements: data }, select: { id: true, requirements: true } });
    return NextResponse.json(row);
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid submission' }, { status: 400 }); }
}
