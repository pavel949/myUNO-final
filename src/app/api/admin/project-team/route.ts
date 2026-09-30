import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, failed } from '@/app/libs/onboardingGuard';

const DEPARTMENTS = new Set(['reservations','front_desk','housekeeping','maintenance','guest_care','finance','pricing','content','channels','owner_relations']);
/** Department grants are an additional restriction, never a replacement for an active scoped staff role. */
export async function GET(req: NextRequest) {
  const guard = await requireAdmin(); if (!guard.ok) return guard.error;
  const projectId=req.nextUrl.searchParams.get('projectId');
  if(!projectId) return NextResponse.json({error:'projectId required'},{status:400});
  const assignments=await prisma.roleAssignment.findMany({
    where:{projectId,status:'active',role:{in:['staff_ops','onsite_host']}},
    select:{identityId:true,role:true,identity:{select:{firstName:true,lastName:true,email:true}}},
  });
  const permissions=await prisma.projectStaffPermission.findMany({where:{projectId}});
  const byId=new Map(permissions.map(p=>[p.identityId,p.departments]));
  return NextResponse.json({items:assignments.map(a=>({identityId:a.identityId,role:a.role,name:[a.identity.firstName,a.identity.lastName].join(' '),email:a.identity.email,departments:byId.get(a.identityId)||[]}))});
}
export async function PUT(req: NextRequest) {
  const guard=await requireAdmin(); if(!guard.ok) return guard.error;
  try {
    const body=await req.json();
    const {projectId,identityId}=body;
    const departments=body.departments;
    if(typeof projectId!=='string'||typeof identityId!=='string'||!Array.isArray(departments)||!departments.every((x:unknown)=>typeof x==='string'&&DEPARTMENTS.has(x))) {
      return NextResponse.json({error:'Invalid project, user or departments'},{status:400});
    }
    const active=await prisma.roleAssignment.findFirst({where:{projectId,identityId,status:'active',role:{in:['staff_ops','onsite_host']}},select:{id:true}});
    if(!active)return NextResponse.json({error:'Grant the person an active staff role in this project first'},{status:409});
    const record=await prisma.projectStaffPermission.upsert({where:{projectId_identityId:{projectId,identityId}},
      create:{projectId,identityId,departments:[...new Set(departments as string[])]},
      update:{departments:[...new Set(departments as string[])]}});
    return NextResponse.json({projectId:record.projectId,identityId:record.identityId,departments:record.departments});
  } catch (error) {return failed(error,'Could not update project permissions');}
}
