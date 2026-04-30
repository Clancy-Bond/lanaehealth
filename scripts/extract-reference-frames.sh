#!/usr/bin/env bash
# Extract scene-change frames from a reference-app screen recording.
#
# Uses ffmpeg's scene-change detection to keep only frames where the
# screen visually changed meaningfully. A 5-min recording at 30fps =
# 9000 frames; this typically produces 50-200 unique frames.
#
# Usage:
#   scripts/extract-reference-frames.sh <video.mov> [scene_threshold]
#
# scene_threshold: 0.0-1.0, fraction of pixels that must change to
# count as a new scene. Default 0.30. Lower = more frames captured;
# higher = only major transitions kept.
#
# Output:
#   docs/reference/<app>/frames/<flow-name>/frame_NNNN.png
# (where <flow-name> is the input video filename without extension,
# and <app> is inferred from the parent directory)
#
# Example:
#   scripts/extract-reference-frames.sh \
#     docs/reference/oura/recordings/home-tour.mov 0.25

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <video.mov> [scene_threshold=0.30]" >&2
  exit 1
fi

INPUT="$1"
THRESHOLD="${2:-0.30}"

if [[ ! -f "$INPUT" ]]; then
  echo "Error: file not found: $INPUT" >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Error: ffmpeg not found. Install with: brew install ffmpeg" >&2
  exit 1
fi

BASENAME=$(basename "$INPUT")
FLOW_NAME="${BASENAME%.*}"
RECORDINGS_DIR=$(dirname "$INPUT")
APP_DIR=$(dirname "$RECORDINGS_DIR")
FRAMES_DIR="$APP_DIR/frames/$FLOW_NAME"

mkdir -p "$FRAMES_DIR"

echo "Input:     $INPUT"
echo "Threshold: $THRESHOLD"
echo "Output:    $FRAMES_DIR"
echo ""
echo "Extracting scene-change frames..."

ffmpeg -hide_banner -loglevel warning \
  -i "$INPUT" \
  -vf "select='gt(scene,$THRESHOLD)',showinfo" \
  -vsync vfr \
  -frame_pts 0 \
  "$FRAMES_DIR/frame_%04d.png"

COUNT=$(find "$FRAMES_DIR" -name 'frame_*.png' | wc -l | tr -d ' ')
echo ""
echo "Done. Extracted $COUNT unique frames to $FRAMES_DIR"
echo ""
echo "Next steps:"
echo "  1. Review frames; delete obvious duplicates / non-canonical states"
echo "  2. Rename canonical frames semantically, e.g.:"
echo "     mv frame_0007.png food-search-empty.png"
echo "     mv frame_0023.png food-search-results.png"
echo "  3. Document observed colors/type/components in"
echo "     $APP_DIR/{colors,typography,components}.md"
