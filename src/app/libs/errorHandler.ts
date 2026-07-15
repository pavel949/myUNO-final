import { NextResponse } from 'next/server';

interface ErrorWithStatus extends Error {
  statusCode?: number;
  isPublic?: boolean;
}

/**
 * Unified error handler for API routes.
 * Never leaks internal details to the client; logs full context server-side only.
 */
export function handleError(error: unknown): NextResponse {
  const statusCode = getStatusCode(error);
  const isPublic = isPublicError(error);

  // Log full error server-side (includes stack, internals)
  if (error instanceof Error) {
    console.error('API error:', {
      message: error.message,
      stack: error.stack,
      statusCode,
      timestamp: new Date().toISOString(),
    });
  } else {
    console.error('API error (non-Error):', error);
  }

  // Return sanitized response to client (never internal details)
  const clientMessage = getSafeErrorMessage(statusCode, isPublic);

  return NextResponse.json(
    { error: clientMessage },
    { status: statusCode }
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
