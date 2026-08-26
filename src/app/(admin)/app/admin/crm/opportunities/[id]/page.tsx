import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { OpportunityDetailClient } from '@/app/components/crm/OpportunityDetailClient';

export const dynamic = 'force-dynamic';

interface OpportunityDetailPageProps {
  params: {
    id: string;
  };
}

export default async function OpportunityDetailPage({ params }: OpportunityDetailPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?next=/app/admin/crm');
  }

  if (!user.isAdmin) {
    redirect('/');
  }

  const opportunity = await prisma.crmOpportunity.findUnique({
    where: { id: params.id },
    include: {
      identity: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      unit: {
        select: {
          id: true,
          name: true,
        },
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        include: {
          identity: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  if (!opportunity) {
    redirect('/app/admin/crm');
  }

  const serializedOpportunity = {
    ...opportunity,
    createdAt: opportunity.createdAt.toISOString(),
    updatedAt: opportunity.updatedAt.toISOString(),
    expectedCloseAt: opportunity.expectedCloseAt?.toISOString() || null,
    nextActionAt: opportunity.nextActionAt?.toISOString() || null,
    wonAt: opportunity.wonAt?.toISOString() || null,
    lostAt: opportunity.lostAt?.toISOString() || null,
    contact: opportunity.identity
      ? {
          id: opportunity.identity.id,
          name: `${opportunity.identity.firstName} ${opportunity.identity.lastName}`.trim(),
          email: opportunity.identity.email,
          phone: opportunity.identity.phone,
          avatar: null,
        }
      : null,
    assignedTo: opportunity.assignedTo
      ? {
          id: opportunity.assignedTo.id,
          name: `${opportunity.assignedTo.firstName} ${opportunity.assignedTo.lastName}`.trim(),
          email: opportunity.assignedTo.email,
        }
      : null,
    identity: undefined,
    activities: opportunity.activities.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      dueAt: a.dueAt?.toISOString() || null,
      completedAt: a.completedAt?.toISOString() || null,
      identity: a.identity
        ? {
            id: a.identity.id,
            name: `${a.identity.firstName} ${a.identity.lastName}`.trim(),
          }
        : null,
    })),
  };

  return (
    <div className="min-h-screen bg-surface-ivory">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-surface-paper border-b border-border-line px-24 py-32">
          <div className="flex items-center gap-16 mb-16">
            <Link
              href="/app/admin/crm"
              className="text-brand-andaman hover:underline font-semibold"
            >
              ← Back to CRM
            </Link>
          </div>
          <h1 className="text-heading-1 font-bold text-text-ink">
            {opportunity.title}
          </h1>
          <p className="text-body text-text-secondary mt-8">
            Opportunity Details
          </p>
        </div>

        {/* Content */}
        <div className="p-24">
          <OpportunityDetailClient opportunity={serializedOpportunity} />
        </div>
      </div>
    </div>
  );
}
