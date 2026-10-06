import { describe, expect, it } from 'vitest';
import {
  amenityPresentationImage,
  homePresentationGallery,
  homePresentationImage,
  projectPresentationImage,
} from './presentation-media';

describe('presentation media (sample photos until real media is uploaded)', () => {
  it('always prefers real media and never marks it as a sample', () => {
    expect(homePresentationImage('u1', '/real.jpg', 'villa')).toEqual({ src: '/real.jpg', illustrative: false });
    expect(projectPresentationImage('p1', '/cover.jpg')).toEqual({ src: '/cover.jpg', illustrative: false });
    expect(amenityPresentationImage('/pool.jpg', 'pool', 'Pool')).toEqual({ src: '/pool.jpg', illustrative: false });
    expect(homePresentationGallery('u1', ['/a.jpg'], 'villa')).toEqual({ images: ['/a.jpg'], illustrative: false });
  });

  it('marks every stand-in as illustrative so the UI badges it', () => {
    expect(homePresentationImage('u1', null, 'villa').illustrative).toBe(true);
    expect(projectPresentationImage('p1', null).illustrative).toBe(true);
    expect(amenityPresentationImage(null, null, 'Lobby').illustrative).toBe(true);
    const gallery = homePresentationGallery('u1', [], 'condo');
    expect(gallery.illustrative).toBe(true);
    expect(gallery.images).toHaveLength(5);
  });

  it('is stable per id, so a card shows the same sample on every visit', () => {
    expect(homePresentationImage('unit-42', null, 'villa').src).toBe(homePresentationImage('unit-42', null, 'villa').src);
  });

  it('picks condo samples for apartment-type homes and pool samples for pool amenities', () => {
    const condo = homePresentationGallery('x', [], 'condominium').images;
    const villa = homePresentationGallery('x', [], 'villa').images;
    expect(condo).not.toEqual(villa);
    expect(amenityPresentationImage(null, 'swimming_pool', null).src).toContain('photo-1555698152');
  });
});
