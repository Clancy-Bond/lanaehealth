#!/usr/bin/env node
/**
 * Install git hooks from scripts/git-hooks/ into .git/hooks/.
 *
 * Runs automatically via the "prepare" npm script on `npm install`, so
 * every contributor gets the hooks without extra steps. Safe to run
 * repeatedly, idempotent copy with chmod +x.
 *
 * Why this instead of husky: one less dev dep for a single hook, and
 * it keeps the hook script human-readable in-repo (scripts/git-hooks/)
 * rather than buried under .husky/ conventions.
 */

import { readFileSync, writeFileSync, chmodSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')
const gitHooksDir = join(repoRoot, '.git', 'hooks')
const sourceDir = join(__dirname, 'git-hooks')

// .git dir may not exist in CI or when the package is consumed as a dep
if (!existsSync(join(repoRoot, '.git'))) {
  console.log('[install-hooks] no .git directory, skipping (likely CI)')
  process.exit(0)
}

if (!existsSync(gitHooksDir)) {
  mkdirSync(gitHooksDir, { recursive: true })
}

const hooks = ['pre-push']
for (const hookName of hooks) {
  const src = join(sourceDir, hookName)
  const dest = join(gitHooksDir, hookName)
  if (!existsSync(src)) {
    console.warn(`[install-hooks] source missing: ${src}`)
    continue
  }
  writeFileSync(dest, readFileSync(src, 'utf-8'))
  chmodSync(dest, 0o755)
  console.log(`[install-hooks] installed ${hookName}`)
}
