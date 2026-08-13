'use client';

import { useState } from 'react';
import { Input } from './Input';
import { Button } from './Button';

export interface LeadFormLabels {
  title: string;
  name: string;
  contact: string;
  contactHint: string;
  message: string;
  consent: string;
  submit: string;
  submitting: string;
  success: string;
  error: string;
  consentRequired: string;
}

interface LeadFormProps {
  audience: 'owners' | 'developers' | 'buyers' | 'mc';
  labels: LeadFormLabels;
}

/**
 * Public lead form (doc 08 §3): name, contact, free-text context, consent.
 * Posts to /api/leads; includes an invisible honeypot field for bots.
 */
export function LeadForm({ audience, labels }: LeadFormProps) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [consentError, setConsentError] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) {
      setConsentError(true);
      return;
    }
    setConsentError(false);
    setState('submitting');
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audience, name, contact, message, consent, website }),
      });
      if (!res.ok) throw new Error('failed');
      setState('success');
    } catch {
      setState('error');
    }
  };

  if (state === 'success') {
    return (
      <div
        className="bg-surface-background border border-border-line rounded-lg p-32 text-center"
        role="status"
      >
        <p className="text-body text-text-ink font-semibold">{labels.success}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-24">
      <h3 className="text-heading-2 font-bold text-text-ink">{labels.title}</h3>

      <Input
        label={labels.name}
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={500}
        autoComplete="name"
      />
      <Input
        label={labels.contact}
        required
        helpText={labels.contactHint}
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        maxLength={500}
      />

      <div className="flex flex-col gap-8">
        <label htmlFor={`lead-message-${audience}`} className="text-small text-text-stone">
          {labels.message}
        </label>
        <textarea
          id={`lead-message-${audience}`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={4000}
          rows={4}
          className="px-16 py-12 rounded-sm bg-surface-paper border border-border-line text-text-ink placeholder:text-text-stone-2 focus:border-brand-andaman focus:ring-2 focus:ring-brand-andaman focus:ring-offset-2 focus:outline-none"
        />
      </div>

      {/* Honeypot — hidden from real visitors */}
      <div className="hidden" aria-hidden="true">
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <label className="flex items-start gap-12 cursor-pointer">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => {
            setConsent(e.target.checked);
            if (e.target.checked) setConsentError(false);
          }}
          className="mt-4 h-20 w-20 rounded-sm border-border-line text-brand-andaman focus:ring-brand-andaman"
        />
        <span className="text-small text-text-secondary">{labels.consent}</span>
      </label>
      {consentError ? (
        <p className="text-small text-state-error" role="alert">
          {labels.consentRequired}
        </p>
      ) : null}

      {state === 'error' ? (
        <p className="text-small text-state-error" role="alert">
          {labels.error}
        </p>
      ) : null}

      <Button type="submit" disabled={state === 'submitting'}>
        {state === 'submitting' ? labels.submitting : labels.submit}
      </Button>
    </form>
  );
}
