/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  // Next.js 14: exclure playwright-core et puppeteer-core du bundle webpack
  experimental: {
    serverComponentsExternalPackages: [
      "playwright-core",
      "puppeteer-core",
      "puppeteer-extra",
      "puppeteer-extra-plugin-stealth",
      "puppeteer-extra-plugin-user-data-dir",
      "puppeteer-extra-plugin-user-preferences",
      "@sparticuz/chromium-min",
    ],
  },
};

export default nextConfig;
