import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { agentAction } from '@/modules/agents';
import { agentFailure, readAgentInput } from '@/modules/agents/http';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest,{params}:{params:{workspaceId:string;resource:string}}) {
  const user=await getCurrentUser();
  if(!user) return NextResponse.json({error:'unauthorized'},{status:401});
  try {
    const input=await readAgentInput(req);
    return NextResponse.json(await agentAction(prisma,user.identityId,params.workspaceId,params.resource,input));
  } catch(error) {return agentFailure(error);}
}
