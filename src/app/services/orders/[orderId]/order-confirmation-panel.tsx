'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

export default function OrderConfirmationPanel({ orderId, deadline, labels }: {
  orderId: string; deadline: string; labels: Record<string, string>;
}) {
  const router = useRouter();
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(() => Date.now() >= new Date(deadline).getTime());
  const [error, setError] = useState(false);
  useEffect(() => {
    const check = () => setExpired(Date.now() >= new Date(deadline).getTime());
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, [deadline]);
  const confirm = async () => {
    if (submitting.current || expired) return;
    submitting.current = true;
    setBusy(true);
    setError(false);
    try {
      const response = await fetch(`/api/service-orders/${orderId}/confirm`, { method: 'POST' });
      if (!response.ok) { setError(true); router.refresh(); return; }
      router.refresh();
    } catch { setError(true); }
    finally { submitting.current = false; setBusy(false); }
  };
  if (expired) return <p className="mt-12">{labels['service-order.confirm.expired']}</p>;
  return <div className="mt-12">
    <p className="mb-12 text-body">{labels['service-order.confirm.notice']}</p>
    {error && <p role="alert" className="mb-12 text-state-error">{labels['service-order.confirm.error']}</p>}
    <Button onClick={() => void confirm()} isLoading={busy} disabled={busy}>{labels['service-order.confirm.action']}</Button>
  </div>;
}
