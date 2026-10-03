import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { AgentError } from './domain';
export async function readAgentInput(req: NextRequest): Promise<Record<string,unknown>> {
  const origin=req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin) throw new AgentError('invalid_origin',403);
  const body=await req.text();
  if (body.length>64000) throw new AgentError('payload_too_large',413);
  let value:unknown;
  try {value=JSON.parse(body);} catch {throw new AgentError('invalid_json');}
  if(!value || typeof value !== 'object' || Array.isArray(value)) throw new AgentError('invalid_json');
  return value as Record<string,unknown>;
}
export function agentFailure(error:unknown) {
  if(error instanceof AgentError) return NextResponse.json({error:error.code},{status:error.status});
  if(error instanceof Prisma.PrismaClientKnownRequestError && ['P2002','P2034'].includes(error.code))
    return NextResponse.json({error:'conflict_retry'},{status:409});
  console.error('agent_module_request_failed',error instanceof Error ? error.name : 'unknown');
  return NextResponse.json({error:'request_failed'},{status:500});
}
