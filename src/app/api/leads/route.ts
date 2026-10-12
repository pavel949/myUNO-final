import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { submitLead, LEAD_AUDIENCES, type LeadAudience } from '@/modules/comms';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { checkRateLimit } from '@/app/libs/rateLimit';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { listPublicDiscoveryUnits } from '@/modules/projects/public-discovery';

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
 * The visitor's details are PII: they go into the canonical CRM and thread,
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

    const { audience, name, contact, message, consent, website, projectId, unitId, sourceChannelId, sourceMedium, sourceCampaign, referrerIdentityId } = body as {
      audience?: string;
      name?: string;
      contact?: string;
      message?: string;
      consent?: boolean;
      website?: string;
      projectId?: string;
      unitId?: string;
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

    let scopedProjectId = typeof projectId === 'string' && projectId.trim() ? projectId.trim() : undefined;
    const scopedUnitId = typeof unitId === 'string' && unitId.trim() ? unitId.trim() : undefined;
    if (scopedUnitId) {
      // Match the canonical public discovery gate, including explicitly imported
      // inquiry-only inventory. Never grant an inquiry on an arbitrary draft ID.
      const unit = (await listPublicDiscoveryUnits({ unitId: scopedUnitId }))[0];
      if (!unit || (scopedProjectId && scopedProjectId !== unit.project.id)) {
        throw createPublicError('invalid_unit', 400);
      }
      scopedProjectId = unit.project.id;
    } else if (scopedProjectId) {
      const project = await prisma.project.findFirst({
        where: { id: scopedProjectId, status: 'live' },
        select: { id: true },
      });
      if (!project) throw createPublicError('invalid_project', 400);
    }

    const requestId = (body as { requestId?: unknown }).requestId;
    if (requestId !== undefined && (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(requestId))) throw createPublicError('invalid_request_id', 400);
    if (!name.trim() || !contact.trim() || name.length > 500 || contact.length > 500 || (typeof message === 'string' && message.length > 4000)) throw createPublicError('invalid_fields', 400);
    const user = await getCurrentUser();
    const result = await submitLead(prisma, {
      audience: audience as LeadAudience,
      name,
      contact,
      message: typeof message === 'string' ? message : undefined,
      projectId: scopedProjectId,
      unitId: scopedUnitId,
      authenticatedIdentityId: user?.identityId,
      consent,
      requestId,
      sourceChannelId: typeof sourceChannelId === 'string' ? sourceChannelId : undefined,
      sourceMedium: typeof sourceMedium === 'string' ? sourceMedium : undefined,
      sourceCampaign: typeof sourceCampaign === 'string' ? sourceCampaign : undefined,
      referrerIdentityId: typeof referrerIdentityId === 'string' ? referrerIdentityId : undefined,
    });

    // Anonymous contacts get no private thread handle or claim of online access.
    return NextResponse.json({ ok: true, ...(user ? { threadId: result.threadId } : {}) });
  } catch (error) {
    return handleError(error);
  }
}
