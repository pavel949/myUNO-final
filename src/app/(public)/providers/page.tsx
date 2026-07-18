import { getLabels } from '@/lib/i18n';
import { ProvidersClient } from './providers-client';

const SERVICE_CATEGORIES = [
  'transfer',
  'cleaning',
  'chef',
  'tours',
  'concierge',
  'maintenance',
];

export const metadata = {
  title: 'Become a Service Provider - myUNO',
  description: 'Join our network of vetted service providers',
};

export default async function ProvidersPage() {
  const labels = await getLabels({
    'provider.become_provider': 'Become a Service Provider',
    'provider.application_intro': 'Join our network of vetted service providers',
    'provider.business_name': 'Business Name',
    'provider.business_name_placeholder': 'Your business name',
    'provider.description': 'Description',
    'provider.description_placeholder': 'Tell us about your business',
    'provider.service_categories': 'Service Categories',
    'provider.contact_email': 'Contact Email',
    'provider.contact_phone': 'Contact Phone',
    'provider.submit_application': 'Submit Application',
    'provider.submitting': 'Submitting...',
    'provider.application_received': 'Application Received',
    'provider.application_received_desc': 'Thank you for applying. We will review your application and get back to you soon.',
    'catalog.service_category.transfer': 'Transfer',
    'catalog.service_category.cleaning': 'Cleaning',
    'catalog.service_category.chef': 'Chef',
    'catalog.service_category.tours': 'Tours',
    'catalog.service_category.concierge': 'Concierge',
    'catalog.service_category.maintenance': 'Maintenance',
  });

  return (
    <ProvidersClient
      labels={labels}
      categories={SERVICE_CATEGORIES}
    />
  );
}
