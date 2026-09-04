import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { getAccountProfile } from '@/modules/core';
import AccountClient from './account-client';

export const dynamic = 'force-dynamic';

/**
 * The account surface — profile, language, password, and what reaches you.
 *
 * There was no such page anywhere, for any role. The notification half matters
 * beyond convenience: `NotificationPreference` existed in the schema with
 * nothing able to write it, so a consent could be given and never withdrawn.
 */
export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user?.identityId) {
    redirect('/login?next=/account');
  }

  const profile = await getAccountProfile(prisma, user.identityId);
  if (!profile) redirect('/login?next=/account');

  const labels = await getLabels({
    'account.title': 'Your account',
    'account.profile.title': 'Profile',
    'account.profile.first_name': 'First name',
    'account.profile.last_name': 'Last name',
    'account.profile.email': 'Email',
    'account.profile.phone': 'Phone',
    'account.profile.verified': 'Verified',
    'account.profile.unverified': 'Not verified',
    'account.profile.contact_note':
      'To change your email or phone, contact us — both are used to recover your account.',
    'account.locale.title': 'Language',
    'account.locale.en': 'English',
    'account.locale.ru': 'Русский',
    'account.locale.th': 'ไทย',
    'account.password.title': 'Password',
    'account.password.current': 'Current password',
    'account.password.new': 'New password',
    'account.password.submit': 'Change password',
    'account.password.changed': 'Password changed.',
    'account.password.none': 'This account signs in with a link. Use the reset email to set a password.',
    'account.notifications.title': 'Notifications',
    'account.notifications.intro': 'Choose what reaches you. Some messages cannot be turned off.',
    'account.notifications.in_app': 'In app',
    'account.notifications.email': 'Email',
    'account.notifications.required': 'Always on',
    'account.notifications.required_why':
      'This one carries a legal or payment obligation, so it cannot be silenced.',
    'account.save': 'Save',
    'account.saving': 'Saving…',
    'account.saved': 'Saved.',
    'account.error': 'That did not save. Please try again.',
    'account.privacy.title': 'Your data',
    'account.privacy.export_hint':
      'Download a copy of the personal data we hold about you (PDPA right of access).',
    'account.privacy.export': 'Download my data',
    'account.privacy.exporting': 'Preparing download…',
    'account.privacy.export_error': 'Export failed. Please try again.',
  });

  return <AccountClient profile={profile} labels={labels} />;
}
