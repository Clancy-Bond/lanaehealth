# Audit 00: app-wide horizontal-overflow fix

Status: landed via `foundation: fix horizontal overflow across v2`.

This audit documents the diagnosis and fix for the priority-zero
viewport bug. The 2026-04-29 app tour showed text clipped on the
left and right edges of most surfaces ("ow are you feeling?" instead
of "How are you feeling?", "TS / Autonomic Dysfunction" instead of
"POTS / Autonomic Dysfunction", and so on). A foundation pass landed
the fix; the section sessions can now fan out without inheriting the
same trap.

## a. Root causes found

The visible clipping in the recording is the surface of three
underlying causes. All three are layout-engine traps that surface
only when real medical content (long lab values, PubMed URLs,
slash-separated hypothesis names) lands inside flex containers. They
do not show up at empty/skeleton state or with placeholder copy,
which is why the dev-mode auth-disabled walkthrough showed zero
overflow on the same routes the recording captured.

| # | Where | One-line cause |
|---|---|---|
| 1 | `src/v2/theme/tokens.css` (foundation, missing rule) | `.v2` had no `overflow-wrap` declaration, so default `normal` left long unbreakable tokens (URLs, "100/100 mg/dL") wider than their flex parents. |
| 2 | `src/v2/components/shell/MobileShell.tsx` (foundation) | The `<main>` flex child defaulted to `min-width: auto`, refusing to shrink below its content's intrinsic width when a child exceeded the viewport. |
| 3 | `src/v2/theme/tokens.css` (foundation, missing rule) | No safety rule for `<img> / <video> / <iframe>` inside `.v2`; a fixed-pixel media element in markdown could widen its container. |

Section components (`src/app/v2/chat/_components/MessageBubble.tsx`,
`src/app/v2/doctor/_components/HypothesesCard.tsx`, etc.) inherit
all three problems from the foundation. The brief explicitly scoped
this pass to foundation files; the per-section card layouts are not
touched. The foundation rule below covers them via CSS inheritance
and cascade.

## b. Fix per cause

### 1. Foundation text-wrap rule in `src/v2/theme/tokens.css`

Added a `.v2 { overflow-wrap: anywhere; word-break: normal }` rule
plus media defaults:

```css
.v2 {
  overflow-wrap: anywhere;
  word-break: normal;
}
.v2 img,
.v2 video,
.v2 iframe,
.v2 svg:not([width]) {
  max-width: 100%;
  height: auto;
}
```

`overflow-wrap: anywhere` is preferred over `break-word` because it
makes the post-break width count as the element's min-content size.
That is the magic property: flex children with wrappable text now
calculate their min-content as ~1ch, so they can actually shrink to
fit available space instead of forcing the parent wider. Without
this, a single long URL was enough to push a chat bubble past the
viewport.

The media rule is defensive: a fixed-pixel image / video / iframe
in dynamic content (markdown figure, embedded chart, remote avatar)
cannot widen its container.

### 2. Shell `min-width: 0` and viewport cap in `src/v2/components/shell/MobileShell.tsx`

The shell's `<main>` and outer wrapper both gained `min-width: 0`,
the outer wrapper now caps `max-width: 100vw`, and the previous
`overflow-x: hidden` band-aid on `<main>` was removed:

```tsx
<div className="v2" style={{
  minHeight: '100vh',
  width: '100%',
  maxWidth: '100vw',
  minWidth: 0,
  // ...
}}>
  {top}
  <main style={{
    flex: 1,
    minWidth: 0,
    overflowY: scroll ? 'auto' : 'hidden',
    // No overflow-x suppression; the foundation rule plus
    // min-width: 0 keeps content inside, and any future regression
    // surfaces in the viewport.spec rather than being silently
    // clipped.
    // ...
  }}>
    {children}
  </main>
  {bottom}
  {fab}
</div>
```

The previous shell pinned `overflow-x: hidden` on `<main>`, which is
exactly the kind of "any shell wrapper" band-aid the brief warned
against. With it in place, a runaway child rendered wider than the
viewport got silently clipped instead of failing the new viewport
spec. Removing it makes the regression net actually fail when a
new component overflows, which is the point of the test.

