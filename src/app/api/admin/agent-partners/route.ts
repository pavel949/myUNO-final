import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { adminAgentAction } from '@/modules/agents';
import { agentFailure, readAgentInput } from '@/modules/agents/http';
export async function POST(req:NextRequest) {
  const user=await getCurrentUser();
  if(!user) return NextResponse.json({error:'unauthorized'},{status:401});
  try {return NextResponse.json(await adminAgentAction(prisma,user.identityId,await readAgentInput(req)));}
  catch(error) {return agentFailure(error);}
}
