// Locks in the cross-track gate fixes landed by Track D when the user
// overrode the track-scope boundary:
//
//   - D → B chat/history    - P1 - unauthenticated GET returned 100
//                              chat rows (PHI dense).
//   - D → B share/care-card - P1 - env-token-only guard; D-001's
//                              client fix meant nobody could mint,
//                              but prod still shipped the pattern.
//   - D → A export/full     - P2 - `?token=` query pattern landed in
//                              history / referer / access logs.
//   - D → A admin/peek      - P0 - arbitrary-table read primitive;
//                              deleted in this PR.
//
// Static-source scan: each route must import `requireAuth` and call
// it, and must NOT retain the old env-token-in-query patterns. If
// anybody reintroduces the leak the test trips.

import { describe, it, expect } from 'vitest'
import { readFile, access } from 'node:fs/promises'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..')

const GATED_ROUTES: readonly string[] = [
  'app/api/chat/history/route.ts',
  'app/api/share/care-card/route.ts',
  'app/api/export/full/route.ts',
]

const REQUIRE_AUTH_IMPORT = /from ['"]@\/lib\/auth\/require-user['"]/
const REQUIRE_AUTH_CALL = /requireAuth\(/
// Banned: reading a token from a query string in an auth context.
const QUERY_TOKEN_READ =
  /searchParams\.get\(\s*['"]token['"]\s*\)|nextUrl\.searchParams\.get\(\s*['"]token['"]\s*\)/

describe('cross-track gate pack - require-auth on high-value endpoints', () => {
  for (const rel of GATED_ROUTES) {
    it(`${rel} calls requireAuth and has no query-token auth path`, async () => {
      const body = await readFile(path.join(ROOT, rel), 'utf8')
      expect(
        REQUIRE_AUTH_IMPORT.test(body),
        `${rel}: missing "import { requireAuth } from '@/lib/auth/require-user'"`,
      ).toBe(true)
      expect(
        REQUIRE_AUTH_CALL.test(body),
        `${rel}: missing requireAuth(...) call`,
      ).toBe(true)
      // chat/history retains a narrow ?token= path for CHAT_HARD_DELETE_TOKEN
      // as a second factor *in addition to* the requireAuth gate. For the
      // other two routes no query-token read should remain.
      if (!rel.endsWith('chat/history/route.ts')) {
        expect(
          QUERY_TOKEN_READ.test(body),
          `${rel}: still reads ?token= - the query-token auth path must be gone`,
        ).toBe(false)
      }
    })
  }

  it('/api/admin/peek route file is deleted', async () => {
    const peekPath = path.join(ROOT, 'app/api/admin/peek/route.ts')
    let exists = true
    try {
      await access(peekPath)
    } catch {
      exists = false
    }
    expect(exists, 'admin/peek was supposed to be deleted in D-014a').toBe(false)
  })
})
