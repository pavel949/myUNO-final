'use client';

import { useState } from 'react';
import { Button } from '@/components';
import { ServiceOrderRatingModal } from '@/components/instay/ServiceOrderRatingModal';

/**
 * Rating a fulfilled order from the order itself.
 *
 * The rating flow existed and was reachable only from the in-stay home space
 * (`ActiveOrdersList`). That is the right place *during* a stay — but a
 * service is often rated afterwards, and after check-out the home space is no
 * longer where anyone goes. The order detail page is, and it offered payment,
 * a dispute and a no-show report but no way to say the service was good.
 *
 * Same modal, same route, second door. `rated` comes from the detail route so
 * a reload does not offer a second review the API would refuse.
 */
export default function OrderRatingPanel({
  orderId,
  rated,
  labels,
}: {
  orderId: string;
  rated: boolean;
  labels: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  if (rated || done) {
    return (
      <p className="text-small text-state-success">{labels['service-order.rating.thanks']}</p>
    );
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {labels['service-order.rating.action']}
      </Button>
      {open && (
        <ServiceOrderRatingModal
          orderId={orderId}
          labels={labels}
          onClose={() => setOpen(false)}
          onSuccess={() => {
            setOpen(false);
            setDone(true);
          }}
        />
      )}
    </>
  );
}
