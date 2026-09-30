/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
