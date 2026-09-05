import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const confirmPasswordReset = vi.fn();

vi.mock('@/modules/auth', () => ({
  confirmPasswordReset: (...args: unknown[]) => confirmPasswordReset(...args),
  isAuthError: (error: unknown) =>
    error instanceof Error &&
    'code' in error &&
    'statusCode' in error &&
    typeof (error as { statusCode: unknown }).statusCode === 'number',
}));

import { POST } from './route';
import { AuthError } from '@/modules/auth/types';

function post(body: unknown) {
  return POST(
    new NextRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
}

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    confirmPasswordReset.mockReset();
  });

  it('returns 400 when token or password is missing', async () => {
    const response = await post({ token: '', newPassword: 'NewSecurePass123' });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Token and new password required',
    });
    expect(confirmPasswordReset).not.toHaveBeenCalled();
  });

  it('returns the auth status for an expired link instead of a generic 500', async () => {
    confirmPasswordReset.mockRejectedValue(
      new AuthError('invalid_token', 'Invalid or expired reset link', 401)
    );
    const response = await post({
      token: 'a'.repeat(64),
      newPassword: 'NewSecurePass123',
    });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid or expired reset link',
      code: 'invalid_token',
    });
  });

  it('returns 200 when the password is updated', async () => {
    confirmPasswordReset.mockResolvedValue({ success: true });
    const response = await post({
      token: 'a'.repeat(64),
      newPassword: 'NewSecurePass123',
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
  });
});
