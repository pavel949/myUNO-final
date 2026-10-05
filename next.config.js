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
  // Parent URLs of admin detail pages that have no list of their own: walking
  // up from a detail URL must land on the real list, never a 404.
  async redirects() {
    return [
      { source: '/app/admin/properties', destination: '/app/admin/projects', permanent: false },
      { source: '/app/admin/crm/opportunities', destination: '/app/admin/crm', permanent: false },
    ];
  },
};

module.exports = nextConfig;
