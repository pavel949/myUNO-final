import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb, createIdentity } from '@/test/util';
import { createVideoDraft, publishVideo } from './video-publication.service';

describe('video publication governance', () => {
  beforeEach(async () => { await resetDb(); });

  it('publishes only canonical public video media with provenance', async () => {
    const admin = await createIdentity({ isAdmin: true });
    const media = await db.mediaAsset.create({
      data: {
        storageKey: 'https://cdn.example.com/video.mp4',
        kind: 'video',
        mimeType: 'video/mp4',
        sizeBytes: 1000,
        uploadedByIdentityId: admin.id,
        encrypted: false,
      },
    });
    const draft = await createVideoDraft(db, {
      destinationKey: 'phuket',
      slug: 'layan-walkthrough',
      locale: 'en',
      title: 'Layan walkthrough',
      mediaAssetId: media.id,
      createdByIdentityId: admin.id,
      provenance: 'Recorded by myUNO team on site',
    });
    const published = await publishVideo(db, draft.id, admin.id);
    expect(published.status).toBe('published');
    expect(published.publishedAt).not.toBeNull();
  });

  it('refuses photo assets and provenance-free publication', async () => {
    const admin = await createIdentity({ isAdmin: true });
    const photo = await db.mediaAsset.create({
      data: {
        storageKey: 'https://cdn.example.com/photo.webp',
        kind: 'photo',
        mimeType: 'image/webp',
        sizeBytes: 100,
        uploadedByIdentityId: admin.id,
      },
    });
    await expect(createVideoDraft(db, {
      destinationKey: 'phuket', slug: 'not-video', locale: 'en', title: 'Not video',
      mediaAssetId: photo.id, createdByIdentityId: admin.id,
    })).rejects.toThrow(/video MediaAsset/i);

    const video = await db.mediaAsset.create({
      data: {
        storageKey: 'https://cdn.example.com/no-source.mp4',
        kind: 'video',
        mimeType: 'video/mp4',
        sizeBytes: 100,
        uploadedByIdentityId: admin.id,
      },
    });
    const draft = await createVideoDraft(db, {
      destinationKey: 'phuket', slug: 'no-provenance', locale: 'en', title: 'No provenance',
      mediaAssetId: video.id, createdByIdentityId: admin.id,
    });
    await expect(publishVideo(db, draft.id, admin.id)).rejects.toThrow(/provenance/i);
  });
});
