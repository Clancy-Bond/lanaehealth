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
  // Canonical front door is the v2 mobile UI. The legacy → v2 unified
  // cutover (per-section) routes every shipped section to its v2
  // counterpart. permanent: false (307) so each cutover is reversible by
  // removing the entry. /topics/migraine and /topics/nutrition stay on
  // legacy until v2 versions ship. Legacy page source is retained for fast
  // revert.
  async redirects() {
    return [
      { source: "/", destination: "/v2", permanent: false },

      // Cycle
      { source: "/cycle", destination: "/v2/cycle", permanent: false },
      { source: "/cycle/:path*", destination: "/v2/cycle/:path*", permanent: false },

      // Calories
      { source: "/calories", destination: "/v2/calories", permanent: false },
      { source: "/calories/:path*", destination: "/v2/calories/:path*", permanent: false },

      // Daily flows
      { source: "/log", destination: "/v2/log", permanent: false },
      { source: "/sleep", destination: "/v2/sleep", permanent: false },
      { source: "/today", destination: "/v2/today", permanent: false },

      // Records, labs, imaging
      { source: "/records", destination: "/v2/records", permanent: false },
      { source: "/records/:path*", destination: "/v2/records/:path*", permanent: false },
      { source: "/labs", destination: "/v2/labs", permanent: false },
      { source: "/labs/:path*", destination: "/v2/labs/:path*", permanent: false },
      { source: "/imaging", destination: "/v2/imaging", permanent: false },
      { source: "/imaging/:path*", destination: "/v2/imaging/:path*", permanent: false },

      // Topics that have shipped v2 (cycle + orthostatic). migraine and
      // nutrition stay on legacy until parity ships.
      { source: "/topics/cycle", destination: "/v2/topics/cycle", permanent: false },
      { source: "/topics/cycle/:path*", destination: "/v2/topics/cycle/:path*", permanent: false },
      { source: "/topics/orthostatic", destination: "/v2/topics/orthostatic", permanent: false },
      { source: "/topics/orthostatic/:path*", destination: "/v2/topics/orthostatic/:path*", permanent: false },

      // Settings
      { source: "/settings", destination: "/v2/settings", permanent: false },
      { source: "/settings/:path*", destination: "/v2/settings/:path*", permanent: false },

      // Imports
      { source: "/import", destination: "/v2/import", permanent: false },
      { source: "/import/:path*", destination: "/v2/import/:path*", permanent: false },

      // Patterns
      { source: "/patterns", destination: "/v2/patterns", permanent: false },
      { source: "/patterns/:path*", destination: "/v2/patterns/:path*", permanent: false },

      // Chat
      { source: "/chat", destination: "/v2/chat", permanent: false },

      // Doctor (gate flipped 2026-04-25)
      { source: "/doctor", destination: "/v2/doctor", permanent: false },
      { source: "/doctor/:path*", destination: "/v2/doctor/:path*", permanent: false },

      // NOT redirected (intentional):
      //   /topics/migraine, /topics/nutrition: no v2 parity yet
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
