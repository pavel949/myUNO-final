import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import prismadb from '@/app/libs/prismadb'
import { ManagementFeeBasis } from '@prisma/client'

export const dynamic = 'force-dynamic'

interface CreateContractRequest {
  unitId: string
  projectId: string
  ownerIdentityId: string
  managementFeeBasis: ManagementFeeBasis
  managementFeeRate?: number
  managementFeeFixedAmount?: number
  performanceFeeEnabled?: boolean
  performanceFeeBasis?: string
  performanceFeeRate?: number
  performanceFeeBaseline?: number
  contractStartDate: string
  contractEndDate?: string
}

export async function POST(req: NextRequest) {
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

    const body: CreateContractRequest = await req.json()

    // Validate required fields
    if (!body.unitId || !body.projectId || !body.ownerIdentityId || !body.managementFeeBasis || !body.contractStartDate) {
      return NextResponse.json(
        { error: 'Missing required fields: unitId, projectId, ownerIdentityId, managementFeeBasis, contractStartDate' },
        { status: 400 }
      )
    }

    // Validate fee basis and amount configuration
    if (body.managementFeeBasis === 'fixed' && !body.managementFeeFixedAmount) {
      return NextResponse.json(
        { error: 'Fixed fee basis requires managementFeeFixedAmount' },
        { status: 400 }
      )
    }

    if (body.managementFeeBasis !== 'fixed' && !body.managementFeeRate) {
      return NextResponse.json(
        { error: `${body.managementFeeBasis} fee basis requires managementFeeRate` },
        { status: 400 }
      )
    }

    // Verify unit, project, and owner exist
    const [unit, project, owner] = await Promise.all([
      prismadb.unit.findUnique({ where: { id: body.unitId } }),
      prismadb.project.findUnique({ where: { id: body.projectId } }),
      prismadb.identity.findUnique({ where: { id: body.ownerIdentityId } }),
    ])

    if (!unit) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      )
    }

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    if (!owner) {
      return NextResponse.json(
        { error: 'Owner identity not found' },
        { status: 404 }
      )
    }

    // Create the contract
    const contract = await prismadb.managementContract.create({
      data: {
        unitId: body.unitId,
        projectId: body.projectId,
        ownerIdentityId: body.ownerIdentityId,
        managementFeeBasis: body.managementFeeBasis,
        managementFeeRate: body.managementFeeRate ? parseFloat(body.managementFeeRate.toString()) : null,
        managementFeeFixedAmount: body.managementFeeFixedAmount,
        performanceFeeEnabled: body.performanceFeeEnabled || false,
        performanceFeeBasis: body.performanceFeeBasis,
        performanceFeeRate: body.performanceFeeRate ? parseFloat(body.performanceFeeRate.toString()) : null,
        performanceFeeBaseline: body.performanceFeeBaseline,
        contractStartDate: new Date(body.contractStartDate),
        contractEndDate: body.contractEndDate ? new Date(body.contractEndDate) : null,
      },
      include: {
        unit: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        ownerIdentity: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    })

    return NextResponse.json({
      success: true,
      contract: {
        id: contract.id,
        unitId: contract.unitId,
        unitName: contract.unit.name,
        projectId: contract.projectId,
        projectName: contract.project.name,
        ownerIdentityId: contract.ownerIdentityId,
        ownerName: `${contract.ownerIdentity.firstName} ${contract.ownerIdentity.lastName}`,
        ownerEmail: contract.ownerIdentity.email,
        managementFeeBasis: contract.managementFeeBasis,
        managementFeeRate: contract.managementFeeRate?.toNumber(),
        managementFeeFixedAmount: contract.managementFeeFixedAmount,
        performanceFeeEnabled: contract.performanceFeeEnabled,
        performanceFeeBasis: contract.performanceFeeBasis,
        performanceFeeRate: contract.performanceFeeRate?.toNumber(),
        performanceFeeBaseline: contract.performanceFeeBaseline,
        contractStartDate: contract.contractStartDate.toISOString().split('T')[0],
        contractEndDate: contract.contractEndDate?.toISOString().split('T')[0] || null,
        status: contract.status,
        createdAt: contract.createdAt.toISOString(),
        updatedAt: contract.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('[CONTRACT CREATE]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

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

    // Get all contracts with related data
    const contracts = await prismadb.managementContract.findMany({
      include: {
        unit: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        ownerIdentity: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { contractStartDate: 'desc' },
    })

    return NextResponse.json({
      success: true,
      contracts: contracts.map((contract) => ({
        id: contract.id,
        unitId: contract.unitId,
        unitName: contract.unit.name,
        projectId: contract.projectId,
        projectName: contract.project.name,
        ownerIdentityId: contract.ownerIdentityId,
        ownerName: `${contract.ownerIdentity.firstName} ${contract.ownerIdentity.lastName}`,
        ownerEmail: contract.ownerIdentity.email,
        managementFeeBasis: contract.managementFeeBasis,
        managementFeeRate: contract.managementFeeRate?.toNumber(),
        managementFeeFixedAmount: contract.managementFeeFixedAmount,
        performanceFeeEnabled: contract.performanceFeeEnabled,
        status: contract.status,
        contractStartDate: contract.contractStartDate.toISOString().split('T')[0],
        contractEndDate: contract.contractEndDate?.toISOString().split('T')[0] || null,
        createdAt: contract.createdAt.toISOString(),
        updatedAt: contract.updatedAt.toISOString(),
      })),
      total: contracts.length,
    })
  } catch (error) {
    console.error('[CONTRACTS LIST]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
