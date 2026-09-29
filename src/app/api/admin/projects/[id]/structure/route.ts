import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, failed } from '@/app/libs/onboardingGuard';

export const structureKinds = [
  'phase', 'cluster', 'building', 'tower', 'wing',
  'floor', 'block', 'zone', 'standalone',
] as const;
export type StructureKind = (typeof structureKinds)[number];
const codePattern = /^[a-z0-9][a-z0-9_-]{0,79}$/;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  const exists = await prisma.project.findUnique({
    where: { id: params.id }, select: { id: true },
  });
  if (!exists) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  const nodes = await prisma.projectStructureNode.findMany({
    where: { projectId: params.id },
    include: { _count: { select: { units: true, children: true } } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return NextResponse.json({ nodes });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  try {
    const body = await req.json() as Record<string, unknown>;
    const project = await prisma.project.findUnique({
      where: { id: params.id }, select: { id: true },
    });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const kind = String(body.kind ?? '').trim() as StructureKind;
    const code = String(body.code ?? '').trim().toLowerCase();
    const name = String(body.name ?? '').trim();
    const parentId = typeof body.parentId === 'string' && body.parentId ? body.parentId : null;
    const sortOrder = Number(body.sortOrder ?? 0);
    const floorNumber = body.floorNumber === null || body.floorNumber === undefined ||
      body.floorNumber === '' ? null : Number(body.floorNumber);
    if (!structureKinds.includes(kind)) throw new Error('Invalid physical structure kind');
    if (!codePattern.test(code)) throw new Error('Invalid physical structure code');
    if (!name || name.length > 160) throw new Error('A structure name is required (max 160 characters)');
    if (!Number.isSafeInteger(sortOrder)) throw new Error('Invalid sort order');
    if (floorNumber !== null && (!Number.isSafeInteger(floorNumber) || kind !== 'floor')) {
      throw new Error('Floor number must be an integer on a floor node');
    }
    if (parentId) {
      const parent = await prisma.projectStructureNode.findFirst({
        where: { id: parentId, projectId: params.id },
        select: { id: true },
      });
      if (!parent) throw new Error('Parent structure belongs to another project');
    }
    const node = await prisma.projectStructureNode.create({
      data: { projectId: params.id, parentId, kind, code, name, sortOrder, floorNumber },
    });
    return NextResponse.json(node, { status: 201 });
  } catch (error) {
    return failed(error, 'Unable to create property structure');
  }
}
