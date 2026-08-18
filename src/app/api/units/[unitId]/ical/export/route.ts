import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIcalFeedToken, icalEventUid } from '@/modules/integrations/ical-token';

// No dynamic request API in this GET — force it dynamic so OTA calendar
// consumers always see current availability, not a build-time snapshot.
export const dynamic = 'force-dynamic';

const PRODID = '-//myUNO//Calendar//EN';
const VERSION = '2.0';

function escapeText(text: string): string {
  return text.replace(/\n/g, '\\n').replace(/,/g, '\\,');
}

function formatDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

async function generateICalContent(unitId: string): Promise<string> {
  // An availability feed answers one question: which nights are taken. It used
  // to also publish nightly prices, booking status and type, and operators'
  // free-text notes on blocks — commercially sensitive, and none of it needed by
  // an OTA. Pricing rules are no longer read at all.
  const [unit, bookings, blockedDates] = await Promise.all([
    prisma.unit.findUnique({
      where: { id: unitId },
      include: { project: true },
    }),
    prisma.booking.findMany({
      where: { unitId, status: { not: 'cancelled' } },
      orderBy: { startDate: 'asc' },
      select: { id: true, startDate: true, endDate: true, createdAt: true, updatedAt: true },
    }),
    prisma.blockedDate.findMany({
      where: { unitId },
      orderBy: { startDate: 'asc' },
      select: { id: true, startDate: true, endDate: true, createdAt: true, updatedAt: true },
    }),
  ]);

  if (!unit) {
    throw new Error('Unit not found');
  }

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    `VERSION:${VERSION}`,
    `PRODID:${PRODID}`,
    `CALSCALE:GREGORIAN`,
    `METHOD:PUBLISH`,
    `X-WR-CALNAME:${escapeText(unit.name)} - ${unit.project.name}`,
    `X-WR-TIMEZONE:${unit.project.timezone}`,
    `VTIMEZONE:${unit.project.timezone}`,
  ];

  // Add bookings as events
  for (const booking of bookings) {
    const startDate = new Date(booking.startDate);
    const endDate = new Date(booking.endDate);
    const created = formatDateTime(booking.createdAt);
    const modified = formatDateTime(booking.updatedAt);

    lines.push(
      'BEGIN:VEVENT',
      `UID:${icalEventUid('booking', booking.id)}`,
      `DTSTAMP:${modified}`,
      `CREATED:${created}`,
      `LAST-MODIFIED:${modified}`,
      `DTSTART;VALUE=DATE:${startDate.toISOString().split('T')[0].replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${endDate.toISOString().split('T')[0].replace(/-/g, '')}`,
      // "Unavailable" and nothing more — the convention OTAs expect, and it
      // keeps guest-linked detail out of a URL-authenticated feed.
      `SUMMARY:Unavailable`,
      `TRANSP:OPAQUE`,
      'END:VEVENT',
    );
  }

  // Add blocked dates as events
  for (const blocked of blockedDates) {
    const startDate = new Date(blocked.startDate);
    const endDate = new Date(blocked.endDate);
    const created = formatDateTime(blocked.createdAt);
    const modified = formatDateTime(blocked.updatedAt);

    lines.push(
      'BEGIN:VEVENT',
      `UID:${icalEventUid('blocked', blocked.id)}`,
      `DTSTAMP:${modified}`,
      `CREATED:${created}`,
      `LAST-MODIFIED:${modified}`,
      `DTSTART;VALUE=DATE:${startDate.toISOString().split('T')[0].replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${endDate.toISOString().split('T')[0].replace(/-/g, '')}`,
      // The reason and the operator's note are internal. A blocked night is
      // simply unavailable, and it must read OPAQUE — TRANSPARENT told the
      // consuming calendar the night was free, which is the opposite of a block.
      `SUMMARY:Unavailable`,
      `TRANSP:OPAQUE`,
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

export async function GET(
  req: NextRequest,
  { params }: { params: { unitId: string } }
) {
  try {
    const { unitId } = params;

    // The feed is fetched by Airbnb, Booking.com and Google Calendar on a
    // schedule, with no session — so the URL carries the authority. Until this
    // gate existed, anyone holding a unit UUID could read that unit's occupancy.
    // 404 rather than 401: a wrong token must not confirm the unit exists.
    // Parsed from req.url rather than req.nextUrl: the latter exists only on a
    // NextRequest, and the route handler is also invoked directly with a plain
    // Request by the integration tests.
    const token = new URL(req.url).searchParams.get('token');
    if (!verifyIcalFeedToken(unitId, token)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true },
    });

    if (!unit) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const iCalContent = await generateICalContent(unitId);

    return new NextResponse(iCalContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="unit-${unitId}.ics"`,
      },
    });
  } catch (error) {
    console.error('[iCal export] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to export calendar',
      },
      { status: 500 }
    );
  }
}
