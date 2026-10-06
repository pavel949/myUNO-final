import type { Metadata } from 'next';
import { StitchMain, PublicHero, Panel, LinkButton } from '@/components/premium/StitchPage';
import { getLabels } from '@/lib/i18n';
import { publicPageAlternates } from '@/lib/seo';

export const dynamic = 'force-dynamic';

/**
 * The Ombudsman credential (doc 08 §1, ⚠ Q15 — still open).
 *
 * The credential text is the founder's to write and is not ours to draft: a
 * trust claim invented by a builder is exactly the kind of claim that should
 * never appear. Until Q15 is answered the page states plainly that the
 * credential is not yet published and stays out of the index, so a search
 * engine never quotes a placeholder as a promise.
 */
const OMBUDSMAN_LABELS = {
  'trust.ombudsman.title': 'The Ombudsman',
  'trust.ombudsman.pending':
    'The independent Ombudsman credential is not published yet. When it is, the full terms of the escalation route will appear here.',
  'trust.ombudsman.meanwhile':
    'In the meantime, every complaint raised on the platform is tracked with a visible status and history.',
  'trust.ombudsman.back': 'How trust works at myUNO',
};

const CREDENTIAL_PENDING = /^\[.*\]$/;

export async function generateMetadata(): Promise<Metadata> {
  const labels = await getLabels({
    'trust.ombudsman.title': OMBUDSMAN_LABELS['trust.ombudsman.title'],
    'trust.ombudsman.intro': '',
  });

  const credential = labels['trust.ombudsman.intro'];
  const published = Boolean(credential) && !CREDENTIAL_PENDING.test(credential.trim());

  return {
    title: `${labels['trust.ombudsman.title']} | myUNO`,
    ...(published
      ? { description: credential, alternates: publicPageAlternates('/trust/ombudsman') }
      : { robots: { index: false, follow: true } }),
  };
}

export default async function OmbudsmanPage() {
  const labels = await getLabels({ ...OMBUDSMAN_LABELS, 'trust.ombudsman.intro': '' });

  const credential = labels['trust.ombudsman.intro'];
  const published = Boolean(credential) && !CREDENTIAL_PENDING.test(credential.trim());

  return (
    <StitchMain narrow>
      <PublicHero dark title={labels['trust.ombudsman.title']} />
      <Panel>
        {published ? (
          <p className="text-body text-text-secondary">{credential}</p>
        ) : (
          <div className="space-y-12">
            <p className="text-body text-text-secondary">{labels['trust.ombudsman.pending']}</p>
            <p className="text-body text-text-secondary">{labels['trust.ombudsman.meanwhile']}</p>
          </div>
        )}
      </Panel>
      <LinkButton href="/trust" variant="ghost">← {labels['trust.ombudsman.back']}</LinkButton>
    </StitchMain>
  );
}
