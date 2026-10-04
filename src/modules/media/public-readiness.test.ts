import { describe, expect, it } from 'vitest';
import {
  assessGalleryReadiness,
  assessUnitMediaReadiness,
  MIN_PUBLIC_GALLERY_PHOTOS,
} from './public-readiness';

const photo = (id: string) => ({
  mediaId: id,
  sort: 0,
  media: {
    id,
    storageKey: `https://cdn.example.com/${id}.jpg`,
    kind: 'photo',
    mimeType: 'image/jpeg',
    encrypted: false,
  },
});

describe('public media readiness', () => {
  it('requires at least three valid photos and a cover from the same gallery', () => {
    const ready = assessGalleryReadiness({
      coverMediaId: 'a',
      links: [photo('a'), photo('b'), photo('c')],
    });
    expect(ready.ready).toBe(true);
    expect(ready.photoCount).toBe(MIN_PUBLIC_GALLERY_PHOTOS);
    expect(ready.coverUrl).toBe('https://cdn.example.com/a.jpg');

    const missingCover = assessGalleryReadiness({
      coverMediaId: null,
      links: [photo('a'), photo('b'), photo('c')],
    });
    expect(missingCover.ready).toBe(false);
    expect(missingCover.blockers).toContain('missing_cover');

    const foreignCover = assessGalleryReadiness({
      coverMediaId: 'x',
      links: [photo('a'), photo('b'), photo('c')],
    });
    expect(foreignCover.ready).toBe(false);
    expect(foreignCover.blockers).toContain('cover_not_in_gallery');
  });

  it('rejects encrypted or unsupported assets from a public gallery', () => {
    const encrypted = photo('secret');
    encrypted.media.encrypted = true;
    const readiness = assessGalleryReadiness({
      coverMediaId: 'a',
      links: [photo('a'), photo('b'), encrypted],
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.invalidMediaIds).toEqual(['secret']);
    expect(readiness.blockers).toContain('invalid_public_media');
  });

  it('never uses category photos as exact-unit photos for private villas or condos', () => {
    const result = assessUnitMediaReadiness({
      projectType: 'villa_estate',
      accommodationType: 'villa',
      unitCoverMediaId: null,
      unitMedia: [],
      categoryCoverMediaId: 'a',
      categoryMedia: [photo('a'), photo('b'), photo('c')],
    });
    expect(result.ready).toBe(false);
    expect(result.photoScope).toBe('none');
  });

  it('allows a hotel room to use a truthful representative room-type gallery', () => {
    const result = assessUnitMediaReadiness({
      projectType: 'hotel',
      accommodationType: 'hotel_room',
      unitCoverMediaId: null,
      unitMedia: [],
      categoryCoverMediaId: 'a',
      categoryMedia: [photo('a'), photo('b'), photo('c')],
    });
    expect(result.ready).toBe(true);
    expect(result.photoScope).toBe('room_type');
    expect(result.representative).toBe(true);
  });
});
