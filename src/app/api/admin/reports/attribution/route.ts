import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextResponse } from 'next/server'
import prismadb from '@/app/libs/prismadb'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    if (!currentUser.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 401 }
      )
    }

    // Get all channels
    const channels = await prismadb.channel.findMany({
      orderBy: { name: 'asc' },
    })

    // Get CRM profiles with source channel attribution
    const profiles = await prismadb.crmProfile.findMany({
      include: {
        sourceChannel: true,
        identity: {
          select: {
            id: true,
          },
        },
      },
    })

    // Build attribution metrics by channel
    const metricsMap = new Map<string, {
      channelId: string
      channelName: string
      channelCategory: string
      profileCount: number
      ownerCount: number
      guestCount: number
      buyerCount: number
    }>()

    // Initialize with all channels
    for (const channel of channels) {
      metricsMap.set(channel.id, {
        channelId: channel.id,
        channelName: channel.name,
        channelCategory: channel.category,
        profileCount: 0,
        ownerCount: 0,
        guestCount: 0,
        buyerCount: 0,
      })
    }

    // Count profiles by channel and lifecycle stage
    for (const profile of profiles) {
      const channelId = profile.sourceChannelId || 'unknown'
      if (!metricsMap.has(channelId)) {
        metricsMap.set(channelId, {
          channelId,
          channelName: 'Unknown',
          channelCategory: 'owned',
          profileCount: 0,
          ownerCount: 0,
          guestCount: 0,
          buyerCount: 0,
        })
      }

      const metrics = metricsMap.get(channelId)!
      metrics.profileCount += 1

      if (profile.lifecycleStage === 'owner' || profile.lifecycleStage === 'managed') {
        metrics.ownerCount += 1
      }
      if (profile.lifecycleStage === 'guest' || profile.lifecycleStage === 'repeat') {
        metrics.guestCount += 1
      }
      if (profile.lifecycleStage === 'buyer') {
        metrics.buyerCount += 1
      }
    }

    const attributionMetrics = Array.from(metricsMap.values())
      .filter(m => m.profileCount > 0)
      .sort((a, b) => b.profileCount - a.profileCount)

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
    })
  } catch (error) {
    console.error('[ATTRIBUTION REPORT]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
