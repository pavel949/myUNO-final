import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { classifyPropertySubmission } from '@/modules/onboarding';
import { submissionUnitWhere } from '@/modules/onboarding/submission-unit-access';

const MARKER = 'myuno_property_submission_v1';
const allowedKinds = new Set(['home', 'resort', 'management']);
const allowedOffers = new Set(['short_stay', 'monthly', 'yearly', 'sale']);
type Submission = { kind: string; existingUnitId: string | null; operatingModel: 'owner_direct' | 'via_management_company' | 'direct_managed' | null; requestedManagementCompanyName: string; projectId: string | null; proposedProject: string; projectAddress: string; projectType: string; areaId: string | null; latitude: number | null; longitude: number | null; projectPhotos: string[]; unitName: string; unitType: string; bedrooms: number | null; bathrooms: number | null; sizeSqm: number | null; maxGuests: number | null; proposedNightlyBaht: number | null; proposedMinNights: number | null; floor: string; description: string; offers: string[]; contact: string; photos: string[]; status: 'draft' | 'submitted' };

function normalize(body: Record<string, unknown>): Submission {
  if (body.existingUnitId && (typeof body.projectId !== 'string' || !body.projectId)) {
    throw new Error('Choose the project for the selected existing property.');
  }
  const kind = String(body.kind || '');
  if (!allowedKinds.has(kind)) throw new Error('Choose what you are adding.');
  const offers = Array.isArray(body.offers) ? body.offers.filter((v): v is string => typeof v === 'string' && allowedOffers.has(v)) : [];
  const num = (v: unknown) => v === '' || v === null || v === undefined ? null : Number(v);
  const bedrooms = num(body.bedrooms), bathrooms = num(body.bathrooms), sizeSqm = num(body.sizeSqm), maxGuests = num(body.maxGuests), latitude = num(body.latitude), longitude = num(body.longitude);
  if ([bedrooms, bathrooms, sizeSqm, maxGuests].some(v => v !== null && (!Number.isFinite(v) || v < 0)) || (maxGuests !== null && !Number.isInteger(maxGuests))) throw new Error('Invalid property measurements.');
  if ((latitude !== null && (!Number.isFinite(latitude) || Math.abs(latitude) > 90)) || (longitude !== null && (!Number.isFinite(longitude) || Math.abs(longitude) > 180))) throw new Error('Invalid project location.');
  const proposedNightlyBaht = num(body.proposedNightlyBaht), proposedMinNights = num(body.proposedMinNights);
  if ([proposedNightlyBaht, proposedMinNights].some(value => value !== null && (!Number.isSafeInteger(value) || value < 1)) || (proposedNightlyBaht !== null && proposedNightlyBaht > 10000000) || (proposedMinNights !== null && proposedMinNights > 365)) throw new Error('Invalid proposed rental terms.');
  const operatingModel = ['owner_direct', 'via_management_company', 'direct_managed'].includes(String(body.operatingModel))
    ? String(body.operatingModel) as Submission['operatingModel']
    : null;
  return {
    kind, existingUnitId: typeof body.existingUnitId === 'string' && body.existingUnitId ? body.existingUnitId : null, operatingModel, requestedManagementCompanyName: String(body.requestedManagementCompanyName || '').trim().slice(0, 160), projectId: typeof body.projectId === 'string' && body.projectId ? body.projectId : null,
    proposedProject: String(body.proposedProject || '').trim().slice(0, 160),
    projectAddress: String(body.projectAddress || '').trim().slice(0, 500),
    projectType: ['resort', 'condominium', 'villa_estate', 'standalone'].includes(String(body.projectType)) ? String(body.projectType) : 'condominium',
    areaId: typeof body.areaId === 'string' && body.areaId ? body.areaId : null,
    latitude, longitude,
    projectPhotos: Array.isArray(body.projectPhotos) ? [...new Set(body.projectPhotos.filter((id): id is string => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)))].slice(0, 50) : [],
    unitName: String(body.unitName || '').trim().slice(0, 160),
    unitType: ['villa', 'apartment', 'condo', 'house'].includes(String(body.unitType)) ? String(body.unitType) : 'condo',
    bedrooms, bathrooms, sizeSqm, maxGuests, proposedNightlyBaht, proposedMinNights, floor: String(body.floor || '').trim().slice(0, 40),
    description: String(body.description || '').trim().slice(0, 3000),
    offers, contact: String(body.contact || '').trim().slice(0, 160),
    photos: Array.isArray(body.photos) ? [...new Set(body.photos.filter((id): id is string => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)))].slice(0, 50) : [],
    status: body.status === 'submitted' ? 'submitted' : 'draft',
  };
}

async function mediaOwned(ids: string[], ownerId: string): Promise<boolean> {
  if (!ids.length) return true;
  const count = await prisma.mediaAsset.count({ where: { id: { in: ids }, uploadedByIdentityId: ownerId, kind: 'photo', encrypted: false } });
  return count === ids.length;
}

async function authorized() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  // A signed-in applicant may request ownership/management verification. A role
  // is never granted by submitting; only the admin conversion can record a
  // verified owner, and every draft remains scoped to its applicant.
  return { user } as const;
}

