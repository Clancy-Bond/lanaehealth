#!/usr/bin/env bash
# Create a new v2 build worktree with reference frames symlinked in.
#
# Reference frames + recordings live under docs/reference/<app>/{frames,recordings}/
# but are gitignored (third-party screenshots). New worktrees won't have them
# by default. This script symlinks them from the source worktree so each
# parallel session can read the same reference assets.
#
# Usage:
#   scripts/v2-worktree-setup.sh <section-name>
# Example:
#   scripts/v2-worktree-setup.sh cycle
#   scripts/v2-worktree-setup.sh foundation
#   scripts/v2-worktree-setup.sh calories
#   scripts/v2-worktree-setup.sh home
#   scripts/v2-worktree-setup.sh doctor
#   scripts/v2-worktree-setup.sh tail

set -euo pipefail

SECTION="${1:-}"
if [[ -z "$SECTION" ]]; then
  echo "Usage: $0 <section-name>" >&2
  echo "Sections: foundation | cycle | calories | home | doctor | tail" >&2
  exit 1
fi

SOURCE_WORKTREE="$(git rev-parse --show-toplevel)"
WORKTREE_PATH="$SOURCE_WORKTREE/../v2-$SECTION"
BRANCH="claude/v2-$SECTION"

if [[ -d "$WORKTREE_PATH" ]]; then
  echo "Error: worktree already exists at $WORKTREE_PATH" >&2
  exit 1
fi

echo "Creating worktree at $WORKTREE_PATH on branch $BRANCH..."
git worktree add "$WORKTREE_PATH" -b "$BRANCH"
cd "$WORKTREE_PATH"

echo "Symlinking reference frames + recordings from source worktree..."
mkdir -p docs/reference/oura docs/reference/natural-cycles docs/reference/mynetdiary
for app in oura natural-cycles mynetdiary; do
  for kind in frames recordings; do
    rm -rf "docs/reference/$app/$kind"
    ln -s "$SOURCE_WORKTREE/docs/reference/$app/$kind" "docs/reference/$app/$kind"
  done
done

echo ""
echo "Verifying reference access:"
ls "docs/reference/oura/frames/full-tour" 2>/dev/null | head -3 || echo "(empty / not extracted yet)"

echo ""
echo "============================================================"
echo "Worktree ready: $WORKTREE_PATH"
echo "Branch:        $BRANCH"
echo ""
echo "Next steps:"
echo "  cd $WORKTREE_PATH"
echo "  claude              # start a fresh Claude Code session"
echo ""
echo "Then paste docs/sessions/0X-$SECTION.md as your first message."
echo "============================================================"
