import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextResponse } from 'next/server'
import { CrmLifecycleStage } from '@prisma/client'
import prismadb from '@/app/libs/prismadb'

export const dynamic = 'force-dynamic'

const STAGE_ORDER = [
  'contact',
  'guest',
  'repeat',
  'prospect',
  'investor',
  'buyer',
  'owner',
  'managed',
  'seller',
  'former_client',
] as const

interface PipelineStage {
  stage: CrmLifecycleStage
  count: number
  totalValue: number
  avgValue: number
  profiles: Array<{
    id: string
    email: string | null
    stage: CrmLifecycleStage
    leadScore: number | null
    totalValue: number
  }>
}

export async function GET() {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      )
    }

    // Fetch all profiles with their related identity and opportunities
    const profiles = await prismadb.crmProfile.findMany({
      include: {
        identity: {
          select: {
            id: true,
            email: true,
            crmOpportunities: {
              select: {
                valueThb: true,
              },
            },
          },
        },
      },
    })

    // Group by lifecycle stage and compute metrics
    const stageMap = new Map<CrmLifecycleStage, PipelineStage>()

    // Initialize all stages
    for (const stage of STAGE_ORDER) {
      stageMap.set(stage as CrmLifecycleStage, {
        stage: stage as CrmLifecycleStage,
        count: 0,
        totalValue: 0,
        avgValue: 0,
        profiles: [],
      })
    }

    // Aggregate data
    for (const profile of profiles) {
      const stage = profile.lifecycleStage
      const stageData = stageMap.get(stage)!

      // Calculate total value from opportunities linked to this identity
      const profileValue = profile.identity.crmOpportunities.reduce((sum, opp) => {
        return sum + (opp.valueThb ?? 0)
      }, 0)

      stageData.count += 1
      stageData.totalValue += profileValue

      stageData.profiles.push({
        id: profile.id,
        email: profile.identity?.email || null,
        stage: profile.lifecycleStage,
        leadScore: profile.leadScore,
        totalValue: profileValue,
      })
    }

    // Calculate averages and convert to array
    const pipeline: PipelineStage[] = Array.from(stageMap.values()).map((stage) => ({
      ...stage,
      avgValue: stage.count > 0 ? Math.round(stage.totalValue / stage.count) : 0,
      // Sort profiles by value descending within each stage
      profiles: stage.profiles.sort((a, b) => b.totalValue - a.totalValue),
    }))

    // Calculate totals across pipeline
    const totals = {
      totalProfiles: profiles.length,
      totalValue: pipeline.reduce((sum, stage) => sum + stage.totalValue, 0),
      stageDistribution: pipeline.map((stage) => ({
        stage: stage.stage,
        count: stage.count,
        percentage: profiles.length > 0 ? ((stage.count / profiles.length) * 100).toFixed(1) : '0',
      })),
    }

    return NextResponse.json({
      success: true,
      pipeline,
      totals,
    })
  } catch (error) {
    console.error('[CRM PIPELINE]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
