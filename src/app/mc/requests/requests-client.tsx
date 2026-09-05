'use client';

import Link from 'next/link';
import BookingRequestRespondActions, {
  type DeclineReasonOption,
} from '@/components/booking/BookingRequestRespondActions';
import BookingRequestInboxDetails from '@/components/booking/BookingRequestInboxDetails';
import type { BookingRequestBreakdownLine } from '@/modules/booking';

interface McBookingRequestRow {
  id: string;
  startDate: string;
  endDate: string;
  totalThb: number;
  requestExpiresAt: string | null;
  adults: number;
  children: number;
  guestName: string;
  unitId: string;
  unitName: string;
  nights: number;
  completedStayCount: number;
  breakdownLines: BookingRequestBreakdownLine[];
}

export default function McRequestsClient({
  requests,
  declineReasons,
  labels,
}: {
  requests: McBookingRequestRow[];
  declineReasons: DeclineReasonOption[];
  labels: Record<string, string>;
}) {
  const respondLabels = {
    approve: labels['mc.requests.approve'],
    decline: labels['mc.requests.decline'],
    decline_reason: labels['mc.requests.decline_reason'],
    decline_reason_required: labels['mc.requests.decline_reason_required'],
    confirm_decline: labels['mc.requests.confirm_decline'],
    error_generic: labels['mc.requests.error_generic'],
  };

  if (requests.length === 0) {
    return <p className="text-body text-text-secondary">{labels['mc.requests.empty']}</p>;
  }

  return (
    <ul className="space-y-0 bg-surface-paper border border-border-line rounded-lg divide-y divide-border-line">
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
                    href={`/mc/units/${request.unitId}`}
                    className="text-brand-andaman hover:underline"
                  >
                    {request.unitName}
                  </Link>
                </span>
              </p>
              <p className="text-small text-text-secondary mt-4">
                {new Date(request.startDate).toLocaleDateString()} —{' '}
                {new Date(request.endDate).toLocaleDateString()} · {party}{' '}
                {labels['mc.requests.guests']}
              </p>
              {request.requestExpiresAt ? (
                <p className="text-small text-state-warning mt-4">
                  {labels['mc.requests.expires']}:{' '}
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
