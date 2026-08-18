import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { CORRELATION_ID_HEADER, reportError, sanitiseCorrelationId } from '@/lib/observability';

interface ErrorWithStatus extends Error {
  statusCode?: number;
  isPublic?: boolean;
}

/**
 * The id middleware issued for this request.
 *
 * `headers()` throws outside a request scope — a background job, or a test
 * calling a handler directly — and an error handler that throws while handling
 * an error is the worst possible failure mode, so this never propagates.
 */
function currentCorrelationId(): string | null {
  try {
    return sanitiseCorrelationId(headers().get(CORRELATION_ID_HEADER));
  } catch {
    return null;
  }
}

/**
 * Unified error handler for API routes.
 *
 * Never leaks internal details to the client, and now records the failure as a
 * structured, PII-scrubbed record carrying the request's correlation id. The id
 * goes back to the caller in the body and on the header, so a user reporting
 * "it broke" can quote a reference that finds the exact request in the log.
 */
export function handleError(error: unknown, context: Record<string, unknown> = {}): NextResponse {
  const statusCode = getStatusCode(error);
  const isPublic = isPublicError(error);
  const correlationId = currentCorrelationId();

  // 4xx are the caller's mistakes and are expected traffic; logging them at
  // error level would drown the failures that actually need attention.
  const { correlationId: reportedId } = reportError(error, {
    ...context,
    correlationId,
    statusCode,
    expected: statusCode < 500,
  });

  const clientMessage = getSafeErrorMessage(statusCode, isPublic);

  return NextResponse.json(
    { error: clientMessage, ...(reportedId ? { reference: reportedId } : {}) },
    {
      status: statusCode,
      headers: reportedId ? { [CORRELATION_ID_HEADER]: reportedId } : undefined,
    }
  );
}

function getStatusCode(error: unknown): number {
  if (error instanceof Error) {
    const err = error as ErrorWithStatus;
    if (err.statusCode) {
      return err.statusCode;
    }
    // Validation errors or known exceptions
    if (error.message.includes('validation') || error.message.includes('invalid')) {
      return 400;
    }
    if (error.message.includes('unauthorized')) {
      return 401;
    }
    if (error.message.includes('not found')) {
      return 404;
    }
  }
  return 500;
}

function isPublicError(error: unknown): boolean {
  if (error instanceof Error) {
    const err = error as ErrorWithStatus;
    return err.isPublic ?? false;
  }
  return false;
}

function getSafeErrorMessage(statusCode: number, isPublic: boolean): string {
  if (isPublic) {
    // Only show client-safe messages
    switch (statusCode) {
      case 400:
        return 'Invalid request. Please check your input.';
      case 401:
        return 'Authentication required.';
      case 403:
        return 'Access denied.';
      case 404:
        return 'Resource not found.';
      case 429:
        return 'Too many requests. Please try again later.';
      default:
        return 'An error occurred. Please try again.';
    }
  }
  // For internal errors (500, etc), never reveal details
  return 'An error occurred. Please try again.';
}

/**
 * Create a public-safe error for the client.
 */
export function createPublicError(
  message: string,
  statusCode: number = 400
): ErrorWithStatus {
  const error = new Error(message) as ErrorWithStatus;
  error.statusCode = statusCode;
  error.isPublic = true;
  return error;
}
