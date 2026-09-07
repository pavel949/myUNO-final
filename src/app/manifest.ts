import type { MetadataRoute } from 'next';
import { COLOR } from '@/lib/design-tokens';

/**
 * PWA manifest (LY-7): the guest home space is installable to the home
 * screen but everything works in the plain browser — no service worker,
 * no offline layer in loop one.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'myUNO',
    short_name: 'myUNO',
    description: 'Serviced living in Phuket — stays, services, and your home space.',
    start_url: '/',
    display: 'standalone',
    background_color: COLOR.surface.ivory,
    theme_color: COLOR.brand.andaman,
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
