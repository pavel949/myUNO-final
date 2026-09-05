import { NextResponse } from 'next/server';
import { requireAdmin, failed } from '@/app/libs/onboardingGuard';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const channels = await prisma.channel.findMany({
      orderBy: { name: 'asc' },
    });

    const profiles = await prisma.crmProfile.findMany({
      include: {
        sourceChannel: true,
        identity: { select: { id: true } },
      },
    });

    const metricsMap = new Map<
      string,
      {
        channelId: string;
        channelName: string;
        channelCategory: string;
        profileCount: number;
        ownerCount: number;
        guestCount: number;
        buyerCount: number;
      }
    >();

    for (const channel of channels) {
      metricsMap.set(channel.id, {
        channelId: channel.id,
        channelName: channel.name,
        channelCategory: channel.category,
        profileCount: 0,
        ownerCount: 0,
        guestCount: 0,
        buyerCount: 0,
      });
    }

    for (const profile of profiles) {
      const channelId = profile.sourceChannelId || 'unknown';
      if (!metricsMap.has(channelId)) {
        metricsMap.set(channelId, {
          channelId,
          channelName: 'Unknown',
          channelCategory: 'owned',
          profileCount: 0,
          ownerCount: 0,
          guestCount: 0,
          buyerCount: 0,
        });
      }

      const metrics = metricsMap.get(channelId)!;
      metrics.profileCount += 1;

      if (profile.lifecycleStage === 'owner' || profile.lifecycleStage === 'managed') {
        metrics.ownerCount += 1;
      }
      if (profile.lifecycleStage === 'guest' || profile.lifecycleStage === 'repeat') {
        metrics.guestCount += 1;
      }
      if (profile.lifecycleStage === 'buyer') {
        metrics.buyerCount += 1;
      }
    }

    const attributionMetrics = Array.from(metricsMap.values())
      .filter((m) => m.profileCount > 0)
      .sort((a, b) => b.profileCount - a.profileCount);

    return NextResponse.json({
      success: true,
      metrics: attributionMetrics.map((m) => ({
        ...m,
        conversionRate: {
          toOwner: m.profileCount > 0 ? ((m.ownerCount / m.profileCount) * 100).toFixed(1) : '0',
          toGuest: m.profileCount > 0 ? ((m.guestCount / m.profileCount) * 100).toFixed(1) : '0',
          toBuyer: m.profileCount > 0 ? ((m.buyerCount / m.profileCount) * 100).toFixed(1) : '0',
        },
      })),
      summary: {
        totalProfiles: profiles.length,
        totalChannels: channels.length,
        activeChannels: attributionMetrics.length,
      },
    });
  } catch (error) {
    console.error('[ATTRIBUTION REPORT]', error);
    return failed(error, 'Internal server error');
  }
}
