import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import { ProspectingAccountType, ProspectingAccountStatus } from '@prisma/client'
import prismadb from '@/app/libs/prismadb'

export const dynamic = 'force-dynamic'

interface CreateProspectingAccountRequest {
  identityId: string
  accountType: ProspectingAccountType
  reasonForContact?: string
  priority?: number
  assignedToIdentityId?: string
  expectedCloseAt?: string
}

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      )
    }

    const url = new URL(req.url)
    const identityId = url.searchParams.get('identityId')
    const status = url.searchParams.get('status') as ProspectingAccountStatus | null
    const accountType = url.searchParams.get('accountType') as ProspectingAccountType | null
    const assignedToId = url.searchParams.get('assignedToId')

    const where: any = {}
    if (identityId) where.identityId = identityId
    if (status) where.status = status
    if (accountType) where.accountType = accountType
    if (assignedToId) where.assignedToIdentityId = assignedToId

    const accounts = await prismadb.prospectingAccount.findMany({
      where,
      include: {
        identity: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { expectedCloseAt: 'asc' },
    })

    return NextResponse.json({
      success: true,
      accounts: accounts.map((account) => ({
        id: account.id,
        identityId: account.identityId,
        identityName: `${account.identity.firstName} ${account.identity.lastName}`,
        identityEmail: account.identity.email,
        accountType: account.accountType,
        status: account.status,
        reasonForContact: account.reasonForContact,
        priority: account.priority,
        assignedTo: account.assignedTo ? {
          id: account.assignedTo.id,
          email: account.assignedTo.email,
          name: `${account.assignedTo.firstName} ${account.assignedTo.lastName}`,
        } : null,
        lastContactedAt: account.lastContactedAt?.toISOString() || null,
        expectedCloseAt: account.expectedCloseAt?.toISOString() || null,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('[PROSPECTING GET]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      )
    }

    const body: CreateProspectingAccountRequest = await req.json()

    if (!body.identityId || !body.accountType) {
      return NextResponse.json(
        { error: 'Missing required fields: identityId, accountType' },
        { status: 400 }
      )
    }

    const validAccountTypes: ProspectingAccountType[] = ['owner', 'developer', 'institutional_partner']
    if (!validAccountTypes.includes(body.accountType)) {
      return NextResponse.json(
        { error: `Invalid account type. Must be one of: ${validAccountTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const identity = await prismadb.identity.findUnique({
      where: { id: body.identityId },
    })

    if (!identity) {
      return NextResponse.json(
        { error: 'Identity not found' },
        { status: 404 }
      )
    }

    if (body.assignedToIdentityId) {
      const assignee = await prismadb.identity.findUnique({
        where: { id: body.assignedToIdentityId },
      })

      if (!assignee) {
        return NextResponse.json(
          { error: 'Assigned person not found' },
          { status: 404 }
        )
      }
    }

    const expectedCloseAt = body.expectedCloseAt ? new Date(body.expectedCloseAt) : null
    if (body.expectedCloseAt && isNaN(expectedCloseAt?.getTime() ?? NaN)) {
      return NextResponse.json(
        { error: 'Invalid date format for expectedCloseAt' },
        { status: 400 }
      )
    }

    const account = await prismadb.prospectingAccount.create({
      data: {
        identityId: body.identityId,
        accountType: body.accountType,
        reasonForContact: body.reasonForContact,
        priority: body.priority ?? 1,
        assignedToIdentityId: body.assignedToIdentityId,
        expectedCloseAt,
      },
      include: {
        identity: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        identityId: account.identityId,
        identityName: `${account.identity.firstName} ${account.identity.lastName}`,
        identityEmail: account.identity.email,
        accountType: account.accountType,
        status: account.status,
        reasonForContact: account.reasonForContact,
        priority: account.priority,
        assignedTo: account.assignedTo ? {
          id: account.assignedTo.id,
          email: account.assignedTo.email,
          name: `${account.assignedTo.firstName} ${account.assignedTo.lastName}`,
        } : null,
        expectedCloseAt: account.expectedCloseAt?.toISOString() || null,
        createdAt: account.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('[PROSPECTING POST]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
