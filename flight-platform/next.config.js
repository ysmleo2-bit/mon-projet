/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.skyscanner.net" },
      { protocol: "https", hostname: "*.kiwi.com" },
    ],
  },
};

module.exports = nextConfig;
