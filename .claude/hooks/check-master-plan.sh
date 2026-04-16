#!/bin/bash
# Master Plan Completion Enforcement Hook
#
# This script is called by the Stop hook in .claude/settings.local.json.
# It checks the STATUS line in docs/plans/MASTER_PLAN_STATUS.md.
# If not COMPLETE, it blocks the stop and forces continued work.

set -e

STATUS_FILE="/Users/clancybond/lanaehealth/docs/plans/MASTER_PLAN_STATUS.md"

# Safety: if status file is missing, allow stop (don't create infinite loop)
if [ ! -f "$STATUS_FILE" ]; then
  echo '{}'
  exit 0
fi

# Check for STATUS: COMPLETE
if grep -q "^## STATUS: COMPLETE" "$STATUS_FILE" 2>/dev/null; then
  # Master plan is complete - allow stop
  echo '{}'
  exit 0
fi

# Extract the remaining work section for the reason message
REMAINING=$(sed -n '/^## REMAINING WORK/,/^## /p' "$STATUS_FILE" | head -n 30 | tr '\n' ' ' | head -c 500)

# Block the stop with a JSON response that wakes Claude back up
cat <<JSON
{
  "decision": "block",
  "reason": "MASTER PLAN IS NOT 100% COMPLETE. You agreed to not stop until the entire master plan is done. Read /Users/clancybond/lanaehealth/docs/plans/MASTER_PLAN_STATUS.md and /Users/clancybond/lanaehealth/docs/plans/2026-04-15-master-plan-universal-health-platform.md. Verify every item is actually implemented (not stubs, not empty states, not scaffolding). Keep building. When truly 100% done, update MASTER_PLAN_STATUS.md to have '## STATUS: COMPLETE' as the status line. Remaining work hint: ${REMAINING}"
}
JSON
exit 0
