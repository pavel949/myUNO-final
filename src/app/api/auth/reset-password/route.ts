import { NextRequest, NextResponse } from 'next/server';
import { confirmPasswordReset } from '@/modules/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, newPassword } = body;

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: 'Token and new password required' },
        { status: 400 }
      );
    }

    await confirmPasswordReset({ token, newPassword });

    return NextResponse.json(
      { success: true, message: 'Password reset successfully' },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && 'code' in error && 'statusCode' in error) {
      const authError = error as any;
      return NextResponse.json(
        { error: error.message, code: authError.code },
        { status: authError.statusCode }
      );
    }

    console.error('Password reset error:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error,
      env: {
        database_url_set: !!process.env.DATABASE_URL,
        node_env: process.env.NODE_ENV,
      },
    });
    return NextResponse.json(
      { error: 'Password reset failed', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}
