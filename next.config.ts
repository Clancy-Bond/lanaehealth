import { withSentryConfig } from "@sentry/nextjs";
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
  // Canonical front door is the v2 mobile UI. Bare-domain visits land on
  // /v2 instead of the legacy home. Specific legacy paths (/cycle, /log,
  // etc.) still resolve to the legacy app for now. permanent: false (307)
  // so we can revisit this without permanent browser cache pollution.
  async redirects() {
    return [
      {
        source: "/",
        destination: "/v2",
        permanent: false,
      },
    ];
  },
};

// Sentry wrapper. No-op at runtime when SENTRY_DSN is unset (see
// src/instrumentation.ts), but the wrapper still injects build-time tooling
// (sourcemap upload, tunnel route) when SENTRY_AUTH_TOKEN is present. With
// neither set, Sentry quietly bypasses sourcemap upload and the build still
// succeeds.
export default withSentryConfig(nextConfig, {
  // These are read by the Sentry build plugin only. Runtime DSN comes from
  // env at process start.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Suppress the build plugin's "no auth token" warning during local builds.
  disableLogger: true,
  // Tunnel Sentry traffic through a same-origin route to bypass ad blockers.
  // Disabled until we add the route handler; enabling this without the route
  // existing would break event delivery in the browser.
  // tunnelRoute: "/monitoring",
});
