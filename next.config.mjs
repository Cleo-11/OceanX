/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Disable ESLint errors during builds to avoid invalid options issues
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Enable TypeScript error checking during builds
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  // Enable strict mode for better error detection
  reactStrictMode: true,
  // Enable SWC minification for better performance
  swcMinify: true,
}

export default nextConfig
