'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';

interface PartyGuest {
  id: string;
  fullName: string;
  nationality: string;
  isLead: boolean;
  passportProvided: boolean;
}

type Labels = Record<string, string>;

export default function PassportsClient({
  bookingId,
  labels,
}: {
  bookingId: string;
  labels: Labels;
}) {
  const [guests, setGuests] = useState<PartyGuest[]>([]);
  const [fullName, setFullName] = useState('');
  const [nationality, setNationality] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [dob, setDob] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/bookings/${bookingId}/guests`);
    if (response.ok) {
      const data = await response.json();
      setGuests(data.guests || []);
    }
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/guests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          nationality,
          passportNumber,
          ...(dob && { dateOfBirth: dob }),
          isLead: guests.length === 0,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || labels['checkin.passports.error_generic']);
      }
      setFullName('');
      setNationality('');
      setPassportNumber('');
      setDob('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['checkin.passports.error_generic']);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-surface-background p-24 md:p-32">
      <div className="max-w-2xl mx-auto">
        <p className="mb-8">
          <Link
            href={`/trips/${bookingId}`}
            className="text-brand-andaman font-semibold hover:underline"
          >
            {labels['checkin.passports.back']}
          </Link>
        </p>
        <h1 className="text-heading-1 font-bold text-text-ink mb-12">
          {labels['checkin.passports.title']}
        </h1>
        <p className="text-body text-text-secondary mb-24">
          {labels['checkin.passports.why']}
        </p>

        <section className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
          <h2 className="text-heading-3 font-bold text-text-ink mb-12">
            {labels['checkin.passports.list_title']}
          </h2>
          {guests.length === 0 ? (
            <p className="text-body text-text-secondary">
              {labels['checkin.passports.empty']}
            </p>
          ) : (
            guests.map((guest) => (
              <div
                key={guest.id}
                className="flex items-center justify-between py-12 border-b border-border-line last:border-b-0"
              >
                <div>
                  <p className="text-body font-semibold text-text-ink">{guest.fullName}</p>
                  <p className="text-small text-text-secondary">{guest.nationality}</p>
                </div>
                {guest.passportProvided && (
                  <span className="text-small text-state-success font-semibold">
                    ✓ {labels['checkin.passports.provided']}
                  </span>
                )}
              </div>
            ))
          )}
        </section>

        <section className="bg-surface-paper border border-border-line rounded-lg p-24">
          <h2 className="text-heading-3 font-bold text-text-ink mb-16">
            {labels['checkin.passports.add_title']}
          </h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-16">
            <Input
              label={labels['checkin.passports.full_name']}
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
              <Input
                label={labels['checkin.passports.nationality']}
                required
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
              />
              <Input
                label={labels['checkin.passports.dob']}
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
            </div>
            <Input
              label={labels['checkin.passports.passport_number']}
              required
              value={passportNumber}
              onChange={(e) => setPassportNumber(e.target.value)}
              error={error || undefined}
            />
            <Button type="submit" isLoading={busy}>
              {labels['checkin.passports.submit']}
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}
