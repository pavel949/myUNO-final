'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Input } from './Input';
import { Button } from './Button';
import { deviceClass, trackPublicInteraction } from '@/components/public-analytics';

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
  viewConversation?: string;
  contactFollowup?: string;
  selectedHome?: string;
  retry?: string;
  rateLimited?: string;
}

interface LeadFormProps {
  audience: 'owners' | 'developers' | 'buyers' | 'renters' | 'mc';
  audienceChoice?: { label: string; rent: string; buy: string };
  initialMessage?: string;
  initialName?: string;
  initialContact?: string;
  projectId?: string;
  unitId?: string;
  contextLabel?: string;
  sourceMedium?: string;
  analytics?: { destination: string; locale: string };
  labels: LeadFormLabels;
}

/**
 * Public lead form (doc 08 §3): name, contact, free-text context, consent.
 * Posts to /api/leads; includes an invisible honeypot field for bots.
 */
export function LeadForm({ audience: initialAudience, audienceChoice, labels, initialMessage = '', initialName = '', initialContact = '', projectId, unitId, contextLabel, sourceMedium, analytics }: LeadFormProps) {
  const [audience, setAudience] = useState(initialAudience);
  const [name, setName] = useState(initialName);
  const [contact, setContact] = useState(initialContact);
  const [message, setMessage] = useState(initialMessage);
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [consentError, setConsentError] = useState(false);
  const [errorText, setErrorText] = useState(labels.error);
  const started = useRef(false);
  const submitting = useRef(false);
  const request = useRef<{ payload: string; id: string } | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);

  const markStarted = () => {
    if (started.current || !analytics) return;
    started.current = true;
    trackPublicInteraction('lead_started', {
      destination: analytics.destination,
      locale: analytics.locale,
      audience,
      projectId,
      source: 'lead_form',
      deviceClass: deviceClass(),
    });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    if (!consent) {
      setConsentError(true);
      return;
    }
    setConsentError(false);
    submitting.current = true;
    setErrorText(labels.retry || labels.error);
    setState('submitting');
    const payload = JSON.stringify({ audience, name, contact, message, consent, website, projectId, unitId, sourceMedium });
    // Keep the same request ID after a lost acknowledgement; changed fields start
    // a new inquiry. No contact data is written to browser storage.
    if (!request.current || request.current.payload !== payload) request.current = { payload, id: crypto.randomUUID() };
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...JSON.parse(payload), requestId: request.current.id }),
      });
      if (!res.ok) {
        setErrorText(res.status === 429 ? (labels.rateLimited || labels.error) : (labels.retry || labels.error));
        throw new Error('failed');
      }
      const result = await res.json();
      if (result.ok !== true) throw new Error('failed');
      setThreadId(typeof result.threadId === 'string' ? result.threadId : null);
      setState('success');
    } catch {
      setState('error');
    } finally {
      submitting.current = false;
    }
  };

  if (state === 'success') {
    return (
      <div
        className="bg-surface-background border border-border-line rounded-lg p-32 text-center"
        role="status"
      >
        <p className="text-body text-text-ink font-semibold">{labels.success}</p>
        {threadId ? (
          <Link href={`/messages/${encodeURIComponent(threadId)}`} className="mt-16 inline-flex min-h-48 items-center rounded-lg bg-brand-andaman px-24 text-white">
            {labels.viewConversation || 'View conversation'}
          </Link>
        ) : labels.contactFollowup ? <p className="mt-12 text-small text-text-secondary">{labels.contactFollowup}</p> : null}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-24">
      <h3 className="text-heading-2 font-bold text-text-ink">{labels.title}</h3>
      {contextLabel && <div className="stitch-panel p-16">
        {labels.selectedHome && <p className="text-small text-text-secondary">{labels.selectedHome}</p>}
        <p className="font-semibold text-text-ink">{contextLabel}</p>
      </div>}

      {audienceChoice && <label className="flex flex-col gap-8 text-small text-text-secondary">
        {audienceChoice.label}
        <select value={audience} disabled={state === 'submitting'} onChange={event => setAudience(event.target.value as 'renters' | 'buyers')} className="min-h-48 rounded-lg border border-border-line bg-surface-paper px-12 text-text-ink">
          <option value="renters">{audienceChoice.rent}</option>
          <option value="buyers">{audienceChoice.buy}</option>
        </select>
      </label>}
      <Input
        label={labels.name}
        required
        value={name}
        onFocus={markStarted}
        onChange={(e) => setName(e.target.value)}
        maxLength={500}
        autoComplete="name"
      />
      <Input
        label={labels.contact}
        required
        helpText={labels.contactHint}
        value={contact}
        onFocus={markStarted}
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
          onFocus={markStarted}
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
          {errorText}
        </p>
      ) : null}

      <Button type="submit" disabled={state === 'submitting'}>
        {state === 'submitting' ? labels.submitting : labels.submit}
      </Button>
    </form>
  );
}
