#!/usr/bin/env node
/**
 * Non-Shaming Voice Check (LanaeHealth)
 *
 * Fails if user-facing source files contain banned streak / shame /
 * compliance-framing words. See the full rule:
 *   docs/plans/2026-04-16-non-shaming-voice-rule.md
 *
 * Scope:
 *   - src/app / **.tsx (pages, layouts, API route .ts explicitly skipped)
 *   - src/components / **.tsx
 *   - src/lib/lite-log/** and src/lib/ai/adaptive-calories.ts (copy-producing lib files)
 *
 * Exemptions:
 *   - Files that declare the pragma comment
 *     /* voice-rule-exempt: clinical-report *\/
 *     are skipped entirely. Use this for clinician-facing reports
 *     (/doctor exports, PDF generators) where adherence framing is
 *     permitted per the rule's Clinical Nuance section.
 *
 *   - Lines that include the trailing inline pragma
 *     // voice-rule-exempt: clinical-report
 *     or
 *     /* voice-rule-exempt: clinical-report *\/
 *     are skipped at the line level.
 *
 *   - Files hardcoded into CLINICIAN_FILES below (already clinical).
 *
 *   - The check ignores pure comment lines (lines starting with // or /*
 *     or  * prefix) because several components legitimately describe
 *     what they do NOT do ("this card NEVER references streaks").
 *
 * Runtime target: under 5 seconds.
 * Usage: node scripts/check-voice.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join, relative } from 'node:path'
import { cwd } from 'node:process'

const ROOT = cwd()

// Directories to scan (relative to repo root).
const SCAN_DIRS = [
  'src/app',
  'src/components',
]

// Additional specific files outside those directories that produce
// user-facing copy strings and should be checked.
const EXTRA_FILES = [
  'src/lib/lite-log/activities.ts',
  'src/lib/ai/adaptive-calories.ts',
]

// Clinician-facing files that the rule explicitly exempts (Clinical
// Nuance section). These files can use adherence framing freely.
const CLINICIAN_FILES = new Set([
  'src/lib/reports/clinical-report.ts',
  'src/lib/reports/advocacy-report.ts',
  'src/lib/reports/cycle-report.ts',
  'src/lib/reports/cover-page.ts',
  'src/lib/reports/csv-export.ts',
  'src/lib/api/medication-adherence.ts',
  'src/app/api/medications/adherence/route.ts',
  'src/app/api/reports/doctor/route.ts',
  'src/lib/doctor/outstanding-tests.ts',
  'src/lib/clinical-scales.ts',
])

// Paths to skip regardless of extension (API routes are never rendered
// strings, and migrations are SQL docs).
const SKIP_PATTERNS = [
  /\/__tests__\//,
  /\.test\.(ts|tsx|mjs)$/,
  /\/api\/.*route\.ts$/,
  /\/migrations\//,
]

// File extensions we scan.
const SCAN_EXTS = new Set(['.ts', '.tsx'])

// Banned substring patterns (case-insensitive). These are word-boundary
// matches against the LITERAL lowercased source text. Many cognate
// substrings are also caught (see skip-rules below) to handle things
// like "tracking", "tracker", "tracked", which contain "track" but
// are not banned -- banned framing is "off track" or "back on track".
const BANNED_PATTERNS = [
  { re: /\bstreak(s|ed|ing)?\b/i, name: 'streak' },
  { re: /\bmissed (day|days|week|weeks|poll|log|check[- ]in|entry|entries)/i, name: 'missed ___' },
  { re: /\byou missed\b/i, name: 'you missed' },
  { re: /\byou forgot\b/i, name: 'you forgot' },
  { re: /\byou failed\b/i, name: 'you failed' },
  { re: /\byou should have\b/i, name: 'you should have' },
  { re: /\bdon'?t forget\b/i, name: "don't forget" },
  { re: /\bback on track\b/i, name: 'back on track' },
  { re: /\boff[- ]track\b/i, name: 'off track' },
  { re: /\bfell behind\b/i, name: 'fell behind' },
  { re: /\bslipped\b/i, name: 'slipped' },
  { re: /\bchain broken\b/i, name: 'chain broken' },
  { re: /\bbroken chain\b/i, name: 'broken chain' },
  { re: /\bperfect (week|month|day|record)\b/i, name: 'perfect ___' },
  { re: /\bconsistency score\b/i, name: 'consistency score' },
  { re: /\badherence score\b/i, name: 'adherence score' },
  { re: /\bgoal (not met|missed|incomplete)\b/i, name: 'goal not met' },
  { re: /\bhaven'?t logged\b/i, name: "haven't logged" },
  { re: /\blight logging\b/i, name: 'light logging' },
  { re: /\bheavy logging\b/i, name: 'heavy logging' },
]

const FILE_PRAGMA = /voice-rule-exempt:\s*clinical-report/
const LINE_PRAGMA = /voice-rule-exempt:\s*clinical-report/

let checked = 0
let violations = []

function walk(dir, out) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const name of entries) {
    const full = join(dir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      if (name === 'node_modules' || name.startsWith('.')) continue
      walk(full, out)
    } else if (st.isFile()) {
      const rel = relative(ROOT, full)
      const ext = rel.slice(rel.lastIndexOf('.'))
      if (!SCAN_EXTS.has(ext)) continue
      if (SKIP_PATTERNS.some(re => re.test(rel))) continue
      out.push(rel)
    }
  }
}

const files = []
for (const d of SCAN_DIRS) {
  walk(resolve(ROOT, d), files)
}
for (const f of EXTRA_FILES) {
  files.push(f)
}

for (const rel of files) {
  if (CLINICIAN_FILES.has(rel)) continue
  let source
  try {
    source = readFileSync(resolve(ROOT, rel), 'utf8')
  } catch {
    continue
  }
  // File-level pragma: skip entire file.
  if (FILE_PRAGMA.test(source)) {
    continue
  }
  checked++
  const lines = source.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    // Skip pure comment lines -- the rule applies to strings shown
    // to users, not to code comments describing forbidden framing.
    // Includes JS // and /* comments as well as JSX {/* comments.
    if (
      trimmed.startsWith('//') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('*/') ||
      trimmed.startsWith('{/*') ||
      trimmed.startsWith('{//')
    ) {
      continue
    }
    // Skip lines with inline pragma.
    if (LINE_PRAGMA.test(line)) continue
    for (const { re, name } of BANNED_PATTERNS) {
      if (re.test(line)) {
        violations.push({
          file: rel,
          line: i + 1,
          pattern: name,
          snippet: line.length > 120 ? line.slice(0, 117) + '...' : line,
        })
      }
    }
  }
}

const ms = performance.now()
if (violations.length === 0) {
  console.log(`voice-check: PASS. ${checked} files scanned. ${Math.round(ms)}ms.`)
  process.exit(0)
}

console.error(`voice-check: FAIL. ${violations.length} violation(s) in ${checked} files.`)
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  [${v.pattern}]`)
  console.error(`    ${v.snippet.trim()}`)
}
console.error('')
console.error('See docs/plans/2026-04-16-non-shaming-voice-rule.md for approved patterns.')
console.error('If this is clinician-facing copy (/doctor reports), add pragma at top of file:')
console.error('  /* voice-rule-exempt: clinical-report */')
process.exit(1)
