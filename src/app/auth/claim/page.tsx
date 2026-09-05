import { Suspense } from 'react';
import { getLabels } from '@/lib/i18n';
import ClaimClient from './claim-client';

export const dynamic = 'force-dynamic';

export default async function ClaimPage() {
  const labels = await getLabels({
    'auth.claim.title': 'Activate your account',
    'auth.claim.subtitle': 'Set a password to open your stay space.',
    'auth.claim.claiming_for': 'Account:',
    'auth.claim.password': 'Password (8+ characters)',
    'auth.claim.password_confirm': 'Repeat password',
    'auth.claim.submit': 'Activate & sign in',
    'auth.claim.submitting': 'Activating…',
    'auth.claim.error_mismatch': 'Passwords do not match.',
    'auth.claim.error_generic': 'Could not activate the account. Please try again.',
    'auth.claim.error_invalid': 'This link is invalid or has expired. Ask us for a new one.',
    'auth.claim.loading': 'Checking your link…',
    'auth.claim.request_title': 'Claim your account',
    'auth.claim.request_subtitle':
      'If you have stayed with us before, you already have one. Enter your email and we will send a link to claim it.',
    'auth.claim.request_email': 'Email',
    'auth.claim.request_submit': 'Send claim link',
    'auth.claim.request_sent': 'If that email has a stay with us, a claim link is on its way.',
    'auth.claim.login_instead': 'Have a password already? Log in',
  });

  return (
    <Suspense>
      <ClaimClient
        labels={{
          title: labels['auth.claim.title'],
          subtitle: labels['auth.claim.subtitle'],
          claimingFor: labels['auth.claim.claiming_for'],
          password: labels['auth.claim.password'],
          passwordConfirm: labels['auth.claim.password_confirm'],
          submit: labels['auth.claim.submit'],
          submitting: labels['auth.claim.submitting'],
          errorMismatch: labels['auth.claim.error_mismatch'],
          errorGeneric: labels['auth.claim.error_generic'],
          errorInvalid: labels['auth.claim.error_invalid'],
          loading: labels['auth.claim.loading'],
          requestTitle: labels['auth.claim.request_title'],
          requestSubtitle: labels['auth.claim.request_subtitle'],
          requestEmail: labels['auth.claim.request_email'],
          requestSubmit: labels['auth.claim.request_submit'],
          requestSent: labels['auth.claim.request_sent'],
          loginInstead: labels['auth.claim.login_instead'],
        }}
      />
    </Suspense>
  );
}
