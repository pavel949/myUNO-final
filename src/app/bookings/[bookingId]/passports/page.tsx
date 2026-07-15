import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import PassportsClient from './passports-client';

export const dynamic = 'force-dynamic';

export default async function PassportsPage({
  params,
}: {
  params: { bookingId: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=/bookings/${params.bookingId}/passports`);
  }

  const labels = await getLabels({
    'checkin.passports.title': 'Pre-arrival: passports',
    'checkin.passports.back': '← Back to trip',
    'checkin.passports.why':
      'Thai law requires us to file a TM30 report for every foreign guest within 24 hours of arrival. Your passport details are encrypted, used only for this filing, and deleted after your stay per our retention policy.',
    'checkin.passports.list_title': 'Your party',
    'checkin.passports.empty': 'No guests added yet — add each person staying, including yourself.',
    'checkin.passports.provided': 'Passport provided',
    'checkin.passports.add_title': 'Add a guest',
    'checkin.passports.full_name': 'Full name (as in passport)',
    'checkin.passports.nationality': 'Nationality',
    'checkin.passports.passport_number': 'Passport number',
    'checkin.passports.dob': 'Date of birth',
    'checkin.passports.submit': 'Add guest',
    'checkin.passports.error_generic': 'Could not save. Please try again.',
  });

  return <PassportsClient bookingId={params.bookingId} labels={labels} />;
}
