import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import { getStaysOpenToClaim } from '@/modules/finance';
import FileClaimClient from './file-claim-client';
import { getStaffProjectIds } from '@/app/libs/projectScope';

export const dynamic = 'force-dynamic';

/**
 * Filing a damage claim (doc 07 F-DIS-1, staff side).
 *
 * Only stays still inside the filing window appear. The window is short by
 * design, so the question a staff member has after a check-out is "can I still
 * raise this, and for how long" — a list including stays that can no longer be
 * claimed against would answer the wrong question.
 */
export default async function OpsClaimsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/ops/claims');

  const staffProjectIds = getStaffProjectIds(user);
  const isStaff = user.isAdmin || staffProjectIds.length > 0;
  if (!isStaff) redirect('/');

  const stays = user.isAdmin
    ? await getStaysOpenToClaim(prisma)
    : (await Promise.all(staffProjectIds.map((projectId) => getStaysOpenToClaim(prisma, projectId))))
        .flat()
        .sort((a, b) => a.checkedOutAt.getTime() - b.checkedOutAt.getTime());

  const labels = await getLabels({
    'staff.claims.title': 'Damage claims',
    'staff.claims.subtitle':
      'Stays that have just checked out. Raise a claim while the window is open — after that the guest’s deposit is released automatically.',
    'staff.claims.back': '← Ops board',
    'staff.claims.empty': 'No recent check-outs are still open to a claim.',
    'staff.claims.guest': 'Guest',
    'staff.claims.unit': 'Unit',
    'staff.claims.checked_out': 'Checked out',
    'staff.claims.hours_left': 'hours left to file',
    'staff.claims.held': 'Deposit pre-authorized',
    'staff.claims.no_hold': 'No deposit was pre-authorized, so there is nothing to claim against.',
    'staff.claims.existing': 'A claim has already been filed for this stay.',
    'staff.claims.what': 'What is damaged or missing',
    'staff.claims.amount': 'Amount to claim (฿)',
    'staff.claims.file': 'File the claim',
    'staff.claims.filing': 'Filing…',
    'staff.claims.filed': 'Filed. An admin will decide.',
    'staff.claims.over_hold': 'More than the deposit held — only what was held can be taken.',
    'staff.claims.error': 'That did not work.',
    'staff.claims.note':
      'A claim is a request, not a charge. An admin reviews it before anything is taken from the guest.',
  });

  return (
    <main className="min-h-screen bg-surface-background p-24 md:p-32">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-heading-1 font-bold text-text-ink">{labels['staff.claims.title']}</h1>
          <Link href="/ops" className="text-brand-andaman font-semibold hover:underline">
            {labels['staff.claims.back']}
          </Link>
        </div>
        <p className="text-body text-text-secondary mb-24">{labels['staff.claims.subtitle']}</p>

        <FileClaimClient
          stays={stays.map((s) => ({
            bookingId: s.bookingId,
            unitName: s.unitName,
            guestName: s.guestName,
            checkedOutAt: s.checkedOutAt.toISOString(),
            hoursLeft: s.hoursLeft,
            preauthAmountThb: s.preauthAmountThb,
            existingClaims: s.existingClaims,
          }))}
          labels={labels}
        />

        <p className="mt-24 text-small text-text-secondary">{labels['staff.claims.note']}</p>
      </div>
    </main>
  );
}
