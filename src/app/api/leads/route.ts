import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { submitLead, LEAD_AUDIENCES, type LeadAudience } from '@/modules/comms';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { checkRateLimit } from '@/app/libs/rateLimit';
import { capturePublicLead } from '@/modules/crm';

function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * POST /api/leads — public lead form on the audience pages (doc 08 §3).
 * Body: { audience, name, contact, message?, consent, website? }
 * `website` is a honeypot: real visitors never fill it, bots do —
 * a filled honeypot returns success without storing anything.
 * The visitor's details are PII: they go into the lead thread only,
 * never into logs or analytics (doc 12).
 */
export async function POST(req: NextRequest) {
  try {
    // This endpoint is unauthenticated and, on success, opens a thread and
    // alerts every admin (N-29). Without a limit, one script can bury the
    // founder's inbox and the real leads inside it. The honeypot below stops
    // naive bots; this stops the determined ones.
    const limit = checkRateLimit(`leads:ip:${clientIp(req)}`);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'rate_limited' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((limit.retryAfterMs ?? 60_000) / 1000)),
          },
        }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      throw createPublicError('invalid_request', 400);
    }

    const { audience, name, contact, message, consent, website, sourceChannelId, sourceMedium, sourceCampaign, referrerIdentityId } = body as {
      audience?: string;
      name?: string;
      contact?: string;
      message?: string;
      consent?: boolean;
      website?: string;
      sourceChannelId?: string;
      sourceMedium?: string;
      sourceCampaign?: string;
      referrerIdentityId?: string;
    };

    // Honeypot filled → pretend success, store nothing.
    if (website) {
      return NextResponse.json({ ok: true });
    }

    if (!audience || !LEAD_AUDIENCES.includes(audience as LeadAudience)) {
      throw createPublicError('invalid_audience', 400);
    }
    if (typeof name !== 'string' || typeof contact !== 'string') {
      throw createPublicError('missing_fields', 400);
    }
    if (consent !== true) {
      throw createPublicError('consent_required', 400);
    }

    await submitLead(prisma, {
      audience: audience as LeadAudience,
      name,
      contact,
      message: typeof message === 'string' ? message : undefined,
      consent,
    });

    // The thread preserves the raw inquiry for operations; CRM creates the
    // canonical Party and commercial opportunity. A CRM outage must not lose
    // an already accepted inquiry, so this enrichment is best-effort.
    await capturePublicLead(prisma, {
      audience: audience as LeadAudience,
      name,
      contact,
      message: typeof message === 'string' ? message : undefined,
      sourceChannelId: typeof sourceChannelId === 'string' ? sourceChannelId : undefined,
      sourceMedium: typeof sourceMedium === 'string' ? sourceMedium : undefined,
      sourceCampaign: typeof sourceCampaign === 'string' ? sourceCampaign : undefined,
      referrerIdentityId: typeof referrerIdentityId === 'string' ? referrerIdentityId : undefined,
    }).catch((error) => console.error('[CRM lead enrichment]', error));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
