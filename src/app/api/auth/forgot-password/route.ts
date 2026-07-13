import { NextRequest, NextResponse } from 'next/server';
import { requestPasswordReset } from '@/modules/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email required' },
        { status: 400 }
      );
    }

    // Always return success to not leak email existence
    await requestPasswordReset({ email });

    return NextResponse.json(
      { success: true, message: 'If an account exists, a reset link has been sent' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Password reset request error:', error);
    return NextResponse.json(
      { success: true, message: 'If an account exists, a reset link has been sent' },
      { status: 200 }
    );
  }
}
