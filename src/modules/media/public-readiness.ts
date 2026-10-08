export const MIN_PUBLIC_GALLERY_PHOTOS = 3;
export const RECOMMENDED_PUBLIC_GALLERY_PHOTOS = 5;

export const PUBLIC_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type PublicPhotoScope = 'project' | 'category' | 'exact_unit' | 'room_type' | 'none';

export type MediaAssetLike = {
  id: string;
  storageKey: string;
  kind: string;
  mimeType: string;
  encrypted: boolean;
  sizeBytes: number;
};

export type GalleryLinkLike = {
  mediaId: string;
  sort?: number;
  media: MediaAssetLike;
};

export type GalleryReadiness = {
  ready: boolean;
  photoCount: number;
  coverMediaId: string | null;
  coverReady: boolean;
  coverUrl: string | null;
  invalidMediaIds: string[];
  blockers: string[];
  warnings: string[];
  urls: string[];
};

export type UnitMediaReadiness = GalleryReadiness & {
  photoScope: PublicPhotoScope;
  representative: boolean;
};

function validPublicPhoto(asset: MediaAssetLike): boolean {
  return (
    asset.kind === 'photo' &&
    asset.encrypted === false &&
    PUBLIC_PHOTO_MIME_TYPES.includes(asset.mimeType as (typeof PUBLIC_PHOTO_MIME_TYPES)[number]) &&
    typeof asset.storageKey === 'string' &&
    asset.storageKey.trim().length > 0 &&
    Number.isFinite(asset.sizeBytes) &&
    asset.sizeBytes > 0
  );
}

export function assessGalleryReadiness(input: {
  coverMediaId?: string | null;
  links: readonly GalleryLinkLike[];
  minimumPhotos?: number;
  recommendedPhotos?: number;
}): GalleryReadiness {
  const minimumPhotos = input.minimumPhotos ?? MIN_PUBLIC_GALLERY_PHOTOS;
  const recommendedPhotos = input.recommendedPhotos ?? RECOMMENDED_PUBLIC_GALLERY_PHOTOS;

  const seen = new Set<string>();
  const invalidMediaIds: string[] = [];
  const valid: GalleryLinkLike[] = [];

  for (const link of input.links) {
    if (seen.has(link.mediaId)) {
      invalidMediaIds.push(link.mediaId);
      continue;
    }
    seen.add(link.mediaId);
    if (!validPublicPhoto(link.media)) {
      invalidMediaIds.push(link.mediaId);
      continue;
    }
    valid.push(link);
  }

  const coverMediaId = input.coverMediaId ?? null;
  const coverLink = coverMediaId
    ? valid.find((link) => link.mediaId === coverMediaId)
    : undefined;
  const coverReady = Boolean(coverLink);
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!coverMediaId) blockers.push('missing_cover');
  else if (!coverReady) blockers.push('cover_not_in_gallery');

  if (valid.length < minimumPhotos) blockers.push('too_few_public_photos');
  if (invalidMediaIds.length > 0) blockers.push('invalid_public_media');
  if (valid.length >= minimumPhotos && valid.length < recommendedPhotos) {
    warnings.push('below_recommended_photo_count');
  }

  return {
    ready: blockers.length === 0,
    photoCount: valid.length,
    coverMediaId,
    coverReady,
    coverUrl: coverLink?.media.storageKey ?? null,
    invalidMediaIds,
    blockers,
    warnings,
    urls: valid.map((link) => link.media.storageKey),
  };
}

export function isRepresentativeRoom(input: {
  projectType?: string | null;
  accommodationType?: string | null;
}): boolean {
  // Preserve unclassified legacy hotel rooms, but an explicit private-home
  // classification must never inherit representative photos from its project.
  return input.accommodationType
    ? input.accommodationType === 'hotel_room'
    : input.projectType === 'hotel';
}

export function assessUnitMediaReadiness(input: {
  projectType?: string | null;
  accommodationType?: string | null;
  unitCoverMediaId?: string | null;
  unitMedia: readonly GalleryLinkLike[];
  categoryCoverMediaId?: string | null;
  categoryMedia?: readonly GalleryLinkLike[];
}): UnitMediaReadiness {
  const own = assessGalleryReadiness({
    coverMediaId: input.unitCoverMediaId,
    links: input.unitMedia,
  });

  if (own.ready) {
    return {
      ...own,
      photoScope: 'exact_unit',
      representative: false,
    };
  }

  if (isRepresentativeRoom(input)) {
    const category = assessGalleryReadiness({
      coverMediaId: input.categoryCoverMediaId,
      links: input.categoryMedia ?? [],
    });
    if (category.ready) {
      return {
        ...category,
        photoScope: 'room_type',
        representative: true,
      };
    }
  }

  return {
    ...own,
    photoScope: 'none',
    representative: false,
  };
}

export function publicMediaReadinessMessage(
  readiness: Pick<GalleryReadiness, 'blockers' | 'photoCount'>
): string {
  if (readiness.blockers.includes('missing_cover')) {
    return 'Choose a cover photo from this gallery.';
  }
  if (readiness.blockers.includes('cover_not_in_gallery')) {
    return 'The cover photo must belong to this gallery.';
  }
  if (readiness.blockers.includes('invalid_public_media')) {
    return 'Replace encrypted, unsupported or missing public media assets.';
  }
  if (readiness.blockers.includes('too_few_public_photos')) {
    return `Add at least ${MIN_PUBLIC_GALLERY_PHOTOS} valid public photos (currently ${readiness.photoCount}).`;
  }
  return 'Media is ready for public presentation.';
}
