import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { INQUIRY_COPY, inquiryLabels } from '@/modules/content/inquiry-copy';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { LeadForm } from '@/components/LeadForm';
import { getDestination } from '@/modules/destinations';

/**
 * Server wrapper for the audience-page lead form (doc 08 §3): resolves the
 * shared `audience.lead.*` content keys and mounts the client form.
 */
export async function LeadFormSection({
  audience, initialMessage, projectId, unitId, contextLabel, sourceMedium,
}: {
  audience: 'owners' | 'developers' | 'buyers' | 'renters' | 'mc';
  initialMessage?: string;
  projectId?: string;
  unitId?: string;
  contextLabel?: string;
  sourceMedium?: string;
}) {
  const user = await getCurrentUser();
  const locale = getRequestLocale();
  const destination = getDestination();
  const labels = await getLabels({
    ...inquiryLabels(locale),
    'audience.lead.title': 'Tell us what you need',
    'audience.lead.name': 'Your name',
    'audience.lead.contact': 'How to reach you',
    'audience.lead.contact_hint': 'Phone, WhatsApp, Telegram, or email — whatever suits you.',
    'audience.lead.message': 'Tell us about your situation (optional)',
    'audience.lead.consent':
      'I agree that myUNO stores this information to respond to my enquiry.',
    'audience.lead.consent_required': 'Please tick the consent box so we may contact you.',
    'audience.lead.submit': 'Send',
    'audience.lead.submitting': 'Sending…',
    'audience.lead.success': 'Thank you. We have received your message.',
    'audience.lead.error': 'Something went wrong. Please try again, or email us directly.',
  }, locale, INQUIRY_COPY);

  return (
    <section id="lead-form" className="bg-surface-ivory py-64 px-24">
      <div className="max-w-2xl mx-auto">
        <LeadForm
          key={sourceMedium || 'general'}
          audience={audience}
          initialMessage={initialMessage}
          initialName={user ? [user.firstName, user.lastName].filter(Boolean).join(' ') : undefined}
          initialContact={user?.email ?? undefined}
          projectId={projectId}
          unitId={unitId}
          contextLabel={contextLabel}
          sourceMedium={sourceMedium}
          analytics={{ destination: destination.key, locale }}
          labels={{
            retry: labels['audience.lead.retry'],
            rateLimited: labels['audience.lead.rate_limited'],
            viewConversation: labels['audience.lead.view_conversation'],
            contactFollowup: labels['audience.lead.contact_followup'],
            selectedHome: labels['audience.lead.selected_home'],
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
