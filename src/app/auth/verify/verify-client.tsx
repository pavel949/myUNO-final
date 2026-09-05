'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AuthVerifyClient({
  token,
  labels,
}: {
  token?: string;
  labels: Record<string, string>;
}) {
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token) {
      setVerified(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (!cancelled) setVerified(response.ok);
      } catch {
        if (!cancelled) setVerified(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (verified === null) {
    return (
      <p className="text-body text-text-secondary mb-32">{labels['auth.verify.loading']}</p>
    );
  }

  return (
    <>
      <p className="text-body text-text-secondary mb-32">
        {verified ? labels['auth.verify.success'] : labels['auth.verify.failure']}
      </p>
      <Link href="/login" className="text-brand-andaman font-semibold hover:underline">
        {labels['auth.verify.go_login']}
      </Link>
    </>
  );
}
