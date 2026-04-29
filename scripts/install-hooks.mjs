#!/usr/bin/env node
/**
 * Install git hooks from scripts/git-hooks/ into the repo's hooks dir.
 *
 * Runs automatically via the "prepare" npm script on `npm install`, so
 * every contributor gets the hooks without extra steps. Safe to run
 * repeatedly, idempotent copy with chmod +x.
 *
 * Worktree-aware: in a git worktree, `.git` is a FILE (containing
 * `gitdir: /path/to/main/.git/worktrees/<name>`) rather than a
 * directory, and per-worktree hooks live under that pointed-to dir,
 * not under `<repo>/.git/hooks`. Using `git rev-parse --git-path
 * hooks` resolves to the correct hooks directory in both shapes.
 *
 * Why not husky: one less dev dep for a single hook, and it keeps
 * the hook script human-readable in-repo (scripts/git-hooks/)
 * rather than buried under .husky/ conventions.
 */

import { readFileSync, writeFileSync, chmodSync, existsSync, mkdirSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, dirname, isAbsolute, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')
const sourceDir = join(__dirname, 'git-hooks')

// Resolve the hooks directory via git itself so the script handles
// both a regular checkout (.git is a directory) and a worktree
// (.git is a file pointing at the shared git dir). When git is not
// available or the cwd is not a git workspace, skip silently — this
// happens in CI tarball installs and when the package is consumed
// as a dependency. Args are hardcoded; execFileSync avoids the
// shell so no injection surface exists either way.
let hooksDir
try {
  const raw = execFileSync('git', ['rev-parse', '--git-path', 'hooks'], {
    cwd: repoRoot,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
  hooksDir = isAbsolute(raw) ? raw : resolve(repoRoot, raw)
} catch (err) {
  console.log(
    `[install-hooks] no git workspace, skipping (${err instanceof Error ? err.message.split('\n')[0] : 'unknown'})`,
  )
  process.exit(0)
}

if (!existsSync(hooksDir)) {
  mkdirSync(hooksDir, { recursive: true })
}

const hooks = ['pre-push']
for (const hookName of hooks) {
  const src = join(sourceDir, hookName)
  const dest = join(hooksDir, hookName)
  if (!existsSync(src)) {
    console.warn(`[install-hooks] source missing: ${src}`)
    continue
  }
  writeFileSync(dest, readFileSync(src, 'utf-8'))
  chmodSync(dest, 0o755)
  console.log(`[install-hooks] installed ${hookName} → ${dest}`)
}
