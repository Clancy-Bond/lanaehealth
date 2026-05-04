import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide framework version from response headers. Defense-in-depth:
  // attackers can no longer fingerprint Next.js / its version from
  // X-Powered-By when probing for known CVEs.
  poweredByHeader: false,
  // Source maps must NOT ship to the browser in production. Default
  // is false; making it explicit so a future toggle requires an
  // intentional review.
  productionBrowserSourceMaps: false,
  // The middleware matcher excludes /_next/static/* and /_next/image/*
  // for performance. Attach a couple of low-cost defense-in-depth
  // headers via the framework's headers() so JS chunks still ship with
  // X-Content-Type-Options: nosniff.
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        ],
      },
      {
        source: '/_next/image/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