export async function GET(req: NextRequest) {
  const access = await authorized();
  if ('error' in access) return access.error;
  const projectId = req.nextUrl.searchParams.get('projectId');
  if (projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, status: true } });
    const where = submissionUnitWhere(access.user, projectId);
    const privateAccess = project?.status === 'draft' && (access.user.isAdmin || Boolean(
      await prisma.unit.findFirst({ where, select: { id: true } }),
    ));
    if (!project || (project.status !== 'live' && !privateAccess)) {
      return NextResponse.json({ error: 'Project not available.' }, { status: 404 });
    }
    const units = await prisma.unit.findMany({
      where,
      select: { id: true, name: true, floor: true, bedrooms: true, bathrooms: true, sizeSqm: true },
      orderBy: { name: 'asc' },
      take: 500,
    });
    return NextResponse.json({ units });
  }

  const rows = await prisma.crmOpportunity.findMany({
    where: { identityId: access.user.identityId, source: MARKER },
    select: { id: true, createdAt: true, updatedAt: true, requirements: true },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });
  const ids = [...new Set(rows.flatMap(row => {
    const data = row.requirements as Record<string, unknown>;
    return [...(Array.isArray(data.photos) ? data.photos : []), ...(Array.isArray(data.projectPhotos) ? data.projectPhotos : [])].filter((id): id is string => typeof id === 'string');
  }))];
  const assets = ids.length ? await prisma.mediaAsset.findMany({ where: { id: { in: ids }, uploadedByIdentityId: access.user.identityId, kind: 'photo', encrypted: false }, select: { id: true, storageKey: true } }) : [];
  return NextResponse.json({ items: rows, media: Object.fromEntries(assets.map(asset => [asset.id, asset.storageKey])) });
}

export async function POST(req: NextRequest) {
  const access = await authorized();
  if ('error' in access) return access.error;
  try {
    const data = normalize(await req.json());
    if (!await mediaOwned([...data.photos, ...data.projectPhotos], access.user.identityId)) return NextResponse.json({ error: 'Only your uploaded public photos may be attached.' }, { status: 403 });
    if (data.projectId) {
      const project = await prisma.project.findUnique({ where: { id: data.projectId }, select: { id: true, status: true } });
      const where = submissionUnitWhere(access.user, data.projectId);
      const privateAccess = project?.status === 'draft' && (access.user.isAdmin || Boolean(
        await prisma.unit.findFirst({ where, select: { id: true } }),
      ));
      if (!project || (project.status !== 'live' && !privateAccess)) return NextResponse.json({ error: 'Choose an available project.' }, { status: 400 });
      if (data.existingUnitId) {
        const unit = await prisma.unit.findFirst({ where: { ...where, id: data.existingUnitId }, select: { id: true } });
        if (!unit) return NextResponse.json({ error: 'Selected existing property is not available in this project.' }, { status: 400 });
      }
    }
    if (data.status === 'submitted' && ((!data.unitName && data.kind !== 'resort') || (!data.projectId && !data.proposedProject) || (data.kind !== 'resort' && !data.offers.length))) {
      return NextResponse.json({ error: 'Complete your property, residence and offering before submitting.' }, { status: 400 });
    }
    const row = await prisma.crmOpportunity.create({
      data: {
        identityId: access.user.identityId,
        type: classifyPropertySubmission(data),
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
    if (previous.status !== 'draft') return NextResponse.json({ error: 'Submitted applications cannot be edited. Contact the myUNO team.' }, { status: 409 });
    const data = normalize({ ...previous, ...body });
    if (!await mediaOwned([...data.photos, ...data.projectPhotos], access.user.identityId)) return NextResponse.json({ error: 'Only your uploaded public photos may be attached.' }, { status: 403 });
    if (data.projectId) {
      const project = await prisma.project.findUnique({ where: { id: data.projectId }, select: { id: true, status: true } });
      const where = submissionUnitWhere(access.user, data.projectId);
      const privateAccess = project?.status === 'draft' && (access.user.isAdmin || Boolean(
        await prisma.unit.findFirst({ where, select: { id: true } }),
      ));
      if (!project || (project.status !== 'live' && !privateAccess)) return NextResponse.json({ error: 'Choose an available project.' }, { status: 400 });
      if (data.existingUnitId) {
        const unit = await prisma.unit.findFirst({ where: { ...where, id: data.existingUnitId }, select: { id: true } });
        if (!unit) return NextResponse.json({ error: 'Selected existing property is not available in this project.' }, { status: 400 });
      }
    }
    if (data.status === 'submitted' && ((!data.unitName && data.kind !== 'resort') || (!data.projectId && !data.proposedProject) || (data.kind !== 'resort' && !data.offers.length))) return NextResponse.json({ error: 'Complete your property, residence and offering before submitting.' }, { status: 400 });
    const row = await prisma.crmOpportunity.update({
      where: { id },
      data: {
        title: data.unitName || 'New property draft',
        projectId: data.projectId,
        type: classifyPropertySubmission(data),
        requirements: data,
      },
      select: { id: true, requirements: true },
    });
    return NextResponse.json(row);
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid submission' }, { status: 400 }); }
}
