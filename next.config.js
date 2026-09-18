/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Don't leak the "X-Powered-By: Next.js" header in production responses.
  poweredByHeader: false,

  experimental: {
    // Lets route handlers schedule work (like Google Calendar sync) to run
    // *after* the response has already been sent, via `unstable_after()`,
    // instead of making the client wait on a slow third-party API before
    // their own save/edit appears to finish. See lib/google-calendar.ts
    // callers in app/api/events/route.ts and app/api/events/[id]/route.ts.
    after: true,
  },
};

module.exports = nextConfig;
