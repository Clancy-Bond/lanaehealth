# Showing taps in screen recordings

## Why this matters

The 2026-04-29 app tour recording shows state changes but not which element produced them. Multiple frames show "this changed" without showing "the user tapped here." That makes downstream sessions guess at affordances and burn time enumerating interactivity from source.

We need future recordings to include a visible marker (circle, ripple, dot) at every tap location. iOS Screen Recording (Control Center) does **not** support this on its own. There is no setting; this has not changed in iOS 16, 17, or 18.

## Options, ranked

### Option A: Dev-mode touch overlay inside the app (recommended)

Add a small React component that listens to `pointerdown` (or `touchstart` for iOS) and renders a fading circle at the touch point. Gate it behind a dev flag so it never ships to production.

**Why this is best for LanaeHealth:**

- Works on the real Capacitor iOS shell, in any iOS Simulator, in mobile Safari, and in mobile Chrome devtools - one solution for every recording surface.
- Future recordings on real devices automatically include the markers.
- No third-party tools, no costs, no AirPlay receivers, no cable required.
- Small footprint: one component, ~40 lines, mounted conditionally in `src/app/v2/layout.tsx`.

**Implementation sketch:**

- `src/v2/components/dev/TouchOverlay.tsx`: a client component that subscribes to `pointerdown` on `document`, creates a `<div>` with a circle SVG at `event.clientX, event.clientY`, animates opacity 1 -> 0 over ~600ms, removes the node.
- Mount it in `src/app/v2/layout.tsx` only when `process.env.NEXT_PUBLIC_SHOW_TOUCHES === "1"` (or a runtime cookie / localStorage flag toggleable from a dev settings panel).
- Default off. Recording sessions enable the flag, take the video, disable.

**Caveats:**

- If you want multi-touch (pinch, two-finger tap), use `Touch.identifier` from the `TouchEvent` and render one circle per active touch point.
- Long-press should keep the marker visible until release - listen for `pointerup` to start the fade rather than fading on a fixed timer.

### Option B: iOS Simulator with "Show Touches" + `simctl recordVideo`

Built into Xcode. No app changes.

**Steps:**

1. Open the Simulator app (`open -a Simulator`).
2. Boot the desired device (Simulator > File > Open Simulator).
3. In the Simulator menu: I/O > "Show Single Touches" (and optionally "Show Multi-Touches" if you need both fingers).
4. Capture: `xcrun simctl io booted recordVideo --codec=h264 out.mov`. Stop with Ctrl+C.
5. Drop the file into `docs/current-state/recordings/`.

**Why not best for LanaeHealth:** the Capacitor WebView in Simulator does not always behave identically to the real iOS shell. Layout bugs (like the very viewport overflow we are hunting) sometimes only repro on device. Recordings of the Simulator can hide real-world issues. Use Simulator captures only when you specifically want the controlled environment.

### Option C: AssistiveTouch on a real device

iOS Settings > Accessibility > Touch > AssistiveTouch. The on-screen virtual button is always visible and adds a faint cursor when the user moves it. Some users believe this makes taps visible in recordings; in practice, it adds the AssistiveTouch button to the recording, not a per-tap marker.

**Verdict:** does not actually solve the problem. Skip.

### Option D: Mac iPhone Mirroring (macOS Sequoia+) + QuickTime / OBS

Sequoia introduced iPhone Mirroring; you can capture the mirrored window with QuickTime or OBS. Touches show up as system cursor movements when controlled from the Mac. If you operate the mirror with mouse clicks, the cursor IS the click marker.

**Verdict:** acceptable for a quick demo, awkward for accurate UX recording because mouse-driven gestures do not match real finger interactions (no swipe inertia, no long-press differentiation).

### Option E: Reflector, AirServer, 5KPlayer (third-party AirPlay receivers)

Some have built-in touch overlays (Reflector calls them "Spotlight"). Costs $20-30 per license.

**Verdict:** worth it if you do a lot of mobile demo recording for stakeholders, overkill for our use case.

### Option F: Safari Web Inspector + remote debugging

USB-connect the iPhone to the Mac. Safari > Develop > [device name] > [WebView]. You get a full DOM/console/network inspector for the live Capacitor WebView.

**Use this for:** diagnosing the viewport overflow bug in real time, **not** for recording. Pair Option F (debug) with Option A (visualize taps) for the most powerful current-state research workflow.

## Recommendation

Build Option A. It costs ~30 minutes once and pays back on every future recording. The component is a natural addition to the existing `src/v2/components/` tree, gated behind an env flag so it has zero production impact.

If you want, I can implement it next - a single new component file, a one-line mount in `src/app/v2/layout.tsx`, and a `.env.local.example` entry documenting the flag. Say the word.

## Bonus: a tiny click-recording scaffold

While we are here, the same overlay can double as a structured click log. A second listener writes `{ts, x, y, target}` to `window.__lanaeClickLog`. After a recording session, run `JSON.stringify(window.__lanaeClickLog)` in the WebView console and paste the result alongside the video. Now every recording has both a visual track (taps as markers) and a textual track (taps as JSON). Downstream sessions can correlate frames to specific elements without guessing.
