'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';

interface PartyGuest {
  id: string;
  fullName: string;
  nationality: string;
  isLead: boolean;
  passportProvided: boolean;
}

interface ArrivalPassportCaptureModalProps {
  bookingId: string | null;
  guestName: string;
  labels: Record<string, string>;
  onClose: () => void;
  onComplete: () => void;
}

export default function ArrivalPassportCaptureModal({
  bookingId,
  guestName,
  labels,
  onClose,
  onComplete,
}: ArrivalPassportCaptureModalProps) {
  const [guests, setGuests] = useState<PartyGuest[]>([]);
  const [passportByGuestId, setPassportByGuestId] = useState<Record<string, string>>({});
  const [fullName, setFullName] = useState('');
  const [nationality, setNationality] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [dob, setDob] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!bookingId) return;
    const response = await fetch(`/api/bookings/${bookingId}/guests`);
    if (!response.ok) {
      throw new Error(labels['staff.ops.passports_error_generic']);
    }
    const data = await response.json();
    setGuests(data.guests || []);
  }, [bookingId, labels]);

  useEffect(() => {
    if (!bookingId) {
      setGuests([]);
      setPassportByGuestId({});
      setError(null);
      return;
    }
    void load().catch((err) => {
      setError(err instanceof Error ? err.message : labels['staff.ops.passports_error_generic']);
    });
  }, [bookingId, load, labels]);

  if (!bookingId) {
    return null;
  }

  const savePassport = async (bookingGuestId: string, number: string) => {
    const response = await fetch(`/api/bookings/${bookingId}/verify-passports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ bookingGuestId, passportNumber: number }]),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || labels['staff.ops.passports_error_generic']);
    }
  };

  const handleAddGuest = async (event: React.FormEvent) => {
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
        throw new Error(data?.error || labels['staff.ops.passports_error_generic']);
      }
      setFullName('');
      setNationality('');
      setPassportNumber('');
      setDob('');
      await load();
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['staff.ops.passports_error_generic']);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveExisting = async (guest: PartyGuest) => {
    const number = (passportByGuestId[guest.id] || '').trim();
    if (!number) {
      setError(labels['staff.ops.passports_number_required']);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await savePassport(guest.id, number);
      setPassportByGuestId((current) => ({ ...current, [guest.id]: '' }));
      await load();
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['staff.ops.passports_error_generic']);
    } finally {
      setBusy(false);
    }
  };

  const title = labels['staff.ops.passports_title'].replace('{guest_name}', guestName);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-16"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="bg-surface-paper border border-border-line rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-24">
        <div className="flex items-start justify-between gap-16 mb-16">
          <div>
            <h2 className="text-heading-2 font-bold text-text-ink">{title}</h2>
            <p className="text-small text-text-secondary mt-8">
              {labels['staff.ops.passports_hint']}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-small font-semibold text-text-secondary hover:text-text-ink"
          >
            {labels['staff.ops.passports_close']}
          </button>
        </div>

        {error ? (
          <div className="mb-16 bg-state-error-soft border border-state-error rounded-lg p-12">
            <p className="text-small text-state-error">{error}</p>
          </div>
        ) : null}

        <section className="mb-24">
          <h3 className="text-heading-3 font-semibold text-text-ink mb-12">
            {labels['staff.ops.passports_party']}
          </h3>
          {guests.length === 0 ? (
            <p className="text-body text-text-secondary">{labels['checkin.passports.empty']}</p>
          ) : (
            <ul className="space-y-12">
              {guests.map((guest) => (
                <li
                  key={guest.id}
                  className="border border-border-line rounded-lg p-16 flex flex-col gap-12"
                >
                  <div className="flex items-start justify-between gap-12">
                    <div>
                      <p className="text-body font-semibold text-text-ink">{guest.fullName}</p>
                      <p className="text-small text-text-secondary">{guest.nationality}</p>
                    </div>
                    {guest.passportProvided ? (
                      <span className="text-small text-state-success font-semibold shrink-0">
                        {labels['checkin.passports.provided']}
                      </span>
                    ) : null}
                  </div>
                  {!guest.passportProvided ? (
                    <div className="flex flex-col sm:flex-row gap-8">
                      <Input
                        label={labels['checkin.passports.passport_number']}
                        value={passportByGuestId[guest.id] || ''}
                        onChange={(event) =>
                          setPassportByGuestId((current) => ({
                            ...current,
                            [guest.id]: event.target.value,
                          }))
                        }
                      />
                      <div className="flex items-end">
                        <Button
                          size="sm"
                          onClick={() => void handleSaveExisting(guest)}
                          isLoading={busy}
                        >
                          {labels['staff.ops.passports_save_passport']}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="text-heading-3 font-semibold text-text-ink mb-16">
            {labels['checkin.passports.add_title']}
          </h3>
          <form onSubmit={handleAddGuest} className="flex flex-col gap-16">
            <Input
              label={labels['checkin.passports.full_name']}
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
              <Input
                label={labels['checkin.passports.nationality']}
                required
                value={nationality}
                onChange={(event) => setNationality(event.target.value)}
              />
              <Input
                label={labels['checkin.passports.dob']}
                type="date"
                value={dob}
                onChange={(event) => setDob(event.target.value)}
              />
            </div>
            <Input
              label={labels['checkin.passports.passport_number']}
              required
              value={passportNumber}
              onChange={(event) => setPassportNumber(event.target.value)}
            />
            <Button type="submit" isLoading={busy}>
              {labels['checkin.passports.submit']}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
