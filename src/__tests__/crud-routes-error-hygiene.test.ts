// Locks in the fix for D-013a: raw Supabase error.message was leaking
// through lib-function `result.error` into API responses. The lib
// helpers (addBbtEntry, addHormoneEntry, addWeightEntry, etc.) wrap
// supabase calls with `{ ok: false, error: err.message }` returns.
// Routes that echoed that `result.error` straight to the browser
// enumerated the DB schema via constraint-violation text - same
// vector as D-003, one layer deeper.
//
// This is a static-source scan. For every generic CRUD route in
// Track D's scope we assert:
//   1. `jsonError` from @/lib/api/json-error is imported, AND
//   2. no `NextResponse.json({ error: result.error ... })` echo
//      remains.
//
// Rationale for a grep test vs a runtime test: these routes call
// Supabase through lib helpers with network IO; mocking Supabase
// for each would be heavy, and the invariant we care about is
// "the response body path can never reach raw error.message".
// A static scan catches regressions the moment a contributor
// reintroduces the pattern.

import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..')

const HARDENED_ROUTES: readonly string[] = [
  'app/api/calories/custom-foods/route.ts',
  'app/api/calories/favorites/toggle/route.ts',
  'app/api/calories/plan/route.ts',
  'app/api/calories/recipes/route.ts',
  'app/api/cycle/bbt/route.ts',
  'app/api/cycle/hormones/route.ts',
  'app/api/favorites/route.ts',
  'app/api/food/search/route.ts',
  'app/api/water/log/route.ts',
  'app/api/weight/log/route.ts',
]

const JSON_ERROR_IMPORT = /from ['"]@\/lib\/api\/json-error['"]/
const RESULT_ERROR_ECHO =
  /NextResponse\.json\(\s*\{\s*(ok:\s*false,\s*)?error:\s*result\.error/

describe('D-013a - generic CRUD routes must not leak lib result.error', () => {
  for (const rel of HARDENED_ROUTES) {
    it(`${rel} imports jsonError and does not echo result.error`, async () => {
      const body = await readFile(path.join(ROOT, rel), 'utf8')
      expect(
        JSON_ERROR_IMPORT.test(body),
        `${rel}: missing "import { jsonError } from '@/lib/api/json-error'"`,
      ).toBe(true)
      expect(
        RESULT_ERROR_ECHO.test(body),
        `${rel}: still echoes result.error directly in NextResponse.json`,
      ).toBe(false)
    })
  }
})
