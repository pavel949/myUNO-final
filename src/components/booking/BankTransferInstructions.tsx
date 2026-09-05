'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { SlaCountdown } from '@/components/SlaCountdown';

interface TransferInstructions {
  legalName: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  swift: string;
  taxId: string;
  amountThb: number;
  reference: string;
  expiresAt: string;
}

type Labels = Record<string, string>;

function fill(template: string, params: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

/**
 * Bank-transfer payment instructions for a stay (doc 10 §1, F-GUEST-3).
 * Fetches GET /api/bookings/[id]/transfer-instructions when transfer is offered.
 */
export default function BankTransferInstructions({
  bookingId,
  labels,
}: {
  bookingId: string;
  labels: Labels;
}) {
  const [instructions, setInstructions] = useState<TransferInstructions | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/bookings/${bookingId}/transfer-instructions`);
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (!cancelled) setInstructions(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const copy = async (field: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard unavailable — user can select manually.
    }
  };

  if (loading || !instructions) return null;

  const amountBaht = instructions.amountThb / 100;

  return (
    <div className="bg-surface-ivory border border-border-line rounded-lg p-20 mt-16">
      <h3 className="text-heading-3 font-semibold text-text-ink mb-8">
        {labels['booking.detail.transfer_title']}
      </h3>
      <p className="text-body text-text-secondary mb-16">
        {labels['booking.detail.transfer_intro']}
      </p>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-12 text-body mb-16">
        <div>
          <dt className="text-small text-text-secondary">{labels['booking.detail.transfer_amount']}</dt>
          <dd className="font-semibold text-text-ink">฿{amountBaht.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-small text-text-secondary">{labels['booking.detail.transfer_reference']}</dt>
          <dd className="font-mono text-text-ink flex items-center gap-8">
            {instructions.reference}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => copy('reference', instructions.reference)}
            >
              {copied === 'reference'
                ? labels['booking.detail.transfer_copied']
                : labels['booking.detail.transfer_copy']}
            </Button>
          </dd>
        </div>
        <div>
          <dt className="text-small text-text-secondary">{labels['booking.detail.transfer_bank']}</dt>
          <dd className="text-text-ink">{instructions.bankName}</dd>
        </div>
        <div>
          <dt className="text-small text-text-secondary">{labels['booking.detail.transfer_account']}</dt>
          <dd className="font-mono text-text-ink">{instructions.accountNumber}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-small text-text-secondary">{labels['booking.detail.transfer_account_name']}</dt>
          <dd className="text-text-ink">{instructions.accountName}</dd>
        </div>
        {instructions.swift ? (
          <div>
            <dt className="text-small text-text-secondary">{labels['booking.detail.transfer_swift']}</dt>
            <dd className="font-mono text-text-ink">{instructions.swift}</dd>
          </div>
        ) : null}
      </dl>
      <p className="text-small text-text-secondary mb-8">
        <SlaCountdown
          deadline={instructions.expiresAt}
          leftTemplate={labels['booking.detail.transfer_expires']}
          overdueLabel={labels['booking.detail.transfer_expired']}
        />
      </p>
      <p className="text-small text-text-secondary">
        {fill(labels['booking.detail.transfer_note'], { reference: instructions.reference })}
      </p>
    </div>
  );
}
