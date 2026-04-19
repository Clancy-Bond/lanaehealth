// Locks in the fix for the NEXT_PUBLIC_SHARE_TOKEN_ADMIN_TOKEN leak.
// The admin token for /api/share/care-card must NEVER be referenced
// from a `'use client'` module. This grep-style test asserts that no
// client-side source references the variable by name.
//
// We also scan for other known-sensitive names that must stay server-
// only, so a future misstep (e.g., prefixing ANTHROPIC_API_KEY with
// NEXT_PUBLIC_) is caught the moment it lands.

import { describe, it, expect } from 'vitest'
import { readdir, readFile, stat } from 'node:fs/promises'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..')

// Match `process.env.<NAME>` only. Plain prose mentions in comments
// that explain a fix are allowed.
function envRef(name: string): RegExp {
  return new RegExp(`process\\.env\\.${name}\\b`)
}

const BANNED_IN_CLIENT: Array<{ pattern: RegExp; why: string }> = [
  {
    pattern: envRef('NEXT_PUBLIC_SHARE_TOKEN_ADMIN_TOKEN'),
    why: 'admin token for /api/share/care-card must not ship to the client',
  },
  {
    pattern: envRef('ANTHROPIC_API_KEY'),
    why: 'Anthropic API key is server-only',
  },
  {
    pattern: envRef('SUPABASE_SERVICE_ROLE_KEY'),
    why: 'service role key bypasses RLS and must stay server-side',
  },
  {
    pattern: envRef('CHAT_HARD_DELETE_TOKEN'),
    why: 'destructive delete token must stay server-side',
  },
  {
    pattern: envRef('HEALTH_SYNC_TOKEN'),
    why: 'iOS Shortcut bearer token must stay server-side',
  },
  {
    pattern: envRef('CRON_SECRET'),
    why: 'cron bearer must stay server-side',
  },
  {
    pattern: envRef('OURA_CLIENT_SECRET'),
    why: 'OAuth client secret must stay server-side',
  },
  {
    pattern: envRef('VAPID_PRIVATE_KEY'),
    why: 'web-push private key must stay server-side',
  },
]

async function walk(dir: string, acc: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir)) {
    const full = path.join(dir, entry)
    const s = await stat(full)
    if (s.isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue
      await walk(full, acc)
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      acc.push(full)
    }
  }
  return acc
}

async function readClientFiles(): Promise<Array<{ path: string; body: string }>> {
  const files = await walk(ROOT)
  const out: Array<{ path: string; body: string }> = []
  for (const f of files) {
    // Skip API route handlers: they are always server-side.
    if (f.includes(`${path.sep}app${path.sep}api${path.sep}`)) continue
    // Skip non-client files under src/lib that are not used by client code
    // is hard to enumerate; instead include any 'use client' module plus
    // components/. That is where NEXT_PUBLIC_ leaks would matter.
    const body = await readFile(f, 'utf8')
    const isUseClient = /^\s*(['"])use client\1/m.test(body)
    const isComponent = f.includes(`${path.sep}components${path.sep}`)
    if (!isUseClient && !isComponent) continue
    out.push({ path: f, body })
  }
  return out
}

describe('client bundle must not reference server-only secrets', () => {
  it('no client module references any banned env var', async () => {
    const files = await readClientFiles()
    const violations: string[] = []
    for (const { path: p, body } of files) {
      for (const { pattern, why } of BANNED_IN_CLIENT) {
        if (pattern.test(body)) {
          violations.push(`${path.relative(ROOT, p)} — ${pattern} — ${why}`)
        }
      }
    }
    expect(violations, violations.join('\n')).toEqual([])
  })

  // D-007 follow-up: the code for `createServiceClient` references
  // SUPABASE_SERVICE_ROLE_KEY. Even though current Next.js does not
  // inline the value, shipping the code in the client bundle is a
  // loaded gun and would throw at runtime. The three offending
  // components (WorkoutCard, VitalsCard, TiltTableTest) were
  // refactored in this sweep to POST to /api/log/* endpoints. The
  // pattern below targets import statements only — comments and
  // prose explaining the historical fix are allowed.
  it('no client module imports createServiceClient', async () => {
    const files = await readClientFiles()
    const importPattern =
      /import\s*(?:type\s*)?\{[^}]*\bcreateServiceClient\b[^}]*\}\s*from\s*['"]@\/lib\/supabase['"]/
    const violations: string[] = []
    for (const { path: p, body } of files) {
      if (importPattern.test(body)) {
        violations.push(path.relative(ROOT, p))
      }
    }
    expect(violations, violations.join('\n')).toEqual([])
  })
})
