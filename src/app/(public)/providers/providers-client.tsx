'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ProvidersClientProps {
  labels: Record<string, string>;
  categories: string[];
}

export function ProvidersClient({ labels, categories }: ProvidersClientProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    contactEmail: '',
    contactPhone: '',
    categoryKeys: [] as string[],
  });

  const t = (key: string) => labels[key] || key;
  const getCategoryLabel = (category: string) => labels[`catalog.service_category.${category}`] || category;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCategoryToggle = (category: string) => {
    setFormData((prev) => ({
      ...prev,
      categoryKeys: prev.categoryKeys.includes(category)
        ? prev.categoryKeys.filter((c) => c !== category)
        : [...prev.categoryKeys, category],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/providers/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Error: ${error.error}`);
        return;
      }

      setSubmitted(true);
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (error) {
      console.error('Submission error:', error);
      alert('Failed to submit application');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <main className="min-h-screen bg-surface-paper flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-heading-2 font-bold mb-12">{t('provider.application_received')}</h2>
          <p className="text-body text-text-secondary">{t('provider.application_received_desc')}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface-paper">
      <section className="bg-gradient-to-br from-brand-andaman to-brand-andaman-dark text-surface-ivory py-48 px-24">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-heading-1 font-bold mb-16">{t('provider.become_provider')}</h1>
          <p className="text-body-large text-surface-ivory/90">{t('provider.application_intro')}</p>
        </div>
      </section>

      <section className="py-48 px-24">
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-32">
            {/* Business Name */}
            <div>
              <label className="block text-small text-text-secondary mb-8">
                {t('provider.business_name')} <span className="text-state-error">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full h-48 px-12 rounded-sm bg-white border border-border-line text-text-ink focus:border-brand-andaman focus:ring-2 focus:ring-brand-andaman focus:outline-none"
                placeholder={t('provider.business_name_placeholder')}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-small text-text-secondary mb-8">
                {t('provider.description')}
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="w-full h-96 px-12 py-12 rounded-sm bg-white border border-border-line text-text-ink focus:border-brand-andaman focus:ring-2 focus:ring-brand-andaman focus:outline-none resize-none"
                placeholder={t('provider.description_placeholder')}
              />
            </div>

            {/* Categories */}
            <div>
              <label className="block text-small text-text-secondary mb-12">
                {t('provider.service_categories')} <span className="text-state-error">*</span>
              </label>
              <div className="grid grid-cols-2 gap-12">
                {categories.map((category) => (
                  <label key={category} className="flex items-center gap-8 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.categoryKeys.includes(category)}
                      onChange={() => handleCategoryToggle(category)}
                      className="w-16 h-16 cursor-pointer"
                    />
                    <span className="text-body">{getCategoryLabel(category)}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Contact Email */}
            <div>
              <label className="block text-small text-text-secondary mb-8">
                {t('provider.contact_email')} <span className="text-state-error">*</span>
              </label>
              <input
                type="email"
                name="contactEmail"
                value={formData.contactEmail}
                onChange={handleChange}
                required
                className="w-full h-48 px-12 rounded-sm bg-white border border-border-line text-text-ink focus:border-brand-andaman focus:ring-2 focus:ring-brand-andaman focus:outline-none"
                placeholder="contact@provider.com"
              />
            </div>

            {/* Contact Phone */}
            <div>
              <label className="block text-small text-text-secondary mb-8">
                {t('provider.contact_phone')} <span className="text-state-error">*</span>
              </label>
              <input
                type="tel"
                name="contactPhone"
                value={formData.contactPhone}
                onChange={handleChange}
                required
                className="w-full h-48 px-12 rounded-sm bg-white border border-border-line text-text-ink focus:border-brand-andaman focus:ring-2 focus:ring-brand-andaman focus:outline-none"
                placeholder="+66..."
              />
            </div>

            {/* Submit Button */}
            <div className="pt-16">
              <button
                type="submit"
                disabled={isSubmitting || !formData.categoryKeys.length}
                className="w-full h-48 bg-brand-andaman text-surface-ivory font-medium rounded-sm hover:bg-brand-andaman-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? t('provider.submitting') : t('provider.submit_application')}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
