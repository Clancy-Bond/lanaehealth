# Copy Audit Subagent Brief (pre-drafted)

**Status:** Ready to paste-dispatch AFTER all Wave 1 + Wave 2 features land. Scans entire codebase for non-shaming voice violations and adds enforcement.

**Why now-ish:** Every Wave 1 + Wave 2 subagent wrote user-facing strings. A single sweep catches drift across all of them in one pass. Running this BEFORE all waves finish risks re-introducing shaming copy in later waves; running AFTER catches everything.

---

## The Brief

```
MISSION: Sweep the LanaeHealth codebase for non-shaming voice rule
violations, rewrite user-facing strings that violate, add an enforcement
check, and update CLAUDE.md with the standing rule.

REPO: /Users/clancybond/lanaehealth

READ FIRST (mandatory):
1. /Users/clancybond/lanaehealth/docs/plans/2026-04-16-non-shaming-voice-rule.md
   (THE contract. Read every section. The banned-word list and
   approved-pattern table are the rules you enforce.)
2. /Users/clancybond/lanaehealth/docs/competitive/design-decisions.md
3. /Users/clancybond/lanaehealth/CLAUDE.md

SCOPE:
- User-facing strings only (components, pages, toasts, notifications,
  error messages surfaced to Lanae)
- Exclude: src/app/api/**/route.ts logging, test fixtures,
  src/lib/migrations/**, and clinical report copy in /doctor (clinical
  context allows adherence framing per non-shaming-voice-rule section
  "Clinical Nuance")

STEP 1 - AUDIT (read-only, produce findings report first)

Grep the codebase for banned patterns. Use case-insensitive grep.

Banned word list (treat as word-boundary matches, NOT substring):
- streak (any form)
- missed (as subject, not as verb in non-user text)
- forgot, forget
- failed, failure (in user-facing strings)
- off.track, off-track
- slipped
- fell.behind, behind (in shaming context)
- chain.broken, broken.chain
- perfect.week, perfect.month
- consistency.score
- adherence.score (shown to Lanae; OK in /doctor clinical reports)
- goal.not.met, goal.missed
- incomplete (in log-completeness context)
- "you should have"
- "you forgot to"
- "don't forget"
- "haven't logged in X days" (as hero copy)

For each hit, classify:
- VIOLATION: user-facing string, needs rewrite
- ALLOWED-CLINICAL: clinical report copy in /doctor (per clinical nuance
  exception)
- ALLOWED-INTERNAL: internal variable name, log string, not shown to user
- ALLOWED-TEST: test fixture
- FALSE-POSITIVE: word appears but context is reinforcing or neutral
  (example: "no need to restrict food" contains "restrict" which is fine;
  "you do not need a restrictive diet" contains "diet" which was
  previously fixed in Wave 1)

Write the audit as docs/qa/2026-04-17-copy-audit-findings.md with:
- Per-file hit count
- Per-hit classification
- Proposed rewrite for each VIOLATION
- Running total of violations found

STEP 2 - REWRITE

For each VIOLATION:
- Apply the approved-pattern from non-shaming-voice-rule.md section
  "Approved Patterns" and "Voice"
- Preserve semantic meaning
- Keep length similar where possible
- No em dashes in any rewrite
- Do NOT change internal variable names, just the displayed strings

STEP 3 - ENFORCEMENT

Add a lightweight check script that fails CI if new violations appear:
- Create scripts/check-voice.mjs
- Grep user-facing-string directories (src/app/**/page.tsx,
  src/app/**/layout.tsx, src/components/**/*.tsx) for banned words
- Respect per-file pragma comments:
  /* voice-rule-exempt: clinical-report */
  (This allows /doctor clinical copy without triggering false positives.)
- Exit 1 if any non-exempted violation found
- Add to package.json scripts: "check:voice": "node scripts/check-voice.mjs"
- Do NOT wire into the build command yet — this is an optional lint
  addition. Main session will decide if it should block CI later.

STEP 4 - UPDATE CLAUDE.md

Add a new subsection under "## Standing Rules" in CLAUDE.md:

### Non-shaming voice (2026-04-17)
Never use streak mechanics, guilt framing, compliance language, or
comparison-to-self shame. A missed day is not a failure. Rest is not
regression. See docs/plans/2026-04-16-non-shaming-voice-rule.md for the
full banned-word list, approved patterns, and clinical-nuance exception.
Run `npm run check:voice` to audit on demand.

STEP 5 - VERIFY

1. npm run build passes
2. npm test passes (existing tests should still pass; new check script
   has no tests)
3. npm run check:voice returns 0 exit code (no violations)
4. Run a deliberate trial: add the word "streak" to a test scratch file,
   confirm check:voice catches it, then remove.

STEP 6 - COMMIT

Stage only files you created / modified explicitly:
- docs/qa/2026-04-17-copy-audit-findings.md (the audit report)
- scripts/check-voice.mjs (the enforcement script)
- Every source file you rewrote for violation fixes
- CLAUDE.md (the new rule)
- package.json (the new script entry)

Single commit (or 2 if audit is big):

refactor(voice): non-shaming voice audit + enforcement script

Sweeps src/ for banned-word violations per
docs/plans/2026-04-16-non-shaming-voice-rule.md. Rewrites NN violations
across X files. Adds scripts/check-voice.mjs that fails on new
violations (respects /* voice-rule-exempt: clinical-report */ pragma
for allowed clinical adherence framing).

New CLAUDE.md rule: run `npm run check:voice` to audit.

Ref: docs/plans/2026-04-16-non-shaming-voice-rule.md
     docs/qa/2026-04-17-copy-audit-findings.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

STEP 7 - RETURN (under 300 words)

- Total violations found (by classification)
- Files rewritten (top 10 by violation count)
- 3 example rewrites (before / after)
- check:voice runtime (should be < 5 seconds)
- Commit SHA
- Any false positives that required thought (document the edge cases)
```

---

## Dispatch order guidance

Dispatch the copy audit AFTER:
- All Wave 1 features merged (including Wave 1B when cleaned up)
- All Wave 2 features merged

Copy audit is the LAST feature to land before final QA.
