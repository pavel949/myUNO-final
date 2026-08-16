import { NextRequest, NextResponse } from 'next/server';
import { track } from '@/modules/analytics';
import { prisma } from '@/lib/prisma';

interface TrackRequest {
  eventKey: string;
  dimensions?: Record<string, string | number | boolean | null | undefined>;
}

export async function POST(request: NextRequest) {
  try {
    const body: TrackRequest = await request.json();

    if (!body.eventKey) {
      return NextResponse.json(
        { error: 'eventKey is required' },
        { status: 400 }
      );
    }

    // Track the event
    await track(prisma, body.eventKey as any, body.dimensions || {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Track API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to track event' },
      { status: 500 }
    );
  }
}
