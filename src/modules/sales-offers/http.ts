import { NextResponse } from 'next/server';
import { OfferError } from './contracts';
import { OperatingAccessError } from '@/modules/ops/operating-space-access.service';
export function offerResponse(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });
}
export function offerFailure(error: unknown) {
  if (error instanceof SyntaxError || error instanceof TypeError) return offerResponse({ code: 'INVALID_INPUT' }, 400);
  if (error instanceof OfferError) return offerResponse({ code: error.code }, error.status);
  if (error instanceof OperatingAccessError) return offerResponse({ code: 'FORBIDDEN' }, error.status);
  if ((error as { code?: string })?.code === 'DOUBLE_BOOK') return offerResponse({ code: 'UNAVAILABLE' }, 409);
  if ((error as { code?: string })?.code === 'REQUOTE_REQUIRED') return offerResponse({ code: 'REVALIDATION_REQUIRED' }, 409);
  return offerResponse({ code: 'RETRY_REQUIRED' }, 500);
}
