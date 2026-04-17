/**
 * API Smoke Test (Integration)
 *
 * Walks the filesystem for every route.ts under src/app/api/, detects which
 * ones export a GET handler, and hits each against a live Next dev server.
 *
 * Assertions per route:
 *   - status in [200, 400, 401, 404, 405, 501]   (expected codes)
 *   - status is NOT 5xx
 *   - if status === 200, JSON body (if any) does NOT contain top-level "error"
 *
 * This is the canonical "never again" regression: Session 1 found
 * /api/medications/today silently returning a 200 body with an error field
 * (a SQL column error swallowed into the payload). That exact shape will fail
 * here.
 *
 * HOW TO RUN:
 *   SMOKE_URL=http://localhost:3005 npx vitest run src/__tests__/api-smoke.test.ts
 *   # or
 *   npm run test:smoke
 *
 * Requires a running dev server. If SMOKE_URL is unset OR the server cannot be
 * reached, the suite is skipped with a clear message. This test does NOT spin
 * up its own server (by design: keeps the shared dev server stable).
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE_URL = process.env.SMOKE_URL || ''

// Resolve API root relative to THIS test file, not process.cwd(), so the test
// works whether vitest runs from the project root or a parent directory.
// This file lives at src/__tests__/api-smoke.test.ts, so ../app/api gets us there.
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CANDIDATE_ROOTS = [
  join(__dirname, '../app/api'),
  join(process.cwd(), 'src/app/api'),
  join(process.cwd(), 'lanaehealth/src/app/api'),
]
const API_ROOT = CANDIDATE_ROOTS.find((p) => existsSync(p)) || CANDIDATE_ROOTS[0]

// Expected codes: 2xx (success), 4xx (client-side, includes POST-only -> 405),
// 501 (explicit not-implemented, e.g. archive delete pending a table)
const ALLOWED_STATUS_CODES = new Set([200, 400, 401, 404, 405, 501])

// Sentinel values substituted into dynamic segments. Keep them obviously-fake
// so nothing gets mistaken for real data.
const SENTINEL_BY_PARAM: Record<string, string> = {
  integrationId: 'integration-oura',
  id: '00000000-0000-0000-0000-000000000000',
}
const DEFAULT_SENTINEL = 'smoke-sentinel'

type RouteInfo = {
  urlPath: string
  filePath: string
}

type Outcome = {
  route: string
  status: number
  pass: boolean
  reason: string
}

/** Walk the api tree, collect every route.ts that exports a GET handler. */
function collectGetRoutes(dir: string): RouteInfo[] {
  const results: RouteInfo[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      results.push(...collectGetRoutes(full))
    } else if (entry === 'route.ts') {
      const src = readFileSync(full, 'utf-8')
      // Match both "export async function GET" and "export function GET"
      if (/export\s+(async\s+)?function\s+GET\s*\(/.test(src)) {
        const rel = relative(API_ROOT, full)
        // strip trailing /route.ts
        const segments = rel.replace(/\/route\.ts$/, '').split('/')
        const urlPath =
          '/api/' +
          segments
            .map((seg) => {
              const m = /^\[(\.\.\.)?([^\]]+)\]$/.exec(seg)
              if (!m) return seg
              const paramName = m[2]
              return SENTINEL_BY_PARAM[paramName] || DEFAULT_SENTINEL
            })
            .join('/')
        results.push({ urlPath, filePath: full })
      }
    }
  }
  return results
}

async function probeServer(url: string): Promise<boolean> {
  if (!url) return false
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 3000)
    const res = await fetch(`${url}/api/health`, { signal: ctrl.signal })
    clearTimeout(t)
    return res.status < 500
  } catch {
    return false
  }
}

const serverReachable = await probeServer(BASE_URL)

const skipReason = !BASE_URL
  ? 'SMOKE_URL not set. Run `SMOKE_URL=http://localhost:3005 npm run test:smoke`.'
  : !serverReachable
    ? `SMOKE_URL=${BASE_URL} is not reachable. Start the dev server (lanaehealth-dev on port 3005).`
    : ''

