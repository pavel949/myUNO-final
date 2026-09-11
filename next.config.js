/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Diagnostic branch only: `npm run build` captures `tsc --noEmit` output
  // into /public/ts-errors.txt. Do not merge this setting into main.
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
