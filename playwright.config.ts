/*
 * Playwright config for LanaeHealth v2 E2E tests.
 *
 * The app is mobile-first and we ship to iOS users. We test in
 * WebKit (iOS Safari engine) by default plus mobile Chromium so a
 * regression in either rendering path is caught before merge.
 *
 * Base URL is configurable via PLAYWRIGHT_BASE_URL so the same suite
 * can target the local dev server (port 3005, the lanaehealth-dev
 * preview) or a deployed preview/prod URL.
 *
 * CI behavior: 2 retries (network is flaky, the app makes real
 * Supabase + Claude calls). Locally we want fast feedback so retries
 * stay at zero and tests fail loudly.
 */
import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3005'
const isCI = !!process.env.CI
// Reuse a dev server already on :3005 instead of spawning a fresh one.
// Default behavior locally; CI always boots its own.
const reuseExistingServer = !isCI

export default defineConfig({
  testDir: './tests/e2e',
  // Test budget covers Next.js dev-mode JIT compile on first hit to a
  // route. CI keeps it loose because cold starts there are slower.
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 1,
  workers: isCI ? 2 : undefined,
  reporter: isCI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 13 Pro'],
      },
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
  // The middleware (src/middleware.ts) gates /v2 behind a session cookie
  // unless LANAE_REQUIRE_AUTH=false. We boot the dev server with that
  // flag so the E2E suite hits real pages without needing fixture
  // accounts. Per-route authorization tests live elsewhere.
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer,
    timeout: 120_000,
    env: {
      LANAE_REQUIRE_AUTH: 'false',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
})