The viewport-spec re-run after removal: 48/48 green on both WebKit
(iPhone 13 Pro) and Mobile Chromium (Pixel 7), confirming that the
foundation `overflow-wrap: anywhere` rule plus `min-width: 0` on
`<main>` is sufficient on its own; the safety net was masking
nothing real.

### 3. Media defaults

Covered in fix #1 above (same CSS block).

## c. Screens walked, before / after

Pre-fix, the recording showed text clipped on the left and right
edges of every primary screen. Post-fix the foundation rule covers
every v2 surface via CSS cascade. The new
`tests/e2e/viewport.spec.ts` is the regression net: it asserts
`document.documentElement.scrollWidth <= window.innerWidth + 1` on
every route below, on both the WebKit (iPhone 13 Pro) and mobile
Chromium (Pixel 7) projects from `playwright.config.ts`.

| Route | Before | After |
|---|---|---|
| `/v2` | clipped (per recording) | fits at 390pt; spec asserts |
| `/v2/chat` | "ow are you feeling?" (per recording) | fits; foundation rule wraps any URL in markdown |
| `/v2/cycle` | "TS / Autonomic Dysfunction" (per recording) | fits; hypothesis titles wrap |
| `/v2/cycle/insights` | clipped (per recording) | fits; spec asserts |
| `/v2/cycle/log` | not in recording | fits; spec asserts |
| `/v2/cycle/history` | not in recording | fits; spec asserts |
| `/v2/calories` | clipped (per recording) | fits; spec asserts |
| `/v2/doctor` | "ck today. The three highest priority" (per recording) | fits; markdown wraps inside cards |
| `/v2/log` | not in recording | fits; spec asserts |
| `/v2/today` | not in recording | fits; spec asserts |
| `/v2/sleep` | not in recording | fits; spec asserts |
| `/v2/timeline` | not in recording | fits; spec asserts |
| `/v2/settings` | not in recording | fits; spec asserts |
| `/v2/login`, `/v2/signup`, `/v2/forgot-password` | not in recording | fits; spec asserts |
| `/v2/learn`, `/v2/records`, `/v2/labs`, `/v2/imaging`, `/v2/import`, `/v2/topics`, `/v2/patterns`, `/v2/demo` | not in recording | fits; spec asserts |

Live verification (manual, 390x844 mobile viewport, dev server with
`LANAE_REQUIRE_AUTH=false`):
1. Navigated to `/v2/demo` (the foundation showcase).
2. Computed style on the v2 `<main>`:
   `overflow-wrap: anywhere`, `min-width: 0px`, `overscroll-behavior: none`.
3. Stress-injected the worst-case content from the recording (a
   400-character PubMed URL, a no-space token, a slash-separated
   hypothesis title with a `nowrap` confidence badge). Result:
   `document.scrollWidth == window.innerWidth`, zero offending
   elements with `scrollWidth > clientWidth`.

## Notes for section sessions

The foundation rule is inherited cascade. You should not need to
add per-component `overflow-wrap`, `word-break`, or `min-width: 0`
guards in your section code unless you have a specific layout that
needs to opt out. If you find a surface that overflows after this
fix, the right move is FOUNDATION-REQUEST, not a local override.

## Addendum: iOS rubber-band overscroll

A second pass on this same PR also killed the iOS WebKit rubber-band
overscroll bounce at the top and bottom of the app. Without it, a
swipe past the top or bottom sprung back with elastic bounce that
makes the Capacitor WebView feel webby instead of native, and a
swipe-down at the top would trigger pull-to-refresh and reload the
page mid-conversation.

Fix in three places:

- `src/app/globals.css`: `html, body { overscroll-behavior: none }`.
  Kills document-level bounce on every route (legacy and v2).
- `src/v2/components/shell/MobileShell.tsx`: `overscrollBehavior:
  'none'` on the `<main>` scroll container. Belts-and-suspenders for
  the inner scroller; needed because `<main>` is the actual scroller
  in the v2 chrome and the body bounce alone does not cover the
  inner scroll-end bounce inside it.
- New `viewport.spec.ts` test: asserts the computed
  `overscroll-behavior-y` is `none` on `<html>` and `<body>`. Both
  WebKit and Mobile Chromium projects pass.

`overscroll-behavior: none` requires iOS Safari 16 or later, which is
the floor for the Capacitor WebView the production app ships in.
The CSS rule is a no-op on older browsers; they simply keep the
default bounce.
