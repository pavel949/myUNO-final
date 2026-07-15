import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const PRODID = '-//myUNO//Calendar//EN';
const VERSION = '2.0';

function escapeText(text: string): string {
  return text.replace(/\n/g, '\\n').replace(/,/g, '\\,');
}

function formatDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

async function generateICalContent(unitId: string): Promise<string> {
  const [unit, bookings, blockedDates, pricingRules] = await Promise.all([
    prisma.unit.findUnique({
      where: { id: unitId },
      include: { project: true },
    }),
    prisma.booking.findMany({
      where: { unitId, status: { not: 'cancelled' } },
      orderBy: { startDate: 'asc' },
    }),
    prisma.blockedDate.findMany({
      where: { unitId },
      orderBy: { startDate: 'asc' },
    }),
    prisma.pricingRule.findMany({
      where: { unitId },
      orderBy: { startDate: 'asc' },
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
      `UID:booking-${booking.id}@myuno.local`,
      `DTSTAMP:${modified}`,
      `CREATED:${created}`,
      `LAST-MODIFIED:${modified}`,
      `DTSTART;VALUE=DATE:${startDate.toISOString().split('T')[0].replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${endDate.toISOString().split('T')[0].replace(/-/g, '')}`,
      `SUMMARY:Booking #${booking.id.slice(0, 8)} - ${booking.guestIdentityId ? 'Reserved' : 'Hold'}`,
      `DESCRIPTION:Status: ${booking.status}\\nType: ${booking.bookingType}`,
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
      `UID:blocked-${blocked.id}@myuno.local`,
      `DTSTAMP:${modified}`,
      `CREATED:${created}`,
      `LAST-MODIFIED:${modified}`,
      `DTSTART;VALUE=DATE:${startDate.toISOString().split('T')[0].replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${endDate.toISOString().split('T')[0].replace(/-/g, '')}`,
      `SUMMARY:Blocked - ${escapeText(blocked.reason)}`,
      `DESCRIPTION:${blocked.note ? escapeText(blocked.note) : ''}`,
      `TRANSP:TRANSPARENT`,
      'END:VEVENT',
    );
  }

  // Add pricing rules as events (for reference)
  for (const rule of pricingRules) {
    const startDate = new Date(rule.startDate);
    const endDate = new Date(rule.endDate);
    const created = formatDateTime(rule.createdAt);
    const modified = formatDateTime(rule.updatedAt);

    lines.push(
      'BEGIN:VEVENT',
      `UID:pricing-${rule.id}@myuno.local`,
      `DTSTAMP:${modified}`,
      `CREATED:${created}`,
      `LAST-MODIFIED:${modified}`,
      `DTSTART;VALUE=DATE:${startDate.toISOString().split('T')[0].replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${endDate.toISOString().split('T')[0].replace(/-/g, '')}`,
      `SUMMARY:Price: ${(rule.nightlyThb / 100).toFixed(2)} THB${rule.label ? ` - ${escapeText(rule.label)}` : ''}`,
      `TRANSP:TRANSPARENT`,
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { unitId: string } }
) {
  try {
    const { unitId } = params;

    // Verify unit exists and is accessible (no auth check for public iCal export)
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true },
    });

    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
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
