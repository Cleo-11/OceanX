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
  webpack: (config) => {
    if (config?.output) {
      config.output.hashFunction = 'sha256'
      config.output.hashDigestLength = 64
    }

    if (config?.optimization && typeof config.optimization === 'object') {
      config.optimization.realContentHash = false
    }

    return config
  },
}

export default nextConfig
