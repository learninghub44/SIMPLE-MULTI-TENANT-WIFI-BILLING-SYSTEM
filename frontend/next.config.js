/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  webpack(config) {
    config.optimization.splitChunks = {
      chunks: "all",
      maxSize: 25 * 1024 * 1024, // 25 MB
    };
    return config;
  },
  // Optional: set metadataBase if you use Open Graph/Twitter cards
  // metadataBase: new URL("https://yourdomain.com"),
};

module.exports = nextConfig;
