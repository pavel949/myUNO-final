import type { Prisma } from '@prisma/client';
import { LOCALES, type Locale } from '@/modules/content/types';

export class SubmissionDescriptionError extends Error {}

/** Missing locale is retained for legacy drafts; never infer it from the reviewer. */
export function submissionDescriptionLocale(value: unknown): Locale | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !LOCALES.includes(value as Locale)) {
    throw new SubmissionDescriptionError('Choose a supported description language.');
  }
  return value as Locale;
}

export function resolveSubmissionDescription(
  data: Record<string, unknown>,
  reviewedLocale?: unknown,
): { value: string; locale: Locale } | null {
  const value = typeof data.description === 'string' ? data.description.trim() : '';
  if (!value) return null;
  const locale = submissionDescriptionLocale(data.descriptionLocale)
    ?? submissionDescriptionLocale(reviewedLocale);
  if (!locale) throw new SubmissionDescriptionError('Choose the language of the submitted description before conversion.');
  return { value, locale };
}

/** Only for a newly created canonical record; never overwrite existing content. */
export async function createSubmissionDescriptionTx(
  tx: Prisma.TransactionClient,
  input: { key: string; namespace: 'unit' | 'project'; value: string; locale: Locale; actorIdentityId: string },
): Promise<void> {
  await tx.contentKey.create({
    data: {
      key: input.key,
      namespace: input.namespace,
      description: 'Property description preserved from reviewed onboarding submission',
      supportsRich: false,
      translations: {
        create: {
          locale: input.locale,
          value: input.value,
          status: 'needs_review',
          updatedByIdentityId: input.actorIdentityId,
        },
      },
    },
  });
}
