import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { submitLead, LEAD_AUDIENCES, type LeadAudience } from '@/modules/comms';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { capturePublicLead } from '@/modules/crm';

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
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      throw createPublicError('invalid_request', 400);
    }

    const { audience, name, contact, message, consent, website } = body as {
      audience?: string;
      name?: string;
      contact?: string;
      message?: string;
      consent?: boolean;
      website?: string;
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
    }).catch((error) => console.error('[CRM lead enrichment]', error));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
