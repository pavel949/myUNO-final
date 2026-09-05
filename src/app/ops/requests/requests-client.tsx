'use client';

import Link from 'next/link';
import BookingRequestRespondActions, {
  type DeclineReasonOption,
} from '@/components/booking/BookingRequestRespondActions';
import BookingRequestInboxDetails from '@/components/booking/BookingRequestInboxDetails';
import type { BookingRequestBreakdownLine } from '@/modules/booking';

interface OpsBookingRequestRow {
  id: string;
  startDate: string;
  endDate: string;
  requestExpiresAt: string | null;
  adults: number;
  children: number;
  guestName: string;
  projectName?: string;
  unitId: string;
  unitName: string;
  unitCalendarHref: string;
  nights: number;
  completedStayCount: number;
  breakdownLines: BookingRequestBreakdownLine[];
}

export default function OpsRequestsClient({
  requests,
  showProjectName,
  declineReasons,
  labels,
}: {
  requests: OpsBookingRequestRow[];
  showProjectName: boolean;
  declineReasons: DeclineReasonOption[];
  labels: Record<string, string>;
}) {
  const respondLabels = {
    approve: labels['staff.ops.approve_request'],
    decline: labels['staff.ops.decline_request'],
    decline_reason: labels['staff.ops.decline_reason'],
    decline_reason_required: labels['staff.ops.decline_reason_required'],
    confirm_decline: labels['staff.ops.confirm_decline_request'],
    error_generic: labels['staff.ops.error_generic'],
  };

  if (requests.length === 0) {
    return <p className="text-body text-text-secondary">{labels['staff.ops.requests_empty']}</p>;
  }

  return (
    <ul className="space-y-0 bg-surface-paper border border-border-line rounded-lg shadow-card divide-y divide-border-line">
      {requests.map((request) => {
        const party = request.adults + request.children;
        return (
          <li key={request.id} className="p-20 flex flex-col lg:flex-row lg:items-start gap-16">
            <div className="flex-1 min-w-0">
              <p className="text-body font-semibold text-text-ink">
                {request.guestName}
                <span className="text-text-secondary font-normal">
                  {' · '}
                  <Link
                    href={request.unitCalendarHref}
                    className="text-brand-andaman hover:underline"
                  >
                    {request.unitName}
                  </Link>
                </span>
              </p>
              <p className="text-small text-text-secondary mt-4">
                {showProjectName ? (
                  <>
                    {request.projectName}
                    {' · '}
                  </>
                ) : null}
                {new Date(request.startDate).toLocaleDateString()} —{' '}
                {new Date(request.endDate).toLocaleDateString()} · {party}{' '}
                {labels['staff.ops.guest'].toLowerCase()}
              </p>
              {request.requestExpiresAt ? (
                <p className="text-small text-state-warning mt-4">
                  {labels['staff.ops.request_expires']}:{' '}
                  {new Date(request.requestExpiresAt).toLocaleString()}
                </p>
              ) : null}
              <BookingRequestInboxDetails
                nights={request.nights}
                completedStayCount={request.completedStayCount}
                breakdownLines={request.breakdownLines}
                labels={labels}
              />
            </div>
            <BookingRequestRespondActions
              bookingId={request.id}
              labels={respondLabels}
              declineReasons={declineReasons}
            />
          </li>
        );
      })}
    </ul>
  );
}
