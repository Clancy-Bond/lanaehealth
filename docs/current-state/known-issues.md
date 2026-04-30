# Known issues observed in `2026-04-29-app-tour.mp4`

These issues are **app-wide or cross-cutting**, not specific to one section. Every parallel session should read this before touching their surface.

## 1. Horizontal overflow / viewport sizing bug

The doctor mode markdown output (frames 0057 - 0113) is the clearest example. Lines are clipped at the **left** edge of the viewport, suggesting content is rendering wider than its container and being shifted out of view rather than wrapped.

Examples (frame -> what shows -> what should show):

- 0060 -> "TS / Autonomic Dysfunction" -> "POTS / Autonomic Dysfunction"
- 0060 -> "ting evidence:" -> "Supporting evidence:"
- 0060 -> "ling pulse 106 bpm vs. resting 70 bpm" -> "Standing pulse 106 bpm vs. resting 70 bpm"
- 0095 -> "ot me saying you have IBD." -> "Not me saying you have IBD."
- 0105 -> "ck today. The three highest priority" -> "Back today. The three highest priority"

Login (frames 0050 - 0056), Home (0005 - 0009), Cycle landing (0011 - 0014), and the Settings list (0032 - 0044) appear correctly sized. The bug clusters on **markdown-rendered long-form content**, especially anywhere a table, code block, or long unbroken token (lab values like `3.2 mg/L`, `100/100`) appears.

**Most likely root cause** (to be confirmed): a markdown rendering component or one of its descendants has `white-space: nowrap`, `overflow-x: scroll`, `min-width` larger than the container, or is rendering at a desktop breakpoint inside a mobile viewport. The fix probably lives in the shared markdown primitive, not in a section's surface.

If a section session sees the bug on their surface, the diagnosis goes:

1. Find the offending element with the browser inspector or `preview_inspect`.
2. Identify whether it's a leaf (this section can fix it) or a primitive in `src/v2/components/primitives/` or `src/v2/components/shell/` (FOUNDATION-REQUEST required).
3. Do not silently widen breakpoints or hide overflow. Fix the layout cause.

## 2. Side-to-side scrolling on a mobile app

Related to the overflow bug above: the user noted the app "was going from side to side" which on a mobile native shell should never happen. The page is laterally scrollable because something inside is wider than `100vw`. Once #1 is identified and fixed, this should resolve as a side effect. If not, look for:

- A `min-width` on a wrapper.
- A horizontal flex row with `flex-wrap: nowrap` and content that overflows.
- A fixed pixel width on an image or chart.
- `overflow-x: visible` on the body/html.

The Capacitor iOS shell (commit `54f52ef`) and recent iOS branding work (`fb76645`) did not introduce this; it is likely older.

## 3. Tap targets are invisible in the recording

iOS Screen Recording does not capture touch indicators. Frames show **state changes**, not which element produced them. Some apparent affordances (cards, headings, badges, the small `°` after "Cycle") may or may not be interactive.

Each section session should:

1. Open the section's source (`src/app/v2/<section>/...`).
2. Enumerate every `<button>`, `<Link>`, `onClick`, `onPress`, `role="button"`, and gesture handler.
3. Cross-reference with the frames to mark which affordances were exercised in the recording vs which were not.
4. Treat "looks tappable but not exercised in the recording" as a research item, not a confirmed bug.

For future recordings with visible taps, see [`research/click-visualization.md`](research/click-visualization.md). Recommended path: build a small dev-mode touch overlay component that listens for `pointerdown` and renders a fading circle, gated behind `NEXT_PUBLIC_SHOW_TOUCHES`. Works on the real Capacitor shell, in Simulator, and in mobile Chrome devtools.

## 4. Calorie surface is shallow in this recording

The "Find a food" page rendered as a skeleton (frames 0020 - 0029). The recording does not exercise search results, food detail, unit picker, or save. The Calorie session should capture a focused follow-up before doing UI work.

## 5. Data surfaces (records / labs / imaging / import) are not in this recording at all

See `sessions/data.md`. Either capture a follow-up or read source directly.

## 6. Notification toggles default to OFF

Frame 0040 shows nearly all notification toggles in the off position with the line "Allow notifications first so we have a place to send them." The empty state is honest but the off-by-default may not be the intended product behavior. Worth a check with the user.
