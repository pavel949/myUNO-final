import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { track } from '@/modules/analytics';
import { checkRateLimit } from '@/app/libs/rateLimit';

const PUBLIC_EVENT_KEYS = [
  'intent_selected',
  'search_submitted',
  'result_opened',
  'owner_goal_selected',
  'lead_started',
] as const;

type PublicEventKey = (typeof PUBLIC_EVENT_KEYS)[number];
const PUBLIC_EVENTS = new Set<string>(PUBLIC_EVENT_KEYS);

function isPublicEventKey(value: unknown): value is PublicEventKey {
  return typeof value === 'string' && PUBLIC_EVENTS.has(value);
}

const ALLOWED_DIMENSIONS = new Set([
  'destination',
  'locale',
  'currency',
  'deviceClass',
  'intent',
  'source',
  'placementId',
  'entityType',
  'entityId',
  'offeringId',
  'areaId',
  'projectId',
  'unitId',
  'serviceId',
  'audience',
  'hasDates',
]);

function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function sanitizeDimensions(input: unknown): Record<string, string | number | boolean | null> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const output: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!ALLOWED_DIMENSIONS.has(key)) continue;
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      output[key] = typeof value === 'string' ? value.slice(0, 120) : value;
    }
  }
  return output;
}

/**
 * Low-risk public interaction analytics only.
 * Business outcomes (search result truth, quote success, lead submission,
 * booking confirmation, payments) are server-emitted at their canonical
 * transition and are intentionally rejected here.
 */
export async function POST(req: NextRequest) {
  const limit = checkRateLimit('analytics:public:' + clientIp(req), {
    maxAttempts: 120,
    windowMs: 60_000,
    backoffMs: 60_000,
  });
  if (!limit.allowed) return NextResponse.json({ ok: true }, { status: 202 });

  const body = await req.json().catch(() => null);
  const eventKey = body?.eventKey;
  if (!isPublicEventKey(eventKey)) {
    return NextResponse.json({ error: 'unsupported_event' }, { status: 400 });
  }

  const dimensions = sanitizeDimensions(body?.dimensions);
  await track(prisma, eventKey, dimensions);
  return NextResponse.json({ ok: true }, { status: 202 });
}
