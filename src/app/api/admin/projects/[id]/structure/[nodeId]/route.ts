import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, failed } from '@/app/libs/onboardingGuard';
import { structureKinds } from '../route';

type Params = { params: { id: string; nodeId: string } };
const codePattern = /^[a-z0-9][a-z0-9_-]{0,79}$/;

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  const existing = await prisma.projectStructureNode.findFirst({
    where: { id: params.nodeId, projectId: params.id },
  });
  if (!existing) return NextResponse.json({ error: 'Structure node not found' }, { status: 404 });
  try {
    const body = await req.json() as Record<string, unknown>;
    const data: {
      code?: string; name?: string; kind?: string;
      parentId?: string | null; sortOrder?: number; floorNumber?: number | null;
    } = {};
    if (body.code !== undefined) {
      const code = String(body.code).trim().toLowerCase();
      if (!codePattern.test(code)) throw new Error('Invalid structure code');
      data.code = code;
    }
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name || name.length > 160) throw new Error('Invalid structure name');
      data.name = name;
    }
    if (body.kind !== undefined) {
      const kind = String(body.kind);
      if (!structureKinds.some(value => value === kind)) throw new Error('Invalid structure kind');
      data.kind = kind;
    }
    if (body.sortOrder !== undefined) {
      const value = Number(body.sortOrder);
      if (!Number.isSafeInteger(value)) throw new Error('Invalid sort order');
      data.sortOrder = value;
    }
    if (body.floorNumber !== undefined) {
      const value = body.floorNumber === null || body.floorNumber === '' ? null : Number(body.floorNumber);
      if (value !== null && (!Number.isSafeInteger(value) || (data.kind ?? existing.kind) !== 'floor'))
        throw new Error('Floor number only applies to floor nodes');
      data.floorNumber = value;
    }
    if (body.parentId !== undefined) {
      const parentId = typeof body.parentId === 'string' && body.parentId ? body.parentId : null;
      if (parentId === existing.id) throw new Error('Structure cannot parent itself');
      if (parentId) {
        const parent = await prisma.projectStructureNode.findFirst({
          where: { id: parentId, projectId: params.id },
          select: { id: true },
        });
        if (!parent) throw new Error('Parent belongs to another project');
      }
      data.parentId = parentId;
    }
    const node = await prisma.projectStructureNode.update({
      where: { id: existing.id }, data,
    });
    return NextResponse.json(node);
  } catch (error) {
    return failed(error, 'Unable to update physical structure');
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  const existing = await prisma.projectStructureNode.findFirst({
    where: { id: params.nodeId, projectId: params.id },
    include: { _count: { select: { units: true, children: true } } },
  });
  if (!existing) return NextResponse.json({ error: 'Structure node not found' }, { status: 404 });
  if (existing._count.units > 0 || existing._count.children > 0) {
    return NextResponse.json({
      error: 'Move linked units and child structures before deleting this location',
    }, { status: 409 });
  }
  await prisma.projectStructureNode.delete({ where: { id: existing.id } });
  return NextResponse.json({ deleted: true });
}
