import { getLabels } from '@/lib/i18n';
import { LeadForm } from '@/components/LeadForm';

/**
 * Server wrapper for the audience-page lead form (doc 08 §3): resolves the
 * shared `audience.lead.*` content keys and mounts the client form.
 */
export async function LeadFormSection({
  audience,
}: {
  audience: 'owners' | 'developers' | 'buyers' | 'mc';
}) {
  const labels = await getLabels({
    'audience.lead.title': 'Leave your contact — we reply within a day',
    'audience.lead.name': 'Your name',
    'audience.lead.contact': 'How to reach you',
    'audience.lead.contact_hint': 'Phone, WhatsApp, Telegram, or email — whatever suits you.',
    'audience.lead.message': 'Tell us about your situation (optional)',
    'audience.lead.consent':
      'I agree that myUNO stores this information to respond to my enquiry.',
    'audience.lead.consent_required': 'Please tick the consent box so we may contact you.',
    'audience.lead.submit': 'Send',
    'audience.lead.submitting': 'Sending…',
    'audience.lead.success': 'Thank you — we received your message and will reply shortly.',
    'audience.lead.error': 'Something went wrong. Please try again, or email us directly.',
  });

  return (
    <section className="bg-surface-ivory py-64 px-24">
      <div className="max-w-2xl mx-auto">
        <LeadForm
          audience={audience}
          labels={{
            title: labels['audience.lead.title'],
            name: labels['audience.lead.name'],
            contact: labels['audience.lead.contact'],
            contactHint: labels['audience.lead.contact_hint'],
            message: labels['audience.lead.message'],
            consent: labels['audience.lead.consent'],
            consentRequired: labels['audience.lead.consent_required'],
            submit: labels['audience.lead.submit'],
            submitting: labels['audience.lead.submitting'],
            success: labels['audience.lead.success'],
            error: labels['audience.lead.error'],
          }}
        />
      </div>
    </section>
  );
}
