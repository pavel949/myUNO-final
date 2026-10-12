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
    sizeBytes: 1024,
  },
});

describe('public media readiness', () => {
  it('presents an explicit cover first without changing stored order or duplicating it', () => {
    const links = [photo('pool'), photo('bedroom'), photo('living-room'), photo('kitchen')]
      .map((link, sort) => ({ ...link, sort }));
    const original = structuredClone(links);
    const result = assessGalleryReadiness({ coverMediaId: 'living-room', links });
    expect(result.ready).toBe(true);
    expect(result.urls).toEqual(['living-room', 'pool', 'bedroom', 'kitchen'].map(id => photo(id).media.storageKey));
    expect(result.urls[0]).toBe(result.coverUrl);
    expect(result.photoCount).toBe(4);
    expect(links).toEqual(original);
  });

  it('keeps an already-first cover exactly once', () => {
    const links = [photo('a'), photo('b'), photo('c')];
    expect(assessGalleryReadiness({ coverMediaId: 'a', links }).urls)
      .toEqual(links.map(link => link.media.storageKey));
  });

  it.each([null, 'missing', 'private'])('keeps photo order and readiness gates when cover %s is unavailable', coverMediaId => {
    const privatePhoto = photo('private');
    privatePhoto.media.encrypted = true;
    const links = [photo('a'), privatePhoto, photo('b'), photo('c')];
    const result = assessGalleryReadiness({ coverMediaId, links });
    expect(result.ready).toBe(false);
    expect(result.coverUrl).toBeNull();
    expect(result.urls).toEqual(['a', 'b', 'c'].map(id => photo(id).media.storageKey));
    expect(result.invalidMediaIds).toEqual(['private']);
  });

  it('preserves separate video order while presenting the photo cover first', () => {
    const video = (id: string) => ({ ...photo(id), media: {
      ...photo(id).media, kind: 'video', mimeType: 'video/mp4', storageKey: `https://cdn.example.com/${id}.mp4`,
    } });
    const result = assessGalleryReadiness({
      coverMediaId: 'c', links: [video('v2'), photo('a'), photo('b'), video('v1'), photo('c')],
    });
    expect(result.ready).toBe(true);
    expect(result.urls).toEqual(['c', 'a', 'b'].map(id => photo(id).media.storageKey));
    expect(result.videoUrls).toEqual(['v2', 'v1'].map(id => video(id).media.storageKey));
  });

  it('preserves duplicate-media rejection when the duplicated asset is the cover', () => {
    const result = assessGalleryReadiness({
      coverMediaId: 'c', links: [photo('a'), photo('b'), photo('c'), photo('c')],
    });
    expect(result.ready).toBe(false);
    expect(result.invalidMediaIds).toEqual(['c']);
    expect(result.urls).toEqual(['c', 'a', 'b'].map(id => photo(id).media.storageKey));
  });

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

  it('rejects encrypted, unsupported or empty assets from a public gallery', () => {
    const encrypted = photo('secret');
    encrypted.media.encrypted = true;
    const readiness = assessGalleryReadiness({
      coverMediaId: 'a',
      links: [photo('a'), photo('b'), encrypted],
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.invalidMediaIds).toEqual(['secret']);
    expect(readiness.blockers).toContain('invalid_public_media');

    const empty = photo('empty');
    empty.media.sizeBytes = 0;
    const emptyReadiness = assessGalleryReadiness({
      coverMediaId: 'a',
      links: [photo('a'), photo('b'), empty],
    });
    expect(emptyReadiness.ready).toBe(false);
    expect(emptyReadiness.invalidMediaIds).toContain('empty');
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
      categoryCoverMediaId: 'c',
      categoryMedia: [photo('a'), photo('b'), photo('c')],
    });
    expect(result.ready).toBe(true);
    expect(result.photoScope).toBe('room_type');
    expect(result.representative).toBe(true);
    expect(result.urls).toEqual(['c', 'a', 'b'].map(id => photo(id).media.storageKey));
  });
});
