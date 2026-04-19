import type { NextConfig } from "next";

// Minimal static-asset header defense. `src/middleware.ts` carries the full
// security header set (CSP, X-Frame-Options, etc.) for every dynamic route.
// The middleware matcher excludes `/_next/static/`, so these headers keep
// static bundles from being served without HSTS / nosniff.
const STATIC_ASSET_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: STATIC_ASSET_HEADERS,
      },
      {
        source: "/icons/:path*",
        headers: STATIC_ASSET_HEADERS,
      },
    ];
  },
};

export default nextConfig;
