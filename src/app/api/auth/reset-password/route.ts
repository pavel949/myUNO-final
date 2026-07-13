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

    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'Password reset failed' },
      { status: 500 }
    );
  }
}
