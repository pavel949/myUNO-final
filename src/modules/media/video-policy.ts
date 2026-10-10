/** Direct-to-Blob upload cap; large bytes never cross a Vercel function. */
export const MAX_VIDEO_UPLOAD_BYTES = 200 * 1024 * 1024;
export const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm'] as const;
export const GALLERY_UPLOAD_ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/webm';
export const VIDEO_UPLOAD_HINT = 'MP4 or WebM, up to 200 MiB. Export MOV or larger videos as a smaller MP4 (H.264) or WebM first. Videos cannot replace the required photos or cover.';

export function isAllowedVideoType(mimeType: string): boolean {
  return VIDEO_MIME_TYPES.includes(mimeType as typeof VIDEO_MIME_TYPES[number]);
}

/** Check container signatures instead of trusting a filename or browser MIME. */
export function validVideoContent(bytes: Uint8Array, mimeType: string): boolean {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (mimeType === 'video/mp4') {
    if (bytes.length < 24 || ascii(4, 8) !== 'ftyp') return false;
    const size = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
    if (size < 24 || size > bytes.length || size > 4096) return false;
    const brands = [ascii(8, 12)];
    for (let offset = 16; offset + 4 <= size; offset += 4) brands.push(ascii(offset, offset + 4));
    return !brands.includes('qt  ') && brands.some(brand => ['isom', 'iso2', 'mp41', 'mp42', 'avc1'].includes(brand));
  }
  if (mimeType === 'video/webm') {
    return bytes.length >= 16 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3 &&
      ascii(4, Math.min(bytes.length, 4096)).includes('webm');
  }
  return false;
}

export function validateVideoUpload(bytes: Uint8Array, mimeType: string): void {
  if (!isAllowedVideoType(mimeType)) throw new Error('Video must be MP4 or WebM. Convert MOV files before uploading.');
  if (!bytes.byteLength || bytes.byteLength > MAX_VIDEO_UPLOAD_BYTES) throw new Error('Video must be between 1 byte and 200 MiB. Export a smaller clip before uploading.');
  if (!validVideoContent(bytes, mimeType)) throw new Error('Video content does not match its MP4/WebM format.');
}
