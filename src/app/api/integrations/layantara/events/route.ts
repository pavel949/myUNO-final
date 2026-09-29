import { NextRequest, NextResponse } from 'next/server';
import { applyChannelEvent } from '@/modules/integrations/layantara/channel-service';
import { parseChannelEvent, verifyChannelSignature } from '@/modules/integrations/layantara/channel-contract';
import { prisma } from '@/lib/prisma';

export const runtime='nodejs';
export const dynamic='force-dynamic';

/** Dedicated server-to-server channel ingress. No browser, query token, cookie or
 * static public API key can grant write authority. Disabled without cutover flags. */
export async function POST(request:NextRequest) {
  if(process.env.UNIFIED_BOOKING_INTAKE_ENABLED!=='true' &&
     process.env.LAYANTARA_PROTECTION_INTAKE_ENABLED!=='true') {
    return NextResponse.json({error:'channel_intake_disabled'},{status:503,
      headers:{'Cache-Control':'no-store'}});
  }
  const secret=process.env.LAYANTARA_WEBHOOK_SECRET??'';
  if(!secret || secret.length<32) {
    return NextResponse.json({error:'channel_configuration_missing'},{status:503});
  }
  const raw=await request.text();
  if(Buffer.byteLength(raw,'utf8')>16384) {
    return NextResponse.json({error:'payload_too_large'},{status:413});
  }
  const timestamp=request.headers.get('x-myuno-timestamp');
  const signature=request.headers.get('x-myuno-signature');
  if(!verifyChannelSignature(raw,timestamp,signature,secret)) {
    return NextResponse.json({error:'unauthorized'},{status:401});
  }
  let event;
  try { event=parseChannelEvent(JSON.parse(raw) as unknown); }
  catch {return NextResponse.json({error:'invalid_channel_event'},{status:400});}
  const protection=event.eventType==='occupancy.protect'||event.eventType==='occupancy.release';
  if((protection && process.env.LAYANTARA_PROTECTION_INTAKE_ENABLED!=='true') ||
     (!protection && process.env.UNIFIED_BOOKING_INTAKE_ENABLED!=='true')) {
    return NextResponse.json({error:'channel_action_disabled'},{status:503,
      headers:{'Cache-Control':'no-store'}});
  }
  const environment=process.env.UNIFIED_CHANNEL_ENVIRONMENT;
  if(environment!=='staging'&&environment!=='production') {
    return NextResponse.json({error:'environment_not_configured'},{status:503});
  }
  try {
    const outcome=await applyChannelEvent(prisma,{event,rawBody:raw,environment});
    return NextResponse.json(outcome,{status:outcome.status==='quarantined'?409:200,
      headers:{'Cache-Control':'no-store'}});
  }catch(error){
    // Fail closed. Never expose stack, crosswalk, guest, financial, or secret data.
    console.error('channel_intake_error',error instanceof Error?error.name:'unknown');
    return NextResponse.json({error:'channel_transaction_failed'},{status:503,
      headers:{'Cache-Control':'no-store'}});
  }
}
