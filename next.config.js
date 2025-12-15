/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  // Increase static page generation timeout
  staticPageGenerationTimeout: 120,
  // Skip static generation for problematic pages
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
}

module.exports = nextConfig



