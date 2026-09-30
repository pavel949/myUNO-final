/** Shared gallery invariants. Never permit a cover/order entry from another gallery. */
export function validateGalleryOrder(
  attached: readonly string[],
  ordered: unknown,
  cover: unknown,
): { ordered: string[]; cover: string | null | undefined } {
  if (!Array.isArray(ordered) ||
      !ordered.every(id => typeof id === 'string') ||
      new Set(ordered).size !== ordered.length ||
      attached.length !== ordered.length ||
      attached.some(id => !ordered.includes(id))) {
    throw new Error('Gallery order must include every attached media ID exactly once');
  }
  if (cover !== undefined && cover !== null &&
      (typeof cover !== 'string' || !attached.includes(cover))) {
    throw new Error('Cover photo must be attached to this gallery');
  }
  return { ordered, cover: cover as string | null | undefined };
}

export function nextCover(
  cover: string | null,
  removed: string,
  remaining: readonly { mediaId: string }[],
): string | null {
  return cover === removed ? (remaining[0]?.mediaId ?? null) : cover;
}
