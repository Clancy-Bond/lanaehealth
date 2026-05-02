// Regression test for D-002: NEXT_PUBLIC_SHARE_TOKEN_ADMIN_TOKEN must
// never be referenced anywhere in client code. The NEXT_PUBLIC_ prefix
// causes Next.js to inline the value into the browser bundle, which
// turns the "admin token" into a public credential anyone can lift
// from the page source.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(HERE, '..')

describe('NEXT_PUBLIC_SHARE_TOKEN_ADMIN_TOKEN must not appear in any client component', () => {
  const FILES = [
    'app/doctor/care-card/print-actions.tsx',
  ]
  for (const rel of FILES) {
    it(`${rel} does not reference NEXT_PUBLIC_SHARE_TOKEN_ADMIN_TOKEN at runtime`, () => {
      const content = readFileSync(path.join(SRC, rel), 'utf8')
      // Strip block comments so the documentation paragraph noting the
      // historical leak does not trip the check.
      const stripped = content
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
      expect(stripped).not.toContain('NEXT_PUBLIC_SHARE_TOKEN_ADMIN_TOKEN')
    })
  }
})
