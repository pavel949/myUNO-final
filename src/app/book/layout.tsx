import type { ReactNode } from 'react';
import { StitchConsumerShell } from '@/components/stitch/StitchShells';
import { BookingSteps } from '@/components/BookingSteps';
import { getLabels } from '@/lib/i18n';

export default async function Layout({ children }: { children: ReactNode }) {
  const labels = await getLabels({
    'booking.steps.aria': 'Booking progress',
    'booking.steps.review': 'Review',
    'booking.steps.pay': 'Pay',
    'booking.steps.confirmed': 'Confirmed',
    'booking.steps.current': 'current step',
  });
  return (
    <StitchConsumerShell>
      <BookingSteps
        current={1}
        labels={{
          aria: labels['booking.steps.aria'],
          review: labels['booking.steps.review'],
          pay: labels['booking.steps.pay'],
          confirmed: labels['booking.steps.confirmed'],
          current: labels['booking.steps.current'],
        }}
      />
      {children}
    </StitchConsumerShell>
  );
}
