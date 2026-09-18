/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Don't leak the "X-Powered-By: Next.js" header in production responses.
  poweredByHeader: false,


};

module.exports = nextConfig;
