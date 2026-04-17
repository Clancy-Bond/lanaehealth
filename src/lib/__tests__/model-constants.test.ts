import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, resolve } from 'path'

// Regression test for QA Session 2 W1.1
// Prevents any future reintroduction of deprecated dated model snapshots
// for Claude sonnet and opus tiers. Canonical names per CLAUDE.md:
//   claude-sonnet-4-6, claude-opus-4-6
// The claude-haiku-4-5-20251001 snapshot is the canonical Haiku 4.5
// identifier and is allowed. Older claude-3-5-haiku-* snapshots are
// out of scope for this check.

const SRC_DIR = resolve(__dirname, '..', '..')

// Matches dated snapshots like:
//   claude-sonnet-4-20250514
//   claude-opus-4-20240229
// for any year 2025-2029. Intentionally does NOT match canonical
// non-dated names (claude-sonnet-4-6) or the Haiku 4.5 snapshot.
const DEPRECATED_PATTERN = /claude-(sonnet|opus)-\d-202[5-9]\d{4}/g

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next' || entry === 'dist') continue
      walk(fullPath, files)
    } else if (
      entry.endsWith('.ts') ||
      entry.endsWith('.tsx') ||
      entry.endsWith('.mjs') ||
      entry.endsWith('.js')
    ) {
      files.push(fullPath)
    }
  }
  return files
}

describe('model constants (regression guard)', () => {
  it('no deprecated dated sonnet/opus model snapshots in src/', () => {
    const files = walk(SRC_DIR)
    const offenders: { file: string; matches: string[] }[] = []

    for (const file of files) {
      // Skip this test file itself; the pattern literal is intentional here.
      if (file.endsWith('model-constants.test.ts')) continue
      const content = readFileSync(file, 'utf-8')
      const matches = content.match(DEPRECATED_PATTERN)
      if (matches && matches.length > 0) {
        offenders.push({ file, matches: Array.from(new Set(matches)) })
      }
    }

    expect(
      offenders,
      `Found deprecated dated model snapshots. Use canonical non-dated names (claude-sonnet-4-6, claude-opus-4-6) per CLAUDE.md.\n` +
        offenders.map((o) => `  ${o.file}: ${o.matches.join(', ')}`).join('\n'),
    ).toEqual([])
  })
})
