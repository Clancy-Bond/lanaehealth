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
};

export default nextConfig;