describe.skipIf(!!skipReason)('API smoke test (integration)', () => {
  const routes = collectGetRoutes(API_ROOT).sort((a, b) =>
    a.urlPath.localeCompare(b.urlPath),
  )
  const outcomes: Outcome[] = []

  beforeAll(() => {
    // eslint-disable-next-line no-console
    console.log(
      `[smoke] base=${BASE_URL}  enumerated ${routes.length} GET routes from ${API_ROOT}`,
    )
  })

  for (const route of routes) {
    it(`GET ${route.urlPath}`, async () => {
      const url = `${BASE_URL}${route.urlPath}`
      let status = 0
      let bodyText = ''
      try {
        const ctrl = new AbortController()
        const t = setTimeout(() => ctrl.abort(), 15000)
        const res = await fetch(url, { signal: ctrl.signal, redirect: 'manual' })
        clearTimeout(t)
        status = res.status
        bodyText = await res.text()
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        outcomes.push({
          route: route.urlPath,
          status: 0,
          pass: false,
          reason: `fetch failed: ${msg}`,
        })
        throw new Error(`fetch failed for ${url}: ${msg}`)
      }

      // 3xx redirects (e.g. /api/integrations/.../authorize) are fine; treat as
      // allowed for smoke purposes (no 5xx, no 200-with-error).
      const is3xx = status >= 300 && status < 400
      const is5xx = status >= 500 && status < 600

      if (is5xx) {
        outcomes.push({
          route: route.urlPath,
          status,
          pass: false,
          reason: `5xx body: ${bodyText.slice(0, 200)}`,
        })
        expect(is5xx, `5xx from ${url}: ${bodyText.slice(0, 400)}`).toBe(false)
      }

      // 200 body must not carry a top-level "error" key (the Session-1 bug)
      let bodyErrorKey = false
      if (status === 200 && bodyText.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(bodyText)
          if (parsed && typeof parsed === 'object' && 'error' in parsed) {
            bodyErrorKey = true
          }
        } catch {
          // Non-JSON 200 body is fine.
        }
      }

      if (bodyErrorKey) {
        outcomes.push({
          route: route.urlPath,
          status,
          pass: false,
          reason: `200 body contains "error" key: ${bodyText.slice(0, 200)}`,
        })
        expect(bodyErrorKey, `200 with "error" key from ${url}`).toBe(false)
      }

      // Status must be in the allowed set OR a redirect (3xx).
      const allowedStatus = is3xx || ALLOWED_STATUS_CODES.has(status)
      if (!allowedStatus) {
        outcomes.push({
          route: route.urlPath,
          status,
          pass: false,
          reason: `unexpected status ${status}`,
        })
        expect(
          allowedStatus,
          `unexpected status ${status} from ${url}: ${bodyText.slice(0, 200)}`,
        ).toBe(true)
      }

      outcomes.push({
        route: route.urlPath,
        status,
        pass: true,
        reason: '',
      })
    })
  }

  it('prints outcome table', () => {
    const rows = outcomes
      .sort((a, b) => a.route.localeCompare(b.route))
      .map((o) => {
        const tag = o.pass ? 'OK' : 'FAIL'
        const extra = o.reason ? `  // ${o.reason}` : ''
        return `  ${tag}  ${String(o.status).padStart(3)}  ${o.route}${extra}`
      })
    const pass = outcomes.filter((o) => o.pass).length
    const fail = outcomes.filter((o) => !o.pass).length
    // eslint-disable-next-line no-console
    console.log(
      [
        '',
        '==== API smoke test results ====',
        `base: ${BASE_URL}`,
        `total: ${outcomes.length}  pass: ${pass}  fail: ${fail}`,
        ...rows,
        '================================',
        '',
      ].join('\n'),
    )
    // This "test" exists purely for the printed report; the real assertions
    // happen in the per-route tests above. If any of those failed, vitest
    // already flagged the suite red; no need to double-fail here.
    expect(true).toBe(true)
  })
})
