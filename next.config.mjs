/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Enable ESLint during builds to catch issues early
    ignoreDuringBuilds: false,
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
