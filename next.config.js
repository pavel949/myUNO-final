/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: '/p/:token', headers: [
      { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
    ] }];
  },
  // Production typechecking excludes test-only fixtures; Vitest checks behavior separately.
  typescript: { tsconfigPath: 'tsconfig.production.json' },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'omwoglpcwaiflaprgrne.supabase.co', pathname: '/storage/v1/object/public/villa-media/**' },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig;
