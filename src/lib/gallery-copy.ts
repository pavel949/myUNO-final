import { getLabels, getRequestLocale } from '@/lib/i18n';
import { GALLERY_EMERGENCY_KEYS, GALLERY_EMERGENCY_LOCALE_DRAFTS } from '@/modules/content/gallery-emergency.seed';

export async function getGalleryCopy() {
  const copy = await getLabels(Object.fromEntries(GALLERY_EMERGENCY_KEYS.filter(row => row.namespace === 'gallery').map(row => [row.key, row.en])), getRequestLocale(), GALLERY_EMERGENCY_LOCALE_DRAFTS);
  return { close: copy['gallery.close'], previous: copy['gallery.previous'], next: copy['gallery.next'], unavailable: copy['gallery.unavailable'] };
}
