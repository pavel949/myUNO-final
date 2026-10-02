import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb, createIdentity } from '@/test/util';
import {
  createResearchDraft,
  addResearchSource,
  submitResearchForReview,
  reviewResearchPublication,
  publishResearchPublication,
  addResearchCorrection,
} from './research.service';

describe('governed research publication', () => {
  beforeEach(async () => { await resetDb(); });

  it('requires numbered evidence and an independent reviewer before public release', async () => {
    const author = await createIdentity({ isAdmin: true, firstName: 'Author' });
    const reviewer = await createIdentity({ isAdmin: true, firstName: 'Reviewer' });
    const draft = await createResearchDraft(db, {
      destinationKey: 'phuket',
      slug: 'market-note',
      locale: 'en',
      title: 'Market note',
      summary: 'Sourced summary',
      body: 'Evidence-backed body',
      authorIdentityId: author.id,
    });

    await expect(submitResearchForReview(db, draft.id, author.id)).rejects.toThrow(/source/i);
    const source = await addResearchSource(db, draft.id, {
      title: 'Primary source',
      publisher: 'Authority',
      url: 'https://example.com/source',
    });
    expect(source.sourceNumber).toBe(1);

    await submitResearchForReview(db, draft.id, author.id);
    await expect(addResearchSource(db, draft.id, { title: 'Late source', url: 'https://example.com/late' }))
      .rejects.toThrow(/frozen/i);
    await expect(reviewResearchPublication(db, draft.id, author.id)).rejects.toThrow(/another identity/i);

    await reviewResearchPublication(db, draft.id, reviewer.id);
    const published = await publishResearchPublication(db, draft.id, reviewer.id);
    expect(published.status).toBe('published');
    expect(published.publishedAt).not.toBeNull();
  });

  it('keeps public corrections append-only', async () => {
    const author = await createIdentity({ isAdmin: true });
    const reviewer = await createIdentity({ isAdmin: true });
    const draft = await createResearchDraft(db, {
      destinationKey: 'phuket', slug: 'correction-test', locale: 'en',
      title: 'Correction test', summary: 'Summary', body: 'Body', authorIdentityId: author.id,
    });
    await addResearchSource(db, draft.id, { title: 'Source', url: 'https://example.com/source' });
    await submitResearchForReview(db, draft.id, author.id);
    await reviewResearchPublication(db, draft.id, reviewer.id);
    await publishResearchPublication(db, draft.id, reviewer.id);

    const correction = await addResearchCorrection(db, draft.id, reviewer.id, 'Corrected figure', 'The public record was corrected.');
    await expect(db.researchCorrection.update({
      where: { id: correction.id },
      data: { summary: 'Changed again' },
    })).rejects.toThrow(/append-only/i);
  });
});
