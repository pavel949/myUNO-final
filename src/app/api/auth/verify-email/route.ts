import { NextRequest, NextResponse } from 'next/server';
import { verifyEmail } from '@/modules/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Token required' },
        { status: 400 }
      );
    }

    await verifyEmail(token);

    return NextResponse.json(
      { success: true, message: 'Email verified successfully' },
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

    console.error('Email verification error:', error);
    return NextResponse.json(
      { error: 'Email verification failed' },
      { status: 500 }
    );
  }
}
