// Global vitest setup. Pre-set the security-sweep auth bypass so
// existing route handler tests (which construct bare Request objects
// with no cookies / Bearer token) continue to exercise their business
// logic instead of returning 401 from `requireUser()`.
//
// Tests that explicitly verify the auth gate (src/__tests__/middleware.test.ts,
// src/lib/api/__tests__/require-user.test.ts) reset this flag in their own
// beforeEach so they remain accurate.
process.env.LANAEHEALTH_AUTH_DISABLED = '1'
