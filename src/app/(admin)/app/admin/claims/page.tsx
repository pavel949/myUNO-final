import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { getClaimsAwaitingResolution } from '@/modules/finance';
import { getConfig } from '@/modules/config';
import ClaimsAdminClient from './claims-client';

export const dynamic = 'force-dynamic';

/**
 * Damage claims (doc 07 F-DIS-1).
 *
 * `fileDepositClaim`, `approveClaim` and `rejectClaim` were built and tested
 * with no caller anywhere, so a deposit could be pre-authorized and a claim
 * against it could never be raised or resolved. This is the adjudication side;
 * staff file from the ops board.
 */
export default async function AdminClaimsPage() {
  const claims = await getClaimsAwaitingResolution(prisma);
  const approvalWindowHours =
    ((await getConfig(prisma, 'booking.deposit.approval_window_hours').catch(() => undefined)) as
      | number
      | undefined) ?? 48;

  const labels = await getLabels({
    'admin.claims.title': 'Damage claims',
    'admin.claims.subtitle':
      'Claims against a guest deposit, oldest first. Approving takes the money from the card we pre-authorized; rejecting releases it back.',
    'admin.claims.empty': 'No claims are waiting for a decision.',
    'admin.claims.guest': 'Guest',
    'admin.claims.unit': 'Unit',
    'admin.claims.filed_by': 'Filed by',
    'admin.claims.filed_at': 'Filed',
    'admin.claims.claimed': 'Claimed',
    'admin.claims.held': 'Pre-authorized',
    'admin.claims.no_hold': 'No deposit was pre-authorized for this stay.',
    'admin.claims.over_hold':
      'The claim is larger than the amount pre-authorized. Only what was held can be taken.',
    'admin.claims.note': 'Why (the guest may be shown this)',
    'admin.claims.approve': 'Approve and take payment',
    'admin.claims.reject': 'Reject and release',
    'admin.claims.working': 'Working…',
    'admin.claims.note_required': 'A note is required before approving.',
    'admin.claims.window_left': 'left to approve',
    'admin.claims.window_closed':
      'The window to approve this has passed. It can still be rejected, which releases the guest’s money.',
    'admin.claims.window_note':
      'Rejecting is never time-barred: a guest’s money must never sit held because nobody got to the claim.',
    'admin.claims.error': 'That did not work.',
  });

  return (
    <div>
      <h1 className="text-heading-1 font-bold text-text-ink mb-8">{labels['admin.claims.title']}</h1>
      <p className="text-body text-text-secondary mb-24 max-w-3xl">
        {labels['admin.claims.subtitle']}
      </p>

      <ClaimsAdminClient
        approvalWindowHours={approvalWindowHours}
        claims={claims.map((c) => ({
          id: c.id,
          description: c.description,
          claimedAmountThb: c.claimedAmountThb,
          filedAt: c.filedAt.toISOString(),
          status: c.status,
          guestName: c.booking.guestIdentity
            ? `${c.booking.guestIdentity.firstName} ${c.booking.guestIdentity.lastName}`.trim()
            : '—',
          unitName: c.booking.unit?.name ?? '—',
          claimantName: `${c.claimant.firstName} ${c.claimant.lastName}`.trim(),
          preauthAmountThb: c.booking.depositPreauth?.amountThb ?? null,
          preauthStatus: c.booking.depositPreauth?.status ?? null,
        }))}
        labels={labels}
      />
    </div>
  );
}
